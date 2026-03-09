"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Calculator,
  Plus,
  ChevronLeft,
  Loader2,
  X,
  Users,
  DollarSign,
  TrendingDown,
  Briefcase,
  Wallet,
} from "lucide-react";
import PageHeader from "@/components/molecules/PageHeader";
import { Button } from "@/components/atoms";
import Toast from "@/components/ui/Toast";

const CURRENCY = new Intl.NumberFormat("es-CO", {
  style: "currency",
  currency: "COP",
  minimumFractionDigits: 0,
});

const STATUS_LABELS: Record<string, string> = {
  DRAFT: "Borrador",
  CALCULATED: "Calculada",
  APPROVED: "Aprobada",
  PAID: "Pagada",
  CANCELLED: "Cancelada",
};

const STATUS_CLASSES: Record<string, string> = {
  DRAFT: "bg-slate-100 text-slate-700 dark:bg-slate-500/10 dark:text-slate-400 dark:ring-slate-500/20 ring-1 ring-inset ring-slate-600/10",
  CALCULATED: "bg-blue-100 text-blue-700 dark:bg-blue-500/10 dark:text-blue-400 dark:ring-blue-500/20 ring-1 ring-inset ring-blue-600/10",
  APPROVED: "bg-amber-100 text-amber-700 dark:bg-amber-500/10 dark:text-amber-400 dark:ring-amber-500/20 ring-1 ring-inset ring-amber-600/10",
  PAID: "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400 dark:ring-emerald-500/20 ring-1 ring-inset ring-emerald-600/10",
  CANCELLED: "bg-red-100 text-red-700 dark:bg-red-500/10 dark:text-red-400 dark:ring-red-500/20 ring-1 ring-inset ring-red-600/10",
};

const FREQUENCY_LABELS: Record<string, string> = {
  MONTHLY: "Mensual",
  BIWEEKLY: "Quincenal",
  WEEKLY: "Semanal",
};

type PayrollRunStatus = "DRAFT" | "CALCULATED" | "APPROVED" | "PAID" | "CANCELLED";
type PayrollFrequency = "MONTHLY" | "BIWEEKLY" | "WEEKLY";

interface PayrollRunListItem {
  id: string;
  period: string;
  periodStart: string;
  periodEnd: string;
  frequency: PayrollFrequency;
  status: PayrollRunStatus;
  notes: string | null;
  totalEarnings: number | null;
  totalDeductions: number | null;
  totalEmployerCosts: number | null;
  netPay: number | null;
  _count: { items: number };
}

interface PayrollItemDetail {
  id: string;
  conceptCode: string;
  conceptName: string;
  type: string;
  amount: number | string;
}

interface PayrollItem {
  id: string;
  totalEarnings: number | string;
  totalDeductions: number | string;
  employerCosts: number | string;
  netPay: number | string;
  employee: {
    id: string;
    firstName: string;
    lastName: string;
    docNumber: string | null;
    position: string | null;
  };
  details: PayrollItemDetail[];
}

interface PayrollRunDetail extends PayrollRunListItem {
  items: PayrollItem[];
}

function formatDate(d: string | Date) {
  return new Date(d).toLocaleDateString("es-CO");
}

function toNum(v: number | string | null | undefined): number {
  if (v == null) return 0;
  return typeof v === "string" ? Number.parseFloat(v) || 0 : v;
}

