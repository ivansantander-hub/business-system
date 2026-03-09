"use client";

import { useState, useEffect, useCallback } from "react";
import {
  FileText,
  Settings,
  Shield,
  CheckCircle,
  AlertTriangle,
  XCircle,
  ToggleLeft,
  ToggleRight,
  Save,
  Plug,
  Wifi,
  WifiOff,
  Loader2,
} from "lucide-react";
import Toast from "@/components/ui/Toast";
import { Button } from "@/components/atoms";
import { PageHeader } from "@/components/molecules";
import { formatCurrency, formatDate } from "@/lib/utils";
import { SUPPORTED_PROVIDERS } from "@/lib/dian";

interface CompanyConfig {
  electronicInvoicingEnabled: boolean;
  dianResolution: string | null;
  dianPrefix: string | null;
  dianRangeFrom: number | null;
  dianRangeTo: number | null;
  dianTechnicalKey: string | null;
  dianEnvironment: string | null;
  dianSoftwareId: string | null;
  dianSoftwarePin: string | null;
  dianTestSetId: string | null;
  eInvoiceProvider: string | null;
  eInvoiceProviderApiUrl: string | null;
  eInvoiceProviderApiKey: string | null;
  eInvoiceProviderUser: string | null;
  eInvoiceProviderPass: string | null;
}

type ConnectionStatus = "not_connected" | "testing" | "connected";

interface Invoice {
  id: string;
  number: string;
  date: string;
  total: string;
  status: string;
  cufe: string | null;
  qrCode: string | null;
  dianStatus: string | null;
  dianResponseDate: string | null;
  dianResponseMessage: string | null;
  customer: { name: string; nit: string | null } | null;
}

const DIAN_STATUS_LABELS: Record<string, string> = {
  GENERATED: "Generada",
  ACCEPTED: "Aceptada",
  REJECTED: "Rechazada",
  PENDING: "Pendiente",
};

const DIAN_STATUS_COLORS: Record<string, string> = {
  GENERATED: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
  ACCEPTED: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400",
  REJECTED: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",
  PENDING: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400",
};

function parseInvoiceNumber(num: string): number | null {
  const numericPart = num.replaceAll(/\D/g, "");
  if (!numericPart) return null;
  const parsed = Number.parseInt(numericPart, 10);
  return Number.isNaN(parsed) ? null : parsed;
}

