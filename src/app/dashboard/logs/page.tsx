"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { PageHeader } from "@/components/molecules";
import { ScrollText, Search, Filter, ChevronLeft, ChevronRight, Clock, User, Globe, Monitor, AlertTriangle, Info, AlertCircle, Bug, ExternalLink } from "lucide-react";
import { formatDate } from "@/lib/utils";
import { getEntityUrl, getEntityLabel, getActionLabel } from "@/lib/entity-urls";

interface LogEntry {
  id: string;
  action: string;
  entity: string | null;
  entityId: string | null;
  userName: string | null;
  userId: string | null;
  level: string;
  source: string;
  path: string | null;
  method: string | null;
  statusCode: number | null;
  duration: number | null;
  ipAddress: string | null;
  userAgent: string | null;
  details: Record<string, unknown> | null;
  createdAt: string;
}

interface LogResponse {
  logs: LogEntry[];
  total: number;
  page: number;
  totalPages: number;
}

const LEVEL_STYLES: Record<string, { icon: typeof Info; color: string; bg: string }> = {
  info: { icon: Info, color: "text-blue-600 dark:text-blue-400", bg: "bg-blue-100 dark:bg-blue-500/10" },
  warn: { icon: AlertTriangle, color: "text-amber-600 dark:text-amber-400", bg: "bg-amber-100 dark:bg-amber-500/10" },
  error: { icon: AlertCircle, color: "text-red-600 dark:text-red-400", bg: "bg-red-100 dark:bg-red-500/10" },
  debug: { icon: Bug, color: "text-slate-500 dark:text-slate-400", bg: "bg-slate-100 dark:bg-slate-500/10" },
};

const SOURCE_STYLES: Record<string, { icon: typeof Monitor; label: string }> = {
  backend: { icon: Globe, label: "Backend" },
  frontend: { icon: Monitor, label: "Frontend" },
};