export default function NominaPage() {
  const [runs, setRuns] = useState<PayrollRunListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedRun, setSelectedRun] = useState<PayrollRunDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [creating, setCreating] = useState(false);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [toast, setToast] = useState<{ message: string; type: "success" | "error" } | null>(null);

  const [formPeriod, setFormPeriod] = useState("");
  const [formStart, setFormStart] = useState("");
  const [formEnd, setFormEnd] = useState("");
  const [formFrequency, setFormFrequency] = useState<PayrollFrequency>("MONTHLY");
  const [formNotes, setFormNotes] = useState("");

  const fetchRuns = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/payroll");
      if (res.ok) {
        const data = await res.json();
        setRuns(Array.isArray(data) ? data : []);
      } else {
        setRuns([]);
      }
    } catch {
      setRuns([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchRuns();
  }, [fetchRuns]);

  useEffect(() => {
    if (!showCreateModal) return;
    const h = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !creating) setShowCreateModal(false);
    };
    document.addEventListener("keydown", h);
    return () => document.removeEventListener("keydown", h);
  }, [showCreateModal, creating]);

  const fetchRunDetail = useCallback(async (id: string) => {
    setDetailLoading(true);
    setSelectedRun(null);
    try {
      const res = await fetch(`/api/payroll/${id}`);
      if (res.ok) {
        const data = await res.json();
        setSelectedRun(data);
      } else {
        const err = await res.json();
        setToast({ message: err?.error || "Error al cargar nómina", type: "error" });
      }
    } catch {
      setToast({ message: "Error al cargar nómina", type: "error" });
    } finally {
      setDetailLoading(false);
    }
  }, []);

  const handleRunAction = useCallback(
    async (runId: string, action: "calculate" | "approve" | "pay" | "cancel") => {
      setActionLoading(action);
      try {
        const res = await fetch(`/api/payroll/${runId}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action }),
        });
        const data = await res.json();
        if (res.ok) {
          setToast({ message: "Acción realizada correctamente", type: "success" });
          await fetchRuns();
          if (selectedRun?.id === runId) {
            await fetchRunDetail(runId);
          }
        } else {
          setToast({ message: data?.error || "Error al ejecutar acción", type: "error" });
        }
      } catch {
        setToast({ message: "Error al ejecutar acción", type: "error" });
      } finally {
        setActionLoading(null);
      }
    },
    [fetchRuns, fetchRunDetail, selectedRun?.id]
  );

  const handleCreateRun = useCallback(async () => {
    if (!formPeriod || !formStart || !formEnd) {
      setToast({ message: "Completa periodo, fecha inicio y fecha fin", type: "error" });
      return;
    }
    setCreating(true);
    try {
      const res = await fetch("/api/payroll", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          period: formPeriod,
          periodStart: formStart,
          periodEnd: formEnd,
          frequency: formFrequency,
          notes: formNotes || null,
        }),
      });
      const data = await res.json();
      if (res.ok) {
        setToast({ message: "Nómina creada correctamente", type: "success" });
        setShowCreateModal(false);
        setFormPeriod("");
        setFormStart("");
        setFormEnd("");
        setFormFrequency("MONTHLY");
        setFormNotes("");
        await fetchRuns();
      } else {
        setToast({ message: data?.error || "Error al crear nómina", type: "error" });
      }
    } catch {
      setToast({ message: "Error al crear nómina", type: "error" });
    } finally {
      setCreating(false);
    }
  }, [formPeriod, formStart, formEnd, formFrequency, formNotes, fetchRuns]);

  return (
    <div className="space-y-6">
      <PageHeader
        icon={<Calculator className="w-full h-full" />}
        title="Nómina"
        actions={
          <Button
            variant="primary"
            icon={<Plus className="w-4 h-4" />}
            onClick={() => setShowCreateModal(true)}
          >
            <span className="hidden sm:inline">Nueva nómina</span>
          </Button>
        }
      />

      {loading ? (
        <div className="card p-12 flex items-center justify-center gap-2 text-slate-500 dark:text-slate-400">
          <Loader2 className="w-6 h-6 animate-spin" />
          Cargando nóminas...
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className={selectedRun ? "lg:col-span-1" : "lg:col-span-3"}>
            <div className="card overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr>
                      <th className="table-header">Período</th>
                      <th className="table-header">Estado</th>
                      <th className="table-header text-right hidden sm:table-cell">Total</th>
                      <th className="table-header text-center">Empleados</th>
                      <th className="table-header w-10" />
                    </tr>
                  </thead>
                  <tbody>
                    {runs.map((run) => (
                      <tr
                        key={run.id}
                        className={`border-t border-slate-100 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-white/[0.02] cursor-pointer transition-colors ${
                          selectedRun?.id === run.id ? "bg-violet-50/50 dark:bg-violet-500/5" : ""
                        }`}
                        onClick={() => fetchRunDetail(run.id)}
                      >
                        <td className="table-cell">
                          <div className="font-medium text-slate-900 dark:text-white">
                            {formatDate(run.period)}
                          </div>
                          <div className="text-xs text-slate-500 dark:text-slate-400">
                            {formatDate(run.periodStart)} – {formatDate(run.periodEnd)}
                          </div>
                        </td>
                        <td className="table-cell">
                          <span
                            className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold ${
                              STATUS_CLASSES[run.status] ?? STATUS_CLASSES.DRAFT
                            }`}
                          >
                            {STATUS_LABELS[run.status] ?? run.status}
                          </span>
                        </td>
                        <td className="table-cell text-right font-medium hidden sm:table-cell">
                          {run.status === "DRAFT" ? "—" : CURRENCY.format(toNum(run.netPay))}
                        </td>
                        <td className="table-cell text-center">
                          <span className="inline-flex items-center gap-1">
                            <Users className="w-3.5 h-3.5 text-slate-400" />
                            {run._count?.items ?? 0}
                          </span>
                        </td>
                        <td className="table-cell">
                          <ChevronLeft
                            className={`w-4 h-4 text-slate-400 transition-transform ${
                              selectedRun?.id === run.id ? "rotate-180" : ""
                            }`}
                          />
                        </td>
                      </tr>
                    ))}
                    {runs.length === 0 && (
                      <tr>
                        <td colSpan={5} className="table-cell text-center py-12 text-slate-500 dark:text-slate-400">
                          No hay nóminas. Crea una nueva para comenzar.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          {selectedRun !== null && (
            <div className="lg:col-span-2 space-y-4">
              {detailLoading ? (
                <div className="card p-12 flex items-center justify-center gap-2 text-slate-500 dark:text-slate-400">
                  <Loader2 className="w-6 h-6 animate-spin" />
                  Cargando detalle...
                </div>
              ) : (
                <>
                  <div className="card p-4 sm:p-6">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-4">
                      <div>
                        <h2 className="text-lg font-bold text-slate-900 dark:text-white">
                          Nómina {formatDate(selectedRun.period)}
                        </h2>
                        <p className="text-sm text-slate-500 dark:text-slate-400">
                          {formatDate(selectedRun.periodStart)} – {formatDate(selectedRun.periodEnd)} ·{" "}
                          {FREQUENCY_LABELS[selectedRun.frequency] ?? selectedRun.frequency}
                        </p>
                      </div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setSelectedRun(null)}
                          className="lg:hidden"
                        >
                          <X className="w-4 h-4" />
                        </Button>
                        {selectedRun.status === "DRAFT" && (
                          <Button
                            variant="primary"
                            loading={actionLoading === "calculate"}
                            onClick={() => handleRunAction(selectedRun.id, "calculate")}
                          >
                            Calcular
                          </Button>
                        )}
                        {selectedRun.status === "CALCULATED" && (
                          <Button
                            variant="primary"
                            loading={actionLoading === "approve"}
                            onClick={() => handleRunAction(selectedRun.id, "approve")}
                          >
                            Aprobar
                          </Button>
                        )}
                        {selectedRun.status === "APPROVED" && (
                          <Button
                            variant="success"
                            loading={actionLoading === "pay"}
                            onClick={() => handleRunAction(selectedRun.id, "pay")}
                          >
                            Pagar
                          </Button>
                        )}
                        {selectedRun.status !== "PAID" && selectedRun.status !== "CANCELLED" && (
                          <Button
                            variant="danger"
                            loading={actionLoading === "cancel"}
                            onClick={() => handleRunAction(selectedRun.id, "cancel")}
                          >
                            Cancelar
                          </Button>
                        )}
                      </div>
                    </div>

                    {selectedRun.status !== "DRAFT" && selectedRun.items?.length > 0 && (
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4 mt-4">
                        <div className="rounded-xl bg-slate-50 dark:bg-slate-800/50 p-3 sm:p-4">
                          <div className="flex items-center gap-2 text-slate-500 dark:text-slate-400 text-xs sm:text-sm">
                            <DollarSign className="w-4 h-4 shrink-0" />
                            Devengados
                          </div>
                          <p className="font-bold text-slate-900 dark:text-white mt-1 text-sm sm:text-base truncate">
                            {CURRENCY.format(toNum(selectedRun.totalEarnings))}
                          </p>
                        </div>
                        <div className="rounded-xl bg-slate-50 dark:bg-slate-800/50 p-3 sm:p-4">
                          <div className="flex items-center gap-2 text-slate-500 dark:text-slate-400 text-xs sm:text-sm">
                            <TrendingDown className="w-4 h-4 shrink-0" />
                            Deducciones
                          </div>
                          <p className="font-bold text-slate-900 dark:text-white mt-1 text-sm sm:text-base truncate">
                            {CURRENCY.format(toNum(selectedRun.totalDeductions))}
                          </p>
                        </div>
                        <div className="rounded-xl bg-slate-50 dark:bg-slate-800/50 p-3 sm:p-4">
                          <div className="flex items-center gap-2 text-slate-500 dark:text-slate-400 text-xs sm:text-sm">
                            <Briefcase className="w-4 h-4 shrink-0" />
                            Costos empleador
                          </div>
                          <p className="font-bold text-slate-900 dark:text-white mt-1 text-sm sm:text-base truncate">
                            {CURRENCY.format(toNum(selectedRun.totalEmployerCosts))}
                          </p>
                        </div>
                        <div className="rounded-xl bg-emerald-50 dark:bg-emerald-500/10 p-3 sm:p-4">
                          <div className="flex items-center gap-2 text-emerald-600 dark:text-emerald-400 text-xs sm:text-sm">
                            <Wallet className="w-4 h-4 shrink-0" />
                            Neto a pagar
                          </div>
                          <p className="font-bold text-emerald-700 dark:text-emerald-300 mt-1 text-sm sm:text-base truncate">
                            {CURRENCY.format(toNum(selectedRun.netPay))}
                          </p>
                        </div>
                      </div>
                    )}
                  </div>

                  {selectedRun.items && selectedRun.items.length > 0 && (
                    <div className="card overflow-hidden">
                      <h3 className="px-4 sm:px-6 py-3 font-semibold text-slate-900 dark:text-white border-b border-slate-200 dark:border-slate-700">
                        Detalle por empleado
                      </h3>
                      <div className="divide-y divide-slate-100 dark:divide-slate-800 max-h-[400px] overflow-y-auto">
                        {selectedRun.items.map((item) => (
                          <div
                            key={item.id}
                            className="p-4 sm:p-6 hover:bg-slate-50/50 dark:hover:bg-white/[0.02]"
                          >
                            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-2">
                              <div>
                                <p className="font-medium text-slate-900 dark:text-white">
                                  {item.employee?.firstName} {item.employee?.lastName}
                                </p>
                                <p className="text-xs text-slate-500 dark:text-slate-400">
                                  {item.employee?.position ?? "—"} · CC {item.employee?.docNumber ?? "—"}
                                </p>
                              </div>
                              <p className="font-bold text-slate-900 dark:text-white text-sm sm:text-base">
                                {CURRENCY.format(toNum(item.netPay))}
                              </p>
                            </div>
                            {item.details && item.details.length > 0 && (
                              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2 text-xs">
                                {item.details.map((d) => (
                                  <div
                                    key={d.id}
                                    className="flex justify-between py-1 border-b border-slate-100 dark:border-slate-800 last:border-0"
                                  >
                                    <span className="text-slate-600 dark:text-slate-400 truncate">
                                      {d.conceptName}
                                    </span>
                                    <span
                                      className={`font-medium shrink-0 ml-2 ${
                                        d.type === "DEDUCTION"
                                          ? "text-red-600 dark:text-red-400"
                                          : "text-slate-900 dark:text-white"
                                      }`}
                                    >
                                      {d.type === "DEDUCTION" ? "-" : ""}
                                      {CURRENCY.format(toNum(d.amount))}
                                    </span>
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {selectedRun.status === "DRAFT" && (!selectedRun.items || selectedRun.items.length === 0) && (
                    <div className="card p-8 text-center text-slate-500 dark:text-slate-400">
                      <Calculator className="w-10 h-10 mx-auto mb-2 opacity-50" />
                      <p>Ejecuta &quot;Calcular&quot; para generar el detalle de empleados.</p>
                    </div>
                  )}
                </>
              )}
            </div>
          )}
        </div>
      )}

      {showCreateModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 dark:bg-black/70 backdrop-blur-sm"
          onClick={() => !creating && setShowCreateModal(false)}
          role="dialog"
          aria-modal="true"
          aria-labelledby="create-payroll-title"
        >
          <div
            className="bg-white dark:bg-[#141925] rounded-2xl border border-slate-200 dark:border-slate-800 shadow-2xl w-full max-w-md max-h-[90vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between p-5 border-b border-slate-200 dark:border-slate-800">
              <h2 id="create-payroll-title" className="text-lg font-semibold text-slate-900 dark:text-white">
                Nueva nómina
              </h2>
              <button
                onClick={() => !creating && setShowCreateModal(false)}
                aria-label="Cerrar"
                className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-colors"
              >
                <X className="w-5 h-5 text-slate-400" />
              </button>
            </div>
            <form
              className="p-5 space-y-4"
              onSubmit={(e) => {
                e.preventDefault();
                handleCreateRun();
              }}
            >
              <div>
                <label htmlFor="payroll-period" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Fecha período
                </label>
                <input
                  id="payroll-period"
                  type="date"
                  className="input-field min-h-[44px]"
                  value={formPeriod}
                  onChange={(e) => setFormPeriod(e.target.value)}
                  required
                />
              </div>
              <div>
                <label htmlFor="payroll-start" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Fecha inicio
                </label>
                <input
                  id="payroll-start"
                  type="date"
                  className="input-field min-h-[44px]"
                  value={formStart}
                  onChange={(e) => setFormStart(e.target.value)}
                  required
                />
              </div>
              <div>
                <label htmlFor="payroll-end" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Fecha fin
                </label>
                <input
                  id="payroll-end"
                  type="date"
                  className="input-field min-h-[44px]"
                  value={formEnd}
                  onChange={(e) => setFormEnd(e.target.value)}
                  required
                />
              </div>
              <div>
                <label htmlFor="payroll-frequency" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Frecuencia
                </label>
                <select
                  id="payroll-frequency"
                  className="input-field min-h-[44px]"
                  value={formFrequency}
                  onChange={(e) => setFormFrequency(e.target.value as PayrollFrequency)}
                >
                  <option value="MONTHLY">{FREQUENCY_LABELS.MONTHLY}</option>
                  <option value="BIWEEKLY">{FREQUENCY_LABELS.BIWEEKLY}</option>
                  <option value="WEEKLY">{FREQUENCY_LABELS.WEEKLY}</option>
                </select>
              </div>
              <div>
                <label htmlFor="payroll-notes" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Notas (opcional)
                </label>
                <textarea
                  id="payroll-notes"
                  className="input-field min-h-[80px] resize-y"
                  value={formNotes}
                  onChange={(e) => setFormNotes(e.target.value)}
                  placeholder="Observaciones..."
                  rows={3}
                />
              </div>
              <div className="flex gap-2 pt-2">
                <Button
                  type="button"
                  variant="secondary"
                  className="flex-1"
                  onClick={() => !creating && setShowCreateModal(false)}
                  disabled={creating}
                >
                  Cancelar
                </Button>
                <Button type="submit" variant="primary" className="flex-1" loading={creating}>
                  Crear
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {toast && (
        <Toast
          message={toast.message}
          type={toast.type}
          onClose={() => setToast(null)}
        />
      )}
    </div>
  );
}
