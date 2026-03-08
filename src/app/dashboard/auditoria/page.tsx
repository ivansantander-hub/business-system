"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Shield, Search, ChevronLeft, ChevronRight, User, FileText,
  Clock, Eye, Filter, BarChart3, ArrowUpDown, X, ExternalLink,
} from "lucide-react";
import Link from "next/link";
import { getEntityUrl, getEntityLabel, getActionLabel } from "@/lib/entity-urls";

interface AuditLog {
  id: string;
  action: string;
  entity: string | null;
  entityId: string | null;
  userId: string | null;
  userName: string | null;
  details: Record<string, unknown> | null;
  beforeState: Record<string, unknown> | null;
  afterState: Record<string, unknown> | null;
  changeReason: string | null;
  checksum: string | null;
  ipAddress: string | null;
  level: string;
  source: string;
  path: string | null;
  createdAt: string;
}

interface Stats {
  totalLogs: number;
  byEntity: { entity: string; count: number }[];
  byUser: { userId: string; userName: string; count: number }[];
  byAction: { action: string; count: number }[];
}

function DiffViewer({ before, after }: Readonly<{ before: Record<string, unknown> | null; after: Record<string, unknown> | null }>) {
  if (!before && !after) return <p className="text-sm text-slate-500 dark:text-slate-400">Sin datos de cambio</p>;

  const allKeys = new Set([...Object.keys(before || {}), ...Object.keys(after || {})]);
  const changes: { key: string; old: unknown; new_: unknown; changed: boolean }[] = [];

  for (const key of allKeys) {
    if (["createdAt", "id", "companyId", "updatedAt"].includes(key)) continue;
    const oldVal = before?.[key];
    const newVal = after?.[key];
    const changed = JSON.stringify(oldVal) !== JSON.stringify(newVal);
    if (changed || !before) {
      changes.push({ key, old: oldVal, new_: newVal, changed });
    }
  }

  if (changes.length === 0) return <p className="text-sm text-slate-500 dark:text-slate-400">Sin cambios detectados</p>;

  return (
    <div className="space-y-1 max-h-64 overflow-y-auto">
      {changes.map((c) => (
        <div key={c.key} className="grid grid-cols-3 gap-2 text-xs font-mono">
          <span className="text-slate-600 dark:text-slate-400 truncate font-semibold">{c.key}</span>
          {before ? (
            <span className="text-red-600 dark:text-red-400 truncate bg-red-50 dark:bg-red-900/20 px-1 rounded">
              {formatVal(c.old)}
            </span>
          ) : (
            <span className="text-slate-400">—</span>
          )}
          <span className="text-green-600 dark:text-green-400 truncate bg-green-50 dark:bg-green-900/20 px-1 rounded">
            {formatVal(c.new_)}
          </span>
        </div>
      ))}
    </div>
  );
}

function formatVal(v: unknown): string {
  if (v === null || v === undefined) return "null";
  if (typeof v === "object") return JSON.stringify(v);
  return String(v);
}