export default function LogsPage() {
  const [data, setData] = useState<LogResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [level, setLevel] = useState("");
  const [source, setSource] = useState("");
  const [userId, setUserId] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [expanded, setExpanded] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams();
    params.set("page", String(page));
    params.set("limit", "30");
    if (search) params.set("search", search);
    if (level) params.set("level", level);
    if (source) params.set("source", source);
    if (userId) params.set("userId", userId);
    if (dateFrom) params.set("from", dateFrom);
    if (dateTo) params.set("to", dateTo);

    try {
      const res = await fetch(`/api/logs?${params}`);
      if (res.ok) setData(await res.json());
    } finally {
      setLoading(false);
    }
  }, [page, search, level, source, userId, dateFrom, dateTo]);

  useEffect(() => { load(); }, [load]);

  function resetFilters() {
    setSearch(""); setLevel(""); setSource(""); setUserId("");
    setDateFrom(""); setDateTo(""); setPage(1);
  }

  return (
    <div className="space-y-4 sm:space-y-6">
      <PageHeader title="Registro de Actividad" subtitle="Historial completo de acciones del sistema" icon={<ScrollText className="w-6 h-6" />} />

      {/* Filters */}
      <div className="card p-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-6 gap-3">
          <div className="relative sm:col-span-2">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text"
              placeholder="Buscar acción, entidad, usuario..."
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(1); }}
              className="input pl-10 w-full"
            />
          </div>

          <select value={level} onChange={(e) => { setLevel(e.target.value); setPage(1); }} className="input">
            <option value="">Todos los niveles</option>
            <option value="info">Info</option>
            <option value="warn">Warning</option>
            <option value="error">Error</option>
            <option value="debug">Debug</option>
          </select>

          <select value={source} onChange={(e) => { setSource(e.target.value); setPage(1); }} className="input">
            <option value="">Todas las fuentes</option>
            <option value="backend">Backend</option>
            <option value="frontend">Frontend</option>
          </select>

          <input type="date" value={dateFrom} onChange={(e) => { setDateFrom(e.target.value); setPage(1); }} className="input" />
          <input type="date" value={dateTo} onChange={(e) => { setDateTo(e.target.value); setPage(1); }} className="input" />
        </div>

        <div className="flex items-center gap-2 mt-3">
          <button onClick={resetFilters} className="btn-secondary text-sm flex items-center gap-1">
            <Filter className="w-3.5 h-3.5" /> Limpiar filtros
          </button>
          {data && (
            <span className="text-sm text-slate-500 dark:text-slate-400 ml-auto">
              {data.total.toLocaleString()} registros encontrados
            </span>
          )}
        </div>
      </div>

      {/* Log entries */}
      <div className="space-y-2">
        {loading && !data && (
          <div className="card p-12 text-center text-slate-500 dark:text-slate-400">Cargando registros...</div>
        )}

        {data?.logs.map((log) => {
          const levelStyle = LEVEL_STYLES[log.level] || LEVEL_STYLES.info;
          const sourceStyle = SOURCE_STYLES[log.source] || SOURCE_STYLES.backend;
          const LevelIcon = levelStyle.icon;
          const SourceIcon = sourceStyle.icon;
          const isExpanded = expanded === log.id;

          return (
            <button
              type="button"
              key={log.id}
              className="card hover:shadow-md transition-shadow cursor-pointer w-full text-left"
              onClick={() => setExpanded(isExpanded ? null : log.id)}
            >
              <div className="p-3 sm:p-4">
                <div className="flex items-start gap-3">
                  <div className={`p-2 rounded-lg ${levelStyle.bg} shrink-0`}>
                    <LevelIcon className={`w-4 h-4 ${levelStyle.color}`} />
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-2 mb-1">
                      <span className="font-semibold text-sm text-slate-900 dark:text-white">{getActionLabel(log.action)}</span>
                      <span className="text-xs text-slate-400 font-mono">{log.action}</span>
                      {log.entity && (() => {
                        const url = getEntityUrl(log.entity, log.entityId);
                        return (
                          <span className="text-xs px-2 py-0.5 rounded-full bg-violet-100 dark:bg-violet-500/10 text-violet-700 dark:text-violet-300 inline-flex items-center gap-1">
                            {getEntityLabel(log.entity)}
                            {log.details?.name && (
                              <span className="font-medium">{String(log.details.name)}</span>
                            )}
                            {log.details?.number && (
                              <span className="font-mono opacity-70">{String(log.details.number)}</span>
                            )}
                            {url && (
                              <Link href={url} onClick={(e) => e.stopPropagation()} className="hover:underline ml-0.5">
                                <ExternalLink className="w-3 h-3" />
                              </Link>
                            )}
                          </span>
                        );
                      })()}
                      {log.method && log.path && (
                        <span className="text-xs text-slate-500 dark:text-slate-400 font-mono">
                          {log.method} {log.path}
                        </span>
                      )}
                      {!!log.statusCode && (
                        <span className={`text-xs font-mono ${log.statusCode >= 400 ? "text-red-500" : "text-emerald-500"}`}>
                          {log.statusCode}
                        </span>
                      )}
                      {typeof log.duration === "number" && (
                        <span className="text-xs text-slate-400">{log.duration}ms</span>
                      )}
                    </div>

                    <div className="flex flex-wrap items-center gap-3 text-xs text-slate-500 dark:text-slate-400">
                      {log.userName && (
                        <span className="flex items-center gap-1">
                          <User className="w-3 h-3" /> {log.userName}
                        </span>
                      )}
                      <span className="flex items-center gap-1">
                        <SourceIcon className="w-3 h-3" /> {sourceStyle.label}
                      </span>
                      <span className="flex items-center gap-1">
                        <Clock className="w-3 h-3" /> {formatDate(log.createdAt)}
                      </span>
                      {log.ipAddress && (
                        <span className="hidden sm:flex items-center gap-1">
                          <Globe className="w-3 h-3" /> {log.ipAddress}
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                {isExpanded && (
                  <div className="mt-3 pt-3 border-t border-slate-100 dark:border-slate-800">
                    <dl className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-sm">
                      <div><dt className="text-slate-500 dark:text-slate-400 text-xs">ID</dt><dd className="font-mono text-xs">{log.id}</dd></div>
                      {log.userId && <div><dt className="text-slate-500 dark:text-slate-400 text-xs">User ID</dt><dd className="font-mono text-xs">{log.userId}</dd></div>}
                      {log.ipAddress && <div><dt className="text-slate-500 dark:text-slate-400 text-xs">IP</dt><dd className="font-mono text-xs">{log.ipAddress}</dd></div>}
                      {log.userAgent && <div className="sm:col-span-2"><dt className="text-slate-500 dark:text-slate-400 text-xs">User Agent</dt><dd className="font-mono text-xs truncate">{log.userAgent}</dd></div>}
                      {log.details && (
                        <div className="sm:col-span-2">
                          <dt className="text-slate-500 dark:text-slate-400 text-xs mb-1">Detalles</dt>
                          <dd className="font-mono text-xs bg-slate-50 dark:bg-slate-900 p-2 rounded overflow-auto max-h-40">
                            <pre>{JSON.stringify(log.details, null, 2)}</pre>
                          </dd>
                        </div>
                      )}
                    </dl>
                  </div>
                )}
              </div>
            </button>
          );
        })}

        {data && data.logs.length === 0 && (
          <div className="card p-12 text-center text-slate-500 dark:text-slate-400">
            No se encontraron registros con los filtros actuales
          </div>
        )}
      </div>

      {/* Pagination */}
      {data && data.totalPages > 1 && (
        <div className="flex items-center justify-between">
          <span className="text-sm text-slate-500 dark:text-slate-400">
            Página {data.page} de {data.totalPages}
          </span>
          <div className="flex gap-2">
            <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page <= 1} className="btn-secondary p-2 disabled:opacity-40">
              <ChevronLeft className="w-4 h-4" />
            </button>
            <button onClick={() => setPage((p) => Math.min(data.totalPages, p + 1))} disabled={page >= data.totalPages} className="btn-secondary p-2 disabled:opacity-40">
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