export default function FacturacionElectronicaPage() {
  const [config, setConfig] = useState<CompanyConfig>({
    electronicInvoicingEnabled: false,
    dianResolution: null,
    dianPrefix: null,
    dianRangeFrom: null,
    dianRangeTo: null,
    dianTechnicalKey: null,
    dianEnvironment: null,
    dianSoftwareId: null,
    dianSoftwarePin: null,
    dianTestSetId: null,
    eInvoiceProvider: null,
    eInvoiceProviderApiUrl: null,
    eInvoiceProviderApiKey: null,
    eInvoiceProviderUser: null,
    eInvoiceProviderPass: null,
  });
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>("not_connected");
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: "success" | "error" } | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [configRes, invoicesRes] = await Promise.all([
        fetch("/api/company/config"),
        fetch("/api/invoices?limit=10"),
      ]);
      if (configRes.ok) {
        const data = await configRes.json();
        setConfig({
          electronicInvoicingEnabled: data.electronicInvoicingEnabled ?? false,
          dianResolution: data.dianResolution ?? null,
          dianPrefix: data.dianPrefix ?? null,
          dianRangeFrom: data.dianRangeFrom ?? null,
          dianRangeTo: data.dianRangeTo ?? null,
          dianTechnicalKey: data.dianTechnicalKey ?? null,
          dianEnvironment: data.dianEnvironment ?? null,
          dianSoftwareId: data.dianSoftwareId ?? null,
          dianSoftwarePin: data.dianSoftwarePin ?? null,
          dianTestSetId: data.dianTestSetId ?? null,
          eInvoiceProvider: data.eInvoiceProvider ?? null,
          eInvoiceProviderApiUrl: data.eInvoiceProviderApiUrl ?? null,
          eInvoiceProviderApiKey: data.eInvoiceProviderApiKey ?? null,
          eInvoiceProviderUser: data.eInvoiceProviderUser ?? null,
          eInvoiceProviderPass: data.eInvoiceProviderPass ?? null,
        });
      }
      if (invoicesRes.ok) {
        setInvoices(await invoicesRes.json());
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function saveConfig(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSaving(true);
    try {
      const res = await fetch("/api/company/config", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(config),
      });
      if (res.ok) {
        setToast({ message: "Configuración guardada correctamente", type: "success" });
        load();
      } else {
        setToast({ message: "Error al guardar", type: "error" });
      }
    } finally {
      setSaving(false);
    }
  }

  async function testConnection() {
    setConnectionStatus("testing");
    try {
      const res = await fetch("/api/company/config");
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      if (data.electronicInvoicingEnabled && data.eInvoiceProvider) {
        setToast({ message: `Conexión verificada con proveedor: ${data.eInvoiceProvider}`, type: "success" });
        setConnectionStatus("connected");
      } else {
        setToast({ message: "Facturación electrónica no está habilitada", type: "error" });
        setConnectionStatus("not_connected");
      }
    } catch {
      setToast({ message: "Error al verificar conexión con el servidor", type: "error" });
      setConnectionStatus("not_connected");
    }
  }

  async function toggleEInvoicing() {
    const next = !config.electronicInvoicingEnabled;
    setSaving(true);
    try {
      const res = await fetch("/api/company/config", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ electronicInvoicingEnabled: next }),
      });
      if (res.ok) {
        setConfig((c) => ({ ...c, electronicInvoicingEnabled: next }));
        setToast({
          message: next ? "Facturación electrónica activada" : "Facturación electrónica desactivada",
          type: "success",
        });
        load();
      } else {
        setToast({ message: "Error al actualizar", type: "error" });
      }
    } finally {
      setSaving(false);
    }
  }

  const lastInvoiceNum = invoices[0] ? parseInvoiceNumber(invoices[0].number) : null;
  const rangeFrom = config.dianRangeFrom ?? 0;
  const rangeTo = config.dianRangeTo ?? 0;
  const remaining =
    config.electronicInvoicingEnabled && rangeFrom && rangeTo && lastInvoiceNum != null
      ? rangeTo - lastInvoiceNum
      : null;
  const rangeWarning = remaining != null && remaining < 100 && remaining >= 0;

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[40vh]">
        <div className="animate-spin w-8 h-8 border-2 border-violet-500 border-t-transparent rounded-full" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}

      <PageHeader
        icon={<FileText className="w-full h-full" />}
        title="Facturación Electrónica"
      />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Status & Toggle */}
        <div className="card">
          <h2 className="font-semibold text-slate-900 dark:text-white mb-4 flex items-center gap-2">
            <Shield className="w-5 h-5" />
            Estado de Facturación Electrónica
          </h2>
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div className="flex items-center gap-3">
              {config.electronicInvoicingEnabled ? (
                <CheckCircle className="w-8 h-8 text-emerald-500" />
              ) : (
                <XCircle className="w-8 h-8 text-slate-400 dark:text-slate-500" />
              )}
              <div>
                <p className="font-medium text-slate-900 dark:text-white">
                  {config.electronicInvoicingEnabled ? "Activa" : "Inactiva"}
                </p>
                <p className="text-sm text-slate-500 dark:text-slate-400">
                  {config.electronicInvoicingEnabled
                    ? "Las facturas se generan con CUFE y cumplen normas DIAN"
                    : "Modo POS: facturación simple sin envío a DIAN"}
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={toggleEInvoicing}
              disabled={saving}
              className="flex items-center gap-2 p-3 rounded-xl bg-slate-100 dark:bg-slate-800/50 hover:bg-slate-200 dark:hover:bg-slate-700/50 transition-colors disabled:opacity-50"
              aria-label={config.electronicInvoicingEnabled ? "Desactivar" : "Activar"}
            >
              {config.electronicInvoicingEnabled ? (
                <ToggleRight className="w-8 h-8 text-emerald-500" />
              ) : (
                <ToggleLeft className="w-8 h-8 text-slate-400" />
              )}
              <span className="text-sm font-medium text-slate-700 dark:text-slate-300">
                {config.electronicInvoicingEnabled ? "Desactivar" : "Activar"}
              </span>
            </button>
          </div>
        </div>

        {/* Range warning */}
        {config.electronicInvoicingEnabled && rangeWarning && remaining != null && (
          <div className="card border-amber-200 dark:border-amber-800 bg-amber-50/50 dark:bg-amber-900/10">
            <div className="flex items-start gap-3">
              <AlertTriangle className="w-6 h-6 text-amber-600 dark:text-amber-400 flex-shrink-0 mt-0.5" />
              <div>
                <p className="font-medium text-amber-800 dark:text-amber-200">
                  Advertencia: quedan {remaining} números en el rango autorizado
                </p>
                <p className="text-sm text-amber-700 dark:text-amber-300 mt-1">
                  Solicite un nuevo rango a la DIAN antes de agotar el actual.
                </p>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Proveedor de Facturación */}
      {config.electronicInvoicingEnabled && (
        <div className="card">
          <h2 className="font-semibold text-slate-900 dark:text-white mb-4 flex items-center gap-2">
            <Plug className="w-5 h-5" />
            Proveedor de Facturación
          </h2>
          <div className="space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div className="flex items-center gap-3">
                {connectionStatus === "connected" && (
                  <Wifi className="w-6 h-6 text-emerald-500" />
                )}
                {connectionStatus === "not_connected" && (
                  <WifiOff className="w-6 h-6 text-slate-400 dark:text-slate-500" />
                )}
                {connectionStatus === "testing" && (
                  <Loader2 className="w-6 h-6 text-amber-500 animate-spin" />
                )}
                <div>
                  <p className="font-medium text-slate-900 dark:text-white">
                    Estado de Conexión
                  </p>
                  <p className="text-sm text-slate-500 dark:text-slate-400">
                    {connectionStatus === "not_connected" && "No conectado"}
                    {connectionStatus === "testing" && "Probando conexión…"}
                    {connectionStatus === "connected" && "Conectado"}
                  </p>
                </div>
              </div>
              <Button
                type="button"
                variant="secondary"
                onClick={testConnection}
                disabled={connectionStatus === "testing"}
                loading={connectionStatus === "testing"}
                icon={<Plug className="w-4 h-4" />}
              >
                Probar Conexión
              </Button>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              <div className="sm:col-span-2 lg:col-span-1">
                <label htmlFor="e-invoice-provider" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Proveedor
                </label>
                <select
                  id="e-invoice-provider"
                  className="input-field w-full"
                  value={config.eInvoiceProvider ?? ""}
                  onChange={(e) =>
                    setConfig({ ...config, eInvoiceProvider: e.target.value || null })
                  }
                >
                  <option value="">Seleccionar proveedor</option>
                  {SUPPORTED_PROVIDERS.map((p) => (
                    <option key={p} value={p}>
                      {p.charAt(0).toUpperCase() + p.slice(1).replace(/_/g, " ")}
                    </option>
                  ))}
                </select>
              </div>
              <div className="sm:col-span-2">
                <label htmlFor="e-invoice-api-url" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                  URL API
                </label>
                <input
                  id="e-invoice-api-url"
                  type="url"
                  className="input-field w-full"
                  value={config.eInvoiceProviderApiUrl ?? ""}
                  onChange={(e) =>
                    setConfig({ ...config, eInvoiceProviderApiUrl: e.target.value || null })
                  }
                  placeholder="https://api.proveedor.com/v1"
                />
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label htmlFor="e-invoice-api-key" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                  API Key
                </label>
                <input
                  id="e-invoice-api-key"
                  type="password"
                  className="input-field w-full"
                  value={config.eInvoiceProviderApiKey ?? ""}
                  onChange={(e) =>
                    setConfig({ ...config, eInvoiceProviderApiKey: e.target.value || null })
                  }
                  placeholder="••••••••••••••••"
                  autoComplete="off"
                />
              </div>
              <div>
                <label htmlFor="e-invoice-user" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Usuario
                </label>
                <input
                  id="e-invoice-user"
                  type="text"
                  className="input-field w-full"
                  value={config.eInvoiceProviderUser ?? ""}
                  onChange={(e) =>
                    setConfig({ ...config, eInvoiceProviderUser: e.target.value || null })
                  }
                  placeholder="Usuario del proveedor"
                />
              </div>
            </div>
            <div>
              <label htmlFor="e-invoice-pass" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                Contraseña
              </label>
              <input
                id="e-invoice-pass"
                type="password"
                className="input-field w-full max-w-md"
                value={config.eInvoiceProviderPass ?? ""}
                onChange={(e) =>
                  setConfig({ ...config, eInvoiceProviderPass: e.target.value || null })
                }
                placeholder="••••••••••••••••"
                autoComplete="off"
              />
            </div>
          </div>
        </div>
      )}

      {/* DIAN Settings Form */}
      {config.electronicInvoicingEnabled && (
        <div className="card">
          <h2 className="font-semibold text-slate-900 dark:text-white mb-4 flex items-center gap-2">
            <Settings className="w-5 h-5" />
            Configuración DIAN
          </h2>
          <form onSubmit={saveConfig} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              <div>
                <label htmlFor="dian-resolution" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Resolución DIAN
                </label>
                <input
                  id="dian-resolution"
                  type="text"
                  className="input-field w-full"
                  value={config.dianResolution ?? ""}
                  onChange={(e) =>
                    setConfig({ ...config, dianResolution: e.target.value || null })
                  }
                  placeholder="Ej: 18764000000001"
                />
              </div>
              <div>
                <label htmlFor="dian-prefix" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Prefijo
                </label>
                <input
                  id="dian-prefix"
                  type="text"
                  className="input-field w-full"
                  value={config.dianPrefix ?? ""}
                  onChange={(e) => setConfig({ ...config, dianPrefix: e.target.value || null })}
                  placeholder="Ej: SETP"
                />
              </div>
              <div>
                <label htmlFor="dian-environment" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Ambiente
                </label>
                <select
                  id="dian-environment"
                  className="input-field w-full"
                  value={config.dianEnvironment ?? ""}
                  onChange={(e) =>
                    setConfig({
                      ...config,
                      dianEnvironment: e.target.value || null,
                    })
                  }
                >
                  <option value="">Seleccionar</option>
                  <option value="HABILITACION">Habilitación (Pruebas)</option>
                  <option value="PRODUCCION">Producción</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label htmlFor="dian-range-from" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Rango Desde
                </label>
                <input
                  id="dian-range-from"
                  type="number"
                  className="input-field w-full"
                  value={config.dianRangeFrom ?? ""}
                  onChange={(e) => {
                    const v = e.target.value;
                    const n = v === "" ? null : Number.parseInt(v, 10);
                    setConfig({
                      ...config,
                      dianRangeFrom:
                        v === "" || (n !== null && !Number.isNaN(n)) ? n : config.dianRangeFrom,
                    });
                  }}
                  placeholder="1"
                />
              </div>
              <div>
                <label htmlFor="dian-range-to" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Rango Hasta
                </label>
                <input
                  id="dian-range-to"
                  type="number"
                  className="input-field w-full"
                  value={config.dianRangeTo ?? ""}
                  onChange={(e) => {
                    const v = e.target.value;
                    const n = v === "" ? null : Number.parseInt(v, 10);
                    setConfig({
                      ...config,
                      dianRangeTo:
                        v === "" || (n !== null && !Number.isNaN(n)) ? n : config.dianRangeTo,
                    });
                  }}
                  placeholder="100000"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label htmlFor="dian-technical-key" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Clave Técnica
                </label>
                <input
                  id="dian-technical-key"
                  type="password"
                  className="input-field w-full"
                  value={config.dianTechnicalKey ?? ""}
                  onChange={(e) =>
                    setConfig({ ...config, dianTechnicalKey: e.target.value || null })
                  }
                  placeholder="Clave para firma CUFE"
                />
              </div>
              <div>
                <label htmlFor="dian-software-id" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Software ID
                </label>
                <input
                  id="dian-software-id"
                  type="text"
                  className="input-field w-full"
                  value={config.dianSoftwareId ?? ""}
                  onChange={(e) =>
                    setConfig({ ...config, dianSoftwareId: e.target.value || null })
                  }
                  placeholder="ID del software ante DIAN"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label htmlFor="dian-software-pin" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Software PIN
                </label>
                <input
                  id="dian-software-pin"
                  type="password"
                  className="input-field w-full"
                  value={config.dianSoftwarePin ?? ""}
                  onChange={(e) =>
                    setConfig({ ...config, dianSoftwarePin: e.target.value || null })
                  }
                  placeholder="PIN del software"
                />
              </div>
              <div>
                <label htmlFor="dian-test-set-id" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Test Set ID
                </label>
                <input
                  id="dian-test-set-id"
                  type="text"
                  className="input-field w-full"
                  value={config.dianTestSetId ?? ""}
                  onChange={(e) =>
                    setConfig({ ...config, dianTestSetId: e.target.value || null })
                  }
                  placeholder="Para ambiente Habilitación"
                />
              </div>
            </div>

            <Button type="submit" icon={<Save className="w-4 h-4" />} disabled={saving}>
              Guardar configuración
            </Button>
          </form>
        </div>
      )}

      {/* Recent Electronic Invoices */}
      <div className="card">
        <h2 className="font-semibold text-slate-900 dark:text-white mb-4 flex items-center gap-2">
          <FileText className="w-5 h-5" />
          Facturas electrónicas recientes
        </h2>
        {invoices.length === 0 ? (
          <p className="text-sm text-slate-500 dark:text-slate-400 py-6 text-center">
            No hay facturas recientes.
          </p>
        ) : (
          <div className="overflow-x-auto -mx-4 px-4 sm:-mx-6 sm:px-6">
            <table className="w-full min-w-[500px]">
              <thead>
                <tr>
                  <th className="table-header rounded-l-lg">Número</th>
                  <th className="table-header">Fecha</th>
                  <th className="table-header">Total</th>
                  <th className="table-header">Estado DIAN</th>
                  <th className="table-header rounded-r-lg">CUFE</th>
                </tr>
              </thead>
              <tbody>
                {invoices.map((inv) => (
                  <tr
                    key={inv.id}
                    className="hover:bg-slate-50 dark:hover:bg-white/[0.03]"
                  >
                    <td className="table-cell font-medium">{inv.number}</td>
                    <td className="table-cell">{formatDate(inv.date)}</td>
                    <td className="table-cell">{formatCurrency(inv.total)}</td>
                    <td className="table-cell">
                      <span
                        className={`px-2 py-1 rounded-full text-xs font-medium ${
                          DIAN_STATUS_COLORS[inv.dianStatus ?? ""] ??
                          "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400"
                        }`}
                      >
                        {DIAN_STATUS_LABELS[inv.dianStatus ?? ""] ?? inv.dianStatus ?? "—"}
                      </span>
                    </td>
                    <td className="table-cell font-mono text-xs truncate max-w-[140px]" title={inv.cufe ?? undefined}>
                      {inv.cufe ? `${inv.cufe.slice(0, 16)}…` : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