export default function AuditoriaPage() {
  const [tab, setTab] = useState<"dashboard" | "explorer" | "timeline">("dashboard");
  const [stats, setStats] = useState<Stats | null>(null);
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const [selectedLog, setSelectedLog] = useState<AuditLog | null>(null);

  const [filterEntity, setFilterEntity] = useState("");
  const [filterUserId, setFilterUserId] = useState("");
  const [filterAction, setFilterAction] = useState("");
  const [filterFrom, setFilterFrom] = useState("");
  const [filterTo, setFilterTo] = useState("");
  const [filterSearch, setFilterSearch] = useState("");

  const [tlEntity, setTlEntity] = useState("Invoice");
  const [tlEntityId, setTlEntityId] = useState("");
  const [tlEvents, setTlEvents] = useState<AuditLog[]>([]);
  const [tlTotal, setTlTotal] = useState(0);
  const [tlPage, setTlPage] = useState(1);
  const [tlLoading, setTlLoading] = useState(false);

  useEffect(() => {
    fetch("/api/audit/stats")
      .then((r) => r.json())
      .then(setStats)
      .catch(() => {});
  }, []);

  const fetchLogs = useCallback(() => {
    setLoading(true);
    const params = new URLSearchParams({ page: String(page), limit: "30" });
    if (filterEntity) params.set("entity", filterEntity);
    if (filterUserId) params.set("userId", filterUserId);
    if (filterAction) params.set("action", filterAction);
    if (filterFrom) params.set("from", filterFrom);
    if (filterTo) params.set("to", filterTo);
    if (filterSearch) params.set("search", filterSearch);

    fetch(`/api/logs?${params}`)
      .then((r) => r.json())
      .then((d) => {
        setLogs(d.logs || []);
        setTotal(d.total || 0);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [page, filterEntity, filterUserId, filterAction, filterFrom, filterTo, filterSearch]);

  useEffect(() => {
    if (tab === "explorer") fetchLogs();
  }, [tab, fetchLogs]);

  const fetchTimeline = useCallback(() => {
    if (!tlEntityId) return;
    setTlLoading(true);
    fetch(`/api/audit/timeline?entity=${tlEntity}&entityId=${tlEntityId}&page=${tlPage}&limit=50`)
      .then((r) => r.json())
      .then((d) => {
        setTlEvents(d.events || []);
        setTlTotal(d.total || 0);
      })
      .catch(() => {})
      .finally(() => setTlLoading(false));
  }, [tlEntity, tlEntityId, tlPage]);

  const totalPages = Math.ceil(total / 30);
  const tlTotalPages = Math.ceil(tlTotal / 50);

  const entityTypes = ["Invoice", "Product", "Purchase", "Customer", "User", "CashSession", "DayPass", "Membership", "Order", "Expense"];

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <Shield className="w-7 h-7 text-indigo-600 dark:text-indigo-400" />
            Centro de Auditoría
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            Trazabilidad completa de todas las acciones del sistema
          </p>
        </div>
      </div>

      <div className="flex gap-1 border-b border-slate-200 dark:border-slate-700">
        {[
          { key: "dashboard" as const, label: "Resumen", icon: BarChart3 },
          { key: "explorer" as const, label: "Explorador", icon: Search },
          { key: "timeline" as const, label: "Línea de Vida", icon: Clock },
        ].map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
              tab === t.key
                ? "border-indigo-600 text-indigo-600 dark:text-indigo-400 dark:border-indigo-400"
                : "border-transparent text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300"
            }`}
          >
            <t.icon className="w-4 h-4" />
            <span className="hidden sm:inline">{t.label}</span>
          </button>
        ))}
      </div>

      {tab === "dashboard" && stats && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="card p-4">
              <p className="text-xs text-slate-500 dark:text-slate-400 uppercase tracking-wide">Total Registros</p>
              <p className="text-2xl font-bold text-slate-900 dark:text-white mt-1">{stats.totalLogs.toLocaleString()}</p>
            </div>
            <div className="card p-4">
              <p className="text-xs text-slate-500 dark:text-slate-400 uppercase tracking-wide">Entidades Auditadas</p>
              <p className="text-2xl font-bold text-slate-900 dark:text-white mt-1">{stats.byEntity.length}</p>
            </div>
            <div className="card p-4">
              <p className="text-xs text-slate-500 dark:text-slate-400 uppercase tracking-wide">Usuarios Activos</p>
              <p className="text-2xl font-bold text-slate-900 dark:text-white mt-1">{stats.byUser.length}</p>
            </div>
            <div className="card p-4">
              <p className="text-xs text-slate-500 dark:text-slate-400 uppercase tracking-wide">Tipos de Acción</p>
              <p className="text-2xl font-bold text-slate-900 dark:text-white mt-1">{stats.byAction.length}</p>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="card p-4">
              <h3 className="font-semibold text-slate-900 dark:text-white mb-3 flex items-center gap-2">
                <FileText className="w-4 h-4" /> Por Entidad
              </h3>
              <div className="space-y-2">
                {stats.byEntity.map((e) => (
                  <div key={e.entity} className="flex items-center justify-between text-sm">
                    <span className="text-slate-700 dark:text-slate-300">{getEntityLabel(e.entity)}</span>
                    <span className="font-mono text-xs bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded">{e.count}</span>
                  </div>
                ))}
              </div>
            </div>
            <div className="card p-4">
              <h3 className="font-semibold text-slate-900 dark:text-white mb-3 flex items-center gap-2">
                <User className="w-4 h-4" /> Por Usuario
              </h3>
              <div className="space-y-2">
                {stats.byUser.map((u) => (
                  <div key={u.userId} className="flex items-center justify-between text-sm">
                    <span className="text-slate-700 dark:text-slate-300">{u.userName || "Sistema"}</span>
                    <span className="font-mono text-xs bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded">{u.count}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {tab === "explorer" && (
        <div className="space-y-4">
          <div className="card p-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
              <div>
                <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">Buscar</label>
                <div className="relative">
                  <Search className="absolute left-2.5 top-2.5 w-4 h-4 text-slate-400" />
                  <input
                    className="input-field pl-9"
                    placeholder="Acción, usuario, ruta..."
                    value={filterSearch}
                    onChange={(e) => { setFilterSearch(e.target.value); setPage(1); }}
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">Entidad</label>
                <select className="input-field" value={filterEntity} onChange={(e) => { setFilterEntity(e.target.value); setPage(1); }}>
                  <option value="">Todas</option>
                  {entityTypes.map((et) => <option key={et} value={et}>{getEntityLabel(et)}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">Desde</label>
                <input type="date" className="input-field" value={filterFrom} onChange={(e) => { setFilterFrom(e.target.value); setPage(1); }} />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">Hasta</label>
                <input type="date" className="input-field" value={filterTo} onChange={(e) => { setFilterTo(e.target.value); setPage(1); }} />
              </div>
            </div>
            {(filterSearch || filterEntity || filterFrom || filterTo) && (
              <button
                onClick={() => { setFilterSearch(""); setFilterEntity(""); setFilterFrom(""); setFilterTo(""); setFilterAction(""); setFilterUserId(""); setPage(1); }}
                className="mt-2 text-xs text-indigo-600 dark:text-indigo-400 hover:underline flex items-center gap-1"
              >
                <X className="w-3 h-3" /> Limpiar filtros
              </button>
            )}
          </div>

          {loading ? (
            <div className="card p-8 text-center text-slate-500 dark:text-slate-400">Cargando...</div>
          ) : (
            <>
              <div className="card overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr>
                      <th className="table-header">Fecha</th>
                      <th className="table-header">Usuario</th>
                      <th className="table-header">Acción</th>
                      <th className="table-header">Entidad</th>
                      <th className="table-header">IP</th>
                      <th className="table-header text-center">Detalle</th>
                    </tr>
                  </thead>
                  <tbody>
                    {logs.map((log) => {
                      const entityUrl = getEntityUrl(log.entity, log.entityId);
                      return (
                        <tr key={log.id} className="hover:bg-slate-50 dark:hover:bg-white/[0.03]">
                          <td className="table-cell text-xs font-mono whitespace-nowrap">
                            {new Date(log.createdAt).toLocaleString("es-CO")}
                          </td>
                          <td className="table-cell text-sm">{log.userName || "—"}</td>
                          <td className="table-cell">
                            <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${
                              log.level === "error" ? "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400"
                                : log.level === "warn" ? "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400"
                                : "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400"
                            }`}>
                              {getActionLabel(log.action)}
                            </span>
                          </td>
                          <td className="table-cell text-sm">
                            {log.entity && entityUrl ? (
                              <Link href={entityUrl} className="text-indigo-600 dark:text-indigo-400 hover:underline flex items-center gap-1">
                                {getEntityLabel(log.entity)} <ExternalLink className="w-3 h-3" />
                              </Link>
                            ) : (
                              <span>{log.entity ? getEntityLabel(log.entity) : "—"}</span>
                            )}
                          </td>
                          <td className="table-cell text-xs font-mono text-slate-500">{log.ipAddress || "—"}</td>
                          <td className="table-cell text-center">
                            <button
                              onClick={() => setSelectedLog(log)}
                              className="p-1.5 hover:bg-indigo-50 dark:hover:bg-indigo-500/10 rounded-lg"
                              title="Ver detalle"
                            >
                              <Eye className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                    {logs.length === 0 && (
                      <tr><td colSpan={6} className="table-cell text-center text-slate-500 py-8">Sin registros</td></tr>
                    )}
                  </tbody>
                </table>
              </div>

              <div className="flex items-center justify-between">
                <p className="text-sm text-slate-500 dark:text-slate-400">
                  {total.toLocaleString()} registros
                </p>
                <div className="flex items-center gap-2">
                  <button disabled={page <= 1} onClick={() => setPage(page - 1)} className="btn-secondary p-2 disabled:opacity-50">
                    <ChevronLeft className="w-4 h-4" />
                  </button>
                  <span className="text-sm text-slate-600 dark:text-slate-400">{page}/{totalPages || 1}</span>
                  <button disabled={page >= totalPages} onClick={() => setPage(page + 1)} className="btn-secondary p-2 disabled:opacity-50">
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </>
          )}
        </div>
      )}

      {tab === "timeline" && (
        <div className="space-y-4">
          <div className="card p-4">
            <h3 className="font-semibold text-slate-900 dark:text-white mb-3 flex items-center gap-2">
              <Clock className="w-4 h-4" /> Línea de Vida de Entidad
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">Tipo de Entidad</label>
                <select className="input-field" value={tlEntity} onChange={(e) => setTlEntity(e.target.value)}>
                  {entityTypes.map((et) => <option key={et} value={et}>{getEntityLabel(et)}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">ID de Entidad</label>
                <input className="input-field" placeholder="UUID..." value={tlEntityId} onChange={(e) => setTlEntityId(e.target.value)} />
              </div>
              <div className="flex items-end">
                <button onClick={fetchTimeline} className="btn-primary w-full flex items-center justify-center gap-2">
                  <Filter className="w-4 h-4" /> Consultar
                </button>
              </div>
            </div>
          </div>

          {tlLoading ? (
            <div className="card p-8 text-center text-slate-500 dark:text-slate-400">Cargando...</div>
          ) : tlEvents.length > 0 ? (
            <div className="relative">
              <div className="absolute left-5 top-0 bottom-0 w-0.5 bg-slate-200 dark:bg-slate-700" />
              <div className="space-y-4">
                {tlEvents.map((ev, i) => (
                  <div key={ev.id} className="relative pl-12">
                    <div className={`absolute left-3.5 w-3 h-3 rounded-full border-2 ${
                      ev.action.includes("create") ? "bg-green-500 border-green-300 dark:border-green-700"
                        : ev.action.includes("delete") || ev.action.includes("cancel") ? "bg-red-500 border-red-300 dark:border-red-700"
                        : "bg-blue-500 border-blue-300 dark:border-blue-700"
                    }`} style={{ top: "0.5rem" }} />
                    <div className="card p-4">
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-2">
                        <div className="flex items-center gap-2">
                          <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${
                            ev.action.includes("create") ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400"
                              : ev.action.includes("delete") || ev.action.includes("cancel") ? "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400"
                              : "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400"
                          }`}>
                            {getActionLabel(ev.action)}
                          </span>
                          <span className="text-sm text-slate-600 dark:text-slate-400">{ev.userName || "Sistema"}</span>
                        </div>
                        <span className="text-xs font-mono text-slate-500 dark:text-slate-400">
                          {new Date(ev.createdAt).toLocaleString("es-CO")}
                        </span>
                      </div>

                      {(ev.beforeState || ev.afterState) && (
                        <div className="mt-2 border-t border-slate-100 dark:border-slate-700 pt-2">
                          <div className="grid grid-cols-3 gap-2 text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">
                            <span>Campo</span>
                            <span className="text-red-600 dark:text-red-400">Antes</span>
                            <span className="text-green-600 dark:text-green-400">Después</span>
                          </div>
                          <DiffViewer before={ev.beforeState} after={ev.afterState} />
                        </div>
                      )}

                      {ev.changeReason && (
                        <p className="mt-2 text-xs text-slate-500 dark:text-slate-400 italic">Motivo: {ev.changeReason}</p>
                      )}

                      {ev.checksum && (
                        <p className="mt-1 text-[10px] font-mono text-slate-400 dark:text-slate-500 truncate">
                          SHA-256: {ev.checksum}
                        </p>
                      )}
                    </div>
                  </div>
                ))}
              </div>

              {tlTotalPages > 1 && (
                <div className="flex items-center justify-center gap-2 mt-4">
                  <button disabled={tlPage <= 1} onClick={() => { setTlPage(tlPage - 1); fetchTimeline(); }} className="btn-secondary p-2 disabled:opacity-50">
                    <ChevronLeft className="w-4 h-4" />
                  </button>
                  <span className="text-sm text-slate-600 dark:text-slate-400">{tlPage}/{tlTotalPages}</span>
                  <button disabled={tlPage >= tlTotalPages} onClick={() => { setTlPage(tlPage + 1); fetchTimeline(); }} className="btn-secondary p-2 disabled:opacity-50">
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              )}
            </div>
          ) : tlEntityId ? (
            <div className="card p-8 text-center text-slate-500 dark:text-slate-400">
              <Clock className="w-8 h-8 mx-auto mb-2 opacity-50" />
              No se encontraron eventos para esta entidad
            </div>
          ) : null}
        </div>
      )}

      {selectedLog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={() => setSelectedLog(null)} role="dialog" aria-modal="true" onKeyDown={(e) => e.key === "Escape" && setSelectedLog(null)}>
          <div className="bg-white dark:bg-[#141925] rounded-xl border border-slate-200 dark:border-slate-700 shadow-2xl w-full max-w-2xl max-h-[80vh] overflow-y-auto" onClick={(e) => e.stopPropagation()} role="document">
            <div className="p-6 space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-bold text-slate-900 dark:text-white">Detalle de Auditoría</h3>
                <button onClick={() => setSelectedLog(null)} className="p-1 hover:bg-slate-100 dark:hover:bg-slate-800 rounded">
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="grid grid-cols-2 gap-3 text-sm">
                <div>
                  <span className="text-xs text-slate-500 dark:text-slate-400">Acción</span>
                  <p className="font-medium text-slate-900 dark:text-white">{getActionLabel(selectedLog.action)}</p>
                </div>
                <div>
                  <span className="text-xs text-slate-500 dark:text-slate-400">Entidad</span>
                  <p className="font-medium text-slate-900 dark:text-white">{selectedLog.entity ? getEntityLabel(selectedLog.entity) : "—"}</p>
                </div>
                <div>
                  <span className="text-xs text-slate-500 dark:text-slate-400">Usuario</span>
                  <p className="font-medium text-slate-900 dark:text-white">{selectedLog.userName || "—"}</p>
                </div>
                <div>
                  <span className="text-xs text-slate-500 dark:text-slate-400">Fecha</span>
                  <p className="font-medium text-slate-900 dark:text-white">{new Date(selectedLog.createdAt).toLocaleString("es-CO")}</p>
                </div>
                <div>
                  <span className="text-xs text-slate-500 dark:text-slate-400">IP</span>
                  <p className="font-mono text-xs text-slate-900 dark:text-white">{selectedLog.ipAddress || "—"}</p>
                </div>
                <div>
                  <span className="text-xs text-slate-500 dark:text-slate-400">Fuente</span>
                  <p className="font-medium text-slate-900 dark:text-white">{selectedLog.source}</p>
                </div>
              </div>

              {selectedLog.entityId && (
                <div>
                  <span className="text-xs text-slate-500 dark:text-slate-400">Entity ID</span>
                  <p className="font-mono text-xs text-slate-900 dark:text-white break-all">{selectedLog.entityId}</p>
                </div>
              )}

              {selectedLog.changeReason && (
                <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg p-3">
                  <span className="text-xs font-medium text-amber-700 dark:text-amber-400">Motivo del cambio</span>
                  <p className="text-sm text-amber-800 dark:text-amber-300 mt-1">{selectedLog.changeReason}</p>
                </div>
              )}

              {(selectedLog.beforeState || selectedLog.afterState) && (
                <div>
                  <h4 className="text-sm font-semibold text-slate-900 dark:text-white mb-2 flex items-center gap-1">
                    <ArrowUpDown className="w-4 h-4" /> Cambios (Before → After)
                  </h4>
                  <DiffViewer before={selectedLog.beforeState} after={selectedLog.afterState} />
                </div>
              )}

              {selectedLog.details && Object.keys(selectedLog.details).length > 0 && (
                <div>
                  <h4 className="text-sm font-semibold text-slate-900 dark:text-white mb-2">Detalles adicionales</h4>
                  <pre className="bg-slate-50 dark:bg-slate-800/50 rounded-lg p-3 text-xs font-mono overflow-auto max-h-48">
                    {JSON.stringify(selectedLog.details, null, 2)}
                  </pre>
                </div>
              )}

              {selectedLog.checksum && (
                <div>
                  <span className="text-xs text-slate-500 dark:text-slate-400">Checksum (SHA-256)</span>
                  <p className="font-mono text-[10px] text-slate-600 dark:text-slate-400 break-all">{selectedLog.checksum}</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
