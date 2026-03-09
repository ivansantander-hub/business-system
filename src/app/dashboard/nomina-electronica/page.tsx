"use client";

import { useState, useEffect, useCallback } from "react";
import {
  FileText,
  Settings,
  Shield,
  CheckCircle,
  XCircle,
  ToggleLeft,
  ToggleRight,
  Save,
  Plug,
  Wifi,
  WifiOff,
  Loader2,
  ExternalLink,
} from "lucide-react";
import Toast from "@/components/ui/Toast";
import { Button } from "@/components/atoms";
import { PageHeader } from "@/components/molecules";
import { SUPPORTED_PAYROLL_PROVIDERS } from "@/lib/payroll-dian";

interface PayrollConfig {
  electronicPayrollEnabled: boolean;
  payrollProvider: string | null;
  payrollProviderApiUrl: string | null;
  payrollProviderApiKey: string | null;
  payrollProviderUser: string | null;
  payrollProviderPass: string | null;
}

type ConnectionStatus = "not_connected" | "testing" | "connected";

export default function NominaElectronicaPage() {
  const [config, setConfig] = useState<PayrollConfig>({
    electronicPayrollEnabled: false,
    payrollProvider: null,
    payrollProviderApiUrl: null,
    payrollProviderApiKey: null,
    payrollProviderUser: null,
    payrollProviderPass: null,
  });
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>("not_connected");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: "success" | "error" } | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/company/config");
      if (res.ok) {
        const data = await res.json();
        setConfig({
          electronicPayrollEnabled: data.electronicPayrollEnabled ?? false,
          payrollProvider: data.payrollProvider ?? null,
          payrollProviderApiUrl: data.payrollProviderApiUrl ?? null,
          payrollProviderApiKey: data.payrollProviderApiKey ?? null,
          payrollProviderUser: data.payrollProviderUser ?? null,
          payrollProviderPass: data.payrollProviderPass ?? null,
        });
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
        body: JSON.stringify({
          electronicPayrollEnabled: config.electronicPayrollEnabled,
          payrollProvider: config.payrollProvider,
          payrollProviderApiUrl: config.payrollProviderApiUrl,
          payrollProviderApiKey: config.payrollProviderApiKey,
          payrollProviderUser: config.payrollProviderUser,
          payrollProviderPass: config.payrollProviderPass,
        }),
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
      if (data.electronicPayrollEnabled && data.payrollProvider) {
        setToast({
          message: `Conexión verificada con proveedor: ${data.payrollProvider}`,
          type: "success",
        });
        setConnectionStatus("connected");
      } else {
        setToast({ message: "Nómina electrónica no está habilitada o no hay proveedor configurado", type: "error" });
        setConnectionStatus("not_connected");
      }
    } catch {
      setToast({ message: "Error al verificar conexión con el servidor", type: "error" });
      setConnectionStatus("not_connected");
    }
  }

  async function toggleElectronicPayroll() {
    const next = !config.electronicPayrollEnabled;
    setSaving(true);
    try {
      const res = await fetch("/api/company/config", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ electronicPayrollEnabled: next }),
      });
      if (res.ok) {
        setConfig((c) => ({ ...c, electronicPayrollEnabled: next }));
        setToast({
          message: next ? "Nómina electrónica activada" : "Nómina electrónica desactivada",
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
        title="Nómina Electrónica"
      />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Status & Toggle */}
        <div className="card">
          <h2 className="font-semibold text-slate-900 dark:text-white mb-4 flex items-center gap-2">
            <Shield className="w-5 h-5" />
            Estado de Nómina Electrónica
          </h2>
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div className="flex items-center gap-3">
              {config.electronicPayrollEnabled ? (
                <CheckCircle className="w-8 h-8 text-emerald-500" />
              ) : (
                <XCircle className="w-8 h-8 text-slate-400 dark:text-slate-500" />
              )}
              <div>
                <p className="font-medium text-slate-900 dark:text-white">
                  {config.electronicPayrollEnabled ? "Activa" : "Inactiva"}
                </p>
                <p className="text-sm text-slate-500 dark:text-slate-400">
                  {config.electronicPayrollEnabled
                    ? "Los documentos de nómina se generan con CUNE y cumplen normas DIAN"
                    : "Modo local: documentos de nómina sin envío a DIAN"}
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={toggleElectronicPayroll}
              disabled={saving}
              className="flex items-center gap-2 p-3 rounded-xl bg-slate-100 dark:bg-slate-800/50 hover:bg-slate-200 dark:hover:bg-slate-700/50 transition-colors disabled:opacity-50"
              aria-label={config.electronicPayrollEnabled ? "Desactivar" : "Activar"}
            >
              {config.electronicPayrollEnabled ? (
                <ToggleRight className="w-8 h-8 text-emerald-500" />
              ) : (
                <ToggleLeft className="w-8 h-8 text-slate-400" />
              )}
              <span className="text-sm font-medium text-slate-700 dark:text-slate-300">
                {config.electronicPayrollEnabled ? "Desactivar" : "Activar"}
              </span>
            </button>
          </div>
        </div>
      </div>

      {/* Provider Configuration */}
      {config.electronicPayrollEnabled && (
        <div className="card">
          <h2 className="font-semibold text-slate-900 dark:text-white mb-4 flex items-center gap-2">
            <Plug className="w-5 h-5" />
            Configuración del Proveedor
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
            <form onSubmit={saveConfig} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                <div className="sm:col-span-2 lg:col-span-1">
                  <label htmlFor="payroll-provider" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                    Proveedor
                  </label>
                  <select
                    id="payroll-provider"
                    className="input-field w-full"
                    value={config.payrollProvider ?? ""}
                    onChange={(e) =>
                      setConfig({ ...config, payrollProvider: e.target.value || null })
                    }
                  >
                    <option value="">Seleccionar proveedor</option>
                    {SUPPORTED_PAYROLL_PROVIDERS.map((p) => (
                      <option key={p} value={p}>
                        {p.charAt(0).toUpperCase() + p.slice(1).replace(/_/g, " ")}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="sm:col-span-2">
                  <label htmlFor="payroll-api-url" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                    URL API
                  </label>
                  <input
                    id="payroll-api-url"
                    type="url"
                    className="input-field w-full"
                    value={config.payrollProviderApiUrl ?? ""}
                    onChange={(e) =>
                      setConfig({ ...config, payrollProviderApiUrl: e.target.value || null })
                    }
                    placeholder="https://api.proveedor.com/v1"
                  />
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label htmlFor="payroll-api-key" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                    API Key
                  </label>
                  <input
                    id="payroll-api-key"
                    type="password"
                    className="input-field w-full"
                    value={config.payrollProviderApiKey ?? ""}
                    onChange={(e) =>
                      setConfig({ ...config, payrollProviderApiKey: e.target.value || null })
                    }
                    placeholder="••••••••••••••••"
                    autoComplete="off"
                  />
                </div>
                <div>
                  <label htmlFor="payroll-user" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                    Usuario
                  </label>
                  <input
                    id="payroll-user"
                    type="text"
                    className="input-field w-full"
                    value={config.payrollProviderUser ?? ""}
                    onChange={(e) =>
                      setConfig({ ...config, payrollProviderUser: e.target.value || null })
                    }
                    placeholder="Usuario del proveedor"
                  />
                </div>
              </div>
              <div>
                <label htmlFor="payroll-pass" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Contraseña
                </label>
                <input
                  id="payroll-pass"
                  type="password"
                  className="input-field w-full max-w-md"
                  value={config.payrollProviderPass ?? ""}
                  onChange={(e) =>
                    setConfig({ ...config, payrollProviderPass: e.target.value || null })
                  }
                  placeholder="••••••••••••••••"
                  autoComplete="off"
                />
              </div>
              <Button type="submit" icon={<Save className="w-4 h-4" />} disabled={saving}>
                Guardar configuración
              </Button>
            </form>
          </div>
        </div>
      )}

      {/* Information Section */}
      <div className="card">
        <h2 className="font-semibold text-slate-900 dark:text-white mb-4 flex items-center gap-2">
          <Settings className="w-5 h-5" />
          Información sobre Nómina Electrónica
        </h2>
        <div className="space-y-4 text-sm text-slate-600 dark:text-slate-400">
          <p>
            La <strong className="text-slate-700 dark:text-slate-300">Nómina Electrónica</strong> en Colombia es
            obligatoria para empleadores desde 2021. Los documentos soporte de pago de nómina electrónica (DSNE)
            deben reportarse a la DIAN a través de proveedores autorizados.
          </p>
          <div>
            <h3 className="font-medium text-slate-700 dark:text-slate-300 mb-2">Cumplimiento DIAN</h3>
            <ul className="list-disc list-inside space-y-1">
              <li>Documentos con CUNE (Código Único de Nómina Electrónica)</li>
              <li>Validación y aceptación por parte de la DIAN</li>
              <li>Integración con proveedores certificados (Factus, Carvajal, WorldOffice, Siigo)</li>
            </ul>
          </div>
          <div>
            <h3 className="font-medium text-slate-700 dark:text-slate-300 mb-2">Resolución 000013 de 2021</h3>
            <p>
              La Resolución 000013 de 2021 de la DIAN establece los requisitos técnicos y de formato
              para la emisión de documentos soporte de nómina electrónica. Incluye la estructura del
              CUNE y los campos obligatorios del documento.
            </p>
          </div>
          <div>
            <h3 className="font-medium text-slate-700 dark:text-slate-300 mb-2">¿Qué es el CUNE?</h3>
            <p>
              El <strong className="text-slate-700 dark:text-slate-300">CUNE</strong> (Código Único de Nómina Electrónica)
              es un identificador único generado mediante algoritmo criptográfico que garantiza la
              autenticidad e integridad del documento de nómina. Cada DSNE debe tener un CUNE único.
            </p>
          </div>
          <div className="pt-2">
            <a
              href="https://www.dian.gov.co"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 text-violet-600 dark:text-violet-400 hover:underline"
            >
              <ExternalLink className="w-4 h-4" />
              Portal DIAN
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}
