"use client";

import { useEffect, useState, useCallback } from "react";
import Image from "next/image";
import { Settings, Save, DollarSign, Banknote, Shield, FileText, ImageIcon, Bot, Eye, EyeOff } from "lucide-react";
import Toast from "@/components/ui/Toast";
import Modal from "@/components/ui/Modal";
import { Button } from "@/components/atoms";
import { PageHeader } from "@/components/molecules";
import { formatCurrency, formatDateTime } from "@/lib/utils";
import { useAtomValue, useSetAtom } from "jotai";
import { companyLogoAtom, fetchAuthAtom } from "@/store";

export default function ConfiguracionPage() {
  const [settings, setSettings] = useState<Record<string, string>>({});
  const [companyConfig, setCompanyConfig] = useState<{
    retentionYears: number;
    dianResolution: string | null;
    dianPrefix: string | null;
    dianRangeFrom: number | null;
    dianRangeTo: number | null;
    economicActivity: string | null;
    taxResponsibilities: string | null;
  }>({
    retentionYears: 5,
    dianResolution: null,
    dianPrefix: null,
    dianRangeFrom: null,
    dianRangeTo: null,
    economicActivity: null,
    taxResponsibilities: null,
  });
  const [toast, setToast] = useState<{ message: string; type: "success" | "error" } | null>(null);
  const [showCashClose, setShowCashClose] = useState(false);
  const [closingAmount, setClosingAmount] = useState("");
  const [cashSession, setCashSession] = useState<{ id: string; openingAmount: string; salesTotal: string; openedAt: string } | null>(null);
  const [logoUploading, setLogoUploading] = useState(false);
  const [agentConfig, setAgentConfig] = useState<{
    enabled: boolean;
    modelProvider: string;
    modelName: string;
    openaiApiKey: string;
    anthropicApiKey: string;
    capabilities: Record<string, boolean>;
    customPrompt: string;
    maxTokens: number;
  }>({
    enabled: false,
    modelProvider: "openai",
    modelName: "gpt-4o-mini",
    openaiApiKey: "",
    anthropicApiKey: "",
    capabilities: {},
    customPrompt: "",
    maxTokens: 4096,
  });
  const [agentModels, setAgentModels] = useState<{ provider: string; id: string; label: string }[]>([]);
  const [agentSaving, setAgentSaving] = useState(false);
  const [agentTesting, setAgentTesting] = useState(false);
  const [showOpenaiKey, setShowOpenaiKey] = useState(false);
  const [showAnthropicKey, setShowAnthropicKey] = useState(false);
  const [agentCapabilities, setAgentCapabilities] = useState<{ id: string; label: string; description: string }[]>([]);
  const companyLogoUrl = useAtomValue(companyLogoAtom);
  const fetchAuth = useSetAtom(fetchAuthAtom);

  const load = useCallback(async () => {
    const [sRes, csRes, ccRes, agRes] = await Promise.all([
      fetch("/api/settings"),
      fetch("/api/cash?action=current"),
      fetch("/api/company/config"),
      fetch("/api/agent/config"),
    ]);
    if (sRes.ok) setSettings(await sRes.json());
    if (csRes.ok) {
      const cs = await csRes.json();
      if (cs) setCashSession(cs);
    }
    if (ccRes.ok) setCompanyConfig(await ccRes.json());
    if (agRes.ok) {
      const ag = await agRes.json();
      setAgentConfig({
        enabled: ag.enabled ?? false,
        modelProvider: ag.modelProvider ?? "openai",
        modelName: ag.modelName ?? "gpt-4o-mini",
        openaiApiKey: ag.openaiApiKey ?? "",
        anthropicApiKey: ag.anthropicApiKey ?? "",
        capabilities: ag.capabilities ?? {},
        customPrompt: ag.customPrompt ?? "",
        maxTokens: ag.maxTokens ?? 4096,
      });
      if (ag.availableCapabilities?.length) {
        setAgentCapabilities(ag.availableCapabilities);
      }
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    fetch("/api/agent/models").then((r) => (r.ok ? r.json() : { models: [] })).then((modelsData) => {
      setAgentModels(modelsData.models || []);
    });
  }, []);

  async function saveSettings(e: React.FormEvent) {
    e.preventDefault();
    const res = await fetch("/api/settings", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(settings) });
    if (res.ok) setToast({ message: "Configuración guardada", type: "success" });
  }

  async function saveRetention(e: React.FormEvent) {
    e.preventDefault();
    const res = await fetch("/api/company/config", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ retentionYears: companyConfig.retentionYears }),
    });
    if (res.ok) setToast({ message: "Configuración de retención guardada", type: "success" });
  }

  async function saveDian(e: React.FormEvent) {
    e.preventDefault();
    const res = await fetch("/api/company/config", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        dianResolution: companyConfig.dianResolution || null,
        dianPrefix: companyConfig.dianPrefix || null,
        dianRangeFrom: companyConfig.dianRangeFrom ?? null,
        dianRangeTo: companyConfig.dianRangeTo ?? null,
        economicActivity: companyConfig.economicActivity || null,
        taxResponsibilities: companyConfig.taxResponsibilities || null,
      }),
    });
    if (res.ok) setToast({ message: "Configuración DIAN guardada", type: "success" });
  }

  async function saveAgentConfig(e: React.FormEvent) {
    e.preventDefault();
    setAgentSaving(true);
    try {
      const body: Record<string, unknown> = {
        enabled: agentConfig.enabled,
        modelProvider: agentConfig.modelProvider,
        modelName: agentConfig.modelName,
        capabilities: agentConfig.capabilities,
        customPrompt: agentConfig.customPrompt || null,
        maxTokens: agentConfig.maxTokens,
      };
      if (agentConfig.openaiApiKey && !agentConfig.openaiApiKey.includes("*")) {
        body.openaiApiKey = agentConfig.openaiApiKey;
      }
      if (agentConfig.anthropicApiKey && !agentConfig.anthropicApiKey.includes("*")) {
        body.anthropicApiKey = agentConfig.anthropicApiKey;
      }
      const res = await fetch("/api/agent/config", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (res.ok) {
        setToast({ message: "Configuración del agente guardada", type: "success" });
        const ag = await res.json();
        setAgentConfig((prev) => ({
          ...prev,
          openaiApiKey: ag.openaiApiKey ?? "",
          anthropicApiKey: ag.anthropicApiKey ?? "",
        }));
      } else {
        const err = await res.json();
        setToast({ message: err.error || "Error al guardar", type: "error" });
      }
    } finally {
      setAgentSaving(false);
    }
  }

  async function testAgent() {
    setAgentTesting(true);
    try {
      const convRes = await fetch("/api/conversations");
      if (!convRes.ok) {
        setToast({ message: "Error al obtener conversaciones", type: "error" });
        return;
      }
      const convData = await convRes.json();
      const conversations = convData.conversations ?? convData;
      const agentConv = (Array.isArray(conversations) ? conversations : []).find(
        (c: { isAgent?: boolean }) => c.isAgent
      );
      if (!agentConv) {
        setToast({ message: "Primero habilita el agente y recarga la página de mensajes para crear la conversación", type: "error" });
        return;
      }

      const msgRes = await fetch(`/api/conversations/${agentConv.id}/messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: "Hola, ¿estás funcionando correctamente?" }),
      });
      if (!msgRes.ok) {
        setToast({ message: "Error al enviar mensaje de prueba", type: "error" });
        return;
      }

      const res = await fetch("/api/agent/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          conversationId: agentConv.id,
          modelProvider: agentConfig.modelProvider,
          modelName: agentConfig.modelName,
        }),
      });
      if (res.ok) {
        const data = await res.json();
        setToast({ message: `Agente respondió: "${(data.response || "").slice(0, 80)}..."`, type: "success" });
      } else {
        const err = await res.json();
        setToast({ message: err.error || "Error al probar el agente", type: "error" });
      }
    } catch {
      setToast({ message: "Error de conexión al probar el agente", type: "error" });
    } finally {
      setAgentTesting(false);
    }
  }

  async function handleLogoUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setLogoUploading(true);
    try {
      const formData = new FormData();
      formData.append("logo", file);
      const res = await fetch("/api/company/logo", { method: "POST", body: formData });
      const data = await res.json();
      if (res.ok) {
        setToast({ message: "Logo actualizado correctamente", type: "success" });
        await fetchAuth();
      } else {
        setToast({ message: data.error || "Error al subir el logo", type: "error" });
      }
    } catch {
      setToast({ message: "Error al subir el logo", type: "error" });
    } finally {
      setLogoUploading(false);
      e.target.value = "";
    }
  }

  async function closeCash(e: React.FormEvent) {
    e.preventDefault();
    const res = await fetch("/api/cash", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "close", closingAmount: Number(closingAmount) }),
    });
    if (res.ok) {
      setShowCashClose(false); setCashSession(null);
      setToast({ message: "Caja cerrada exitosamente", type: "success" });
    }
  }

  return (
    <div className="space-y-6">
      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}

      <PageHeader icon={<Settings className="w-full h-full" />} title="Configuración" />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 w-full">
        {/* Company logo */}
        <div className="card">
          <h2 className="font-semibold text-slate-900 dark:text-white mb-4 flex items-center gap-2">
            <ImageIcon className="w-5 h-5" /> Logo de la empresa
          </h2>
          <div className="flex flex-col sm:flex-row items-start gap-4">
            <div className="w-24 h-24 rounded-xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center overflow-hidden flex-shrink-0">
              {companyLogoUrl ? (
                <Image
                  src={companyLogoUrl}
                  alt="Logo de la empresa"
                  width={96}
                  height={96}
                  className="w-full h-full object-contain"
                  unoptimized
                />
              ) : (
                <ImageIcon className="w-12 h-12 text-slate-400" />
              )}
            </div>
            <div className="flex-1 space-y-2">
              <p className="text-sm text-slate-600 dark:text-slate-400">
                JPG, PNG, WebP o GIF. Máximo 2 MB.
              </p>
              <label className="inline-flex cursor-pointer">
                <input
                  type="file"
                  accept="image/jpeg,image/png,image/webp,image/gif"
                  onChange={handleLogoUpload}
                  disabled={logoUploading}
                  className="sr-only"
                />
                <Button type="button" disabled={logoUploading} loading={logoUploading}>
                  {logoUploading ? "Subiendo..." : "Subir logo"}
                </Button>
              </label>
              {logoUploading && (
                <p className="text-xs text-slate-500 dark:text-slate-400">Procesando...</p>
              )}
            </div>
          </div>
        </div>

        {/* Business info */}
        <div className="card">
          <h2 className="font-semibold text-slate-900 dark:text-white mb-4">Información del Negocio</h2>
          <form onSubmit={saveSettings} className="space-y-4">
            <div><label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Nombre del Negocio</label>
              <input className="input-field" value={settings.business_name || ""} onChange={e => setSettings({...settings, business_name: e.target.value})} /></div>
            <div><label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">NIT</label>
              <input className="input-field" value={settings.business_nit || ""} onChange={e => setSettings({...settings, business_nit: e.target.value})} /></div>
            <div><label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Dirección</label>
              <input className="input-field" value={settings.business_address || ""} onChange={e => setSettings({...settings, business_address: e.target.value})} /></div>
            <div><label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Teléfono</label>
              <input className="input-field" value={settings.business_phone || ""} onChange={e => setSettings({...settings, business_phone: e.target.value})} /></div>
            <button type="submit" className="btn-primary flex items-center gap-2"><Save className="w-4 h-4" /> Guardar</button>
          </form>
        </div>

        {/* Invoice & Tax */}
        <div className="space-y-6">
          <div className="card">
            <h2 className="font-semibold text-slate-900 dark:text-white mb-4 flex items-center gap-2"><DollarSign className="w-5 h-5" /> Facturación</h2>
            <form onSubmit={saveSettings} className="space-y-4">
              <div><label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Prefijo de Factura</label>
                <input className="input-field" value={settings.invoice_prefix || ""} onChange={e => setSettings({...settings, invoice_prefix: e.target.value})} /></div>
              <div><label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Próximo Número</label>
                <input type="number" className="input-field" value={settings.invoice_next_number || ""} onChange={e => setSettings({...settings, invoice_next_number: e.target.value})} /></div>
              <div><label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Tasa de IVA</label>
                <input type="number" step="0.01" className="input-field" value={settings.tax_rate || ""} onChange={e => setSettings({...settings, tax_rate: e.target.value})} /></div>
              <div><label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Moneda (símbolo)</label>
                <input className="input-field" value={settings.currency || ""} onChange={e => setSettings({...settings, currency: e.target.value})} /></div>
              <Button type="submit" icon={<Save className="w-4 h-4" />}>Guardar</Button>
            </form>
          </div>

          {/* Cash session */}
          <div className="card w-full">
            <h2 className="font-semibold text-slate-900 dark:text-white mb-4 flex items-center gap-2"><Banknote className="w-5 h-5" /> Caja Actual</h2>
            {cashSession ? (
              <div className="space-y-3">
                <div className="bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800 rounded-lg p-3">
                  <p className="text-sm text-emerald-700 dark:text-emerald-400 font-medium">Caja Abierta</p>
                  <p className="text-xs text-emerald-600 dark:text-emerald-400">Desde: {formatDateTime(cashSession.openedAt)}</p>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
                  <div><span className="text-slate-500 dark:text-slate-400">Monto Inicial:</span> <span className="font-semibold">{formatCurrency(cashSession.openingAmount)}</span></div>
                  <div><span className="text-slate-500 dark:text-slate-400">Ventas:</span> <span className="font-semibold text-emerald-600">{formatCurrency(cashSession.salesTotal)}</span></div>
                </div>
                <Button variant="danger" onClick={() => setShowCashClose(true)} className="w-full">Cerrar Caja</Button>
              </div>
            ) : (
              <p className="text-sm text-slate-500 dark:text-slate-400 py-4 text-center">No hay caja abierta. Abra una desde el Punto de Venta.</p>
            )}
          </div>
        </div>
      </div>

      {/* Retention & Audit */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 w-full">
        <div className="card">
          <h2 className="font-semibold text-slate-900 dark:text-white mb-4 flex items-center gap-2">
            <Shield className="w-5 h-5" /> Retención y Auditoría
          </h2>
          <form onSubmit={saveRetention} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                Años de retención de documentos
              </label>
              <input
                type="number"
                min={1}
                max={30}
                className="input-field"
                value={companyConfig.retentionYears}
                onChange={(e) => {
                  const num = Number.parseInt(e.target.value, 10);
                  const years = Number.isNaN(num) ? 5 : Math.min(30, Math.max(1, num));
                  setCompanyConfig({ ...companyConfig, retentionYears: years });
                }}
              />
            </div>
            <Button type="submit" icon={<Save className="w-4 h-4" />}>
              Guardar
            </Button>
          </form>
        </div>

        {/* Electronic invoicing (DIAN) */}
        <div className="card">
          <h2 className="font-semibold text-slate-900 dark:text-white mb-4 flex items-center gap-2">
            <FileText className="w-5 h-5" /> Facturación Electrónica (DIAN)
          </h2>
          <form onSubmit={saveDian} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                Resolución de autorización DIAN
              </label>
              <input
                className="input-field"
                value={companyConfig.dianResolution ?? ""}
                onChange={(e) => setCompanyConfig({ ...companyConfig, dianResolution: e.target.value || null })}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                Prefijo autorizado
              </label>
              <input
                className="input-field"
                value={companyConfig.dianPrefix ?? ""}
                onChange={(e) => setCompanyConfig({ ...companyConfig, dianPrefix: e.target.value || null })}
              />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Rango desde
                </label>
                <input
                  type="number"
                  className="input-field"
                  value={companyConfig.dianRangeFrom ?? ""}
                  onChange={(e) => {
                    const v = e.target.value;
                    const n = v === "" ? null : Number.parseInt(v, 10);
                    setCompanyConfig({
                      ...companyConfig,
                      dianRangeFrom: v === "" || (n !== null && !Number.isNaN(n)) ? n : companyConfig.dianRangeFrom,
                    });
                  }}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Rango hasta
                </label>
                <input
                  type="number"
                  className="input-field"
                  value={companyConfig.dianRangeTo ?? ""}
                  onChange={(e) => {
                    const v = e.target.value;
                    const n = v === "" ? null : Number.parseInt(v, 10);
                    setCompanyConfig({
                      ...companyConfig,
                      dianRangeTo: v === "" || (n !== null && !Number.isNaN(n)) ? n : companyConfig.dianRangeTo,
                    });
                  }}
                />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                Actividad económica (CIIU)
              </label>
              <input
                className="input-field"
                value={companyConfig.economicActivity ?? ""}
                onChange={(e) => setCompanyConfig({ ...companyConfig, economicActivity: e.target.value || null })}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                Responsabilidades tributarias
              </label>
              <input
                className="input-field"
                value={companyConfig.taxResponsibilities ?? ""}
                onChange={(e) => setCompanyConfig({ ...companyConfig, taxResponsibilities: e.target.value || null })}
              />
            </div>
            <Button type="submit" icon={<Save className="w-4 h-4" />}>
              Guardar
            </Button>
          </form>
        </div>
      </div>

      {/* Agent Configuration */}
      <div className="card">
        <h2 className="font-semibold text-slate-900 dark:text-white mb-6 flex items-center gap-2">
          <Bot className="w-5 h-5 text-violet-500" /> Agente de IA (AURA)
        </h2>
        <form onSubmit={saveAgentConfig} className="space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium text-slate-900 dark:text-white">Habilitar Agente</p>
              <p className="text-sm text-slate-500 dark:text-slate-400">
                Permite a los usuarios consultar datos del negocio por chat
              </p>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={agentConfig.enabled}
                onChange={(e) => setAgentConfig({ ...agentConfig, enabled: e.target.checked })}
                className="sr-only peer"
              />
              <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-violet-300 dark:peer-focus:ring-violet-800 rounded-full peer dark:bg-slate-700 peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:after:border-slate-600 peer-checked:bg-violet-600" />
            </label>
          </div>

          {agentConfig.enabled && (
            <>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                    Modelo predeterminado
                  </label>
                  <select
                    className="input-field"
                    value={`${agentConfig.modelProvider}:${agentConfig.modelName}`}
                    onChange={(e) => {
                      const [provider, ...rest] = e.target.value.split(":");
                      setAgentConfig({ ...agentConfig, modelProvider: provider, modelName: rest.join(":") });
                    }}
                  >
                    {agentModels.map((m) => (
                      <option key={`${m.provider}:${m.id}`} value={`${m.provider}:${m.id}`}>
                        {m.label}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                    Máximo de tokens
                  </label>
                  <input
                    type="number"
                    min={256}
                    max={32768}
                    className="input-field"
                    value={agentConfig.maxTokens}
                    onChange={(e) => setAgentConfig({ ...agentConfig, maxTokens: Number(e.target.value) || 4096 })}
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                    API Key de OpenAI (opcional)
                  </label>
                  <div className="relative">
                    <input
                      type={showOpenaiKey ? "text" : "password"}
                      className="input-field pr-10"
                      value={agentConfig.openaiApiKey}
                      onChange={(e) => setAgentConfig({ ...agentConfig, openaiApiKey: e.target.value })}
                      placeholder="sk-... (dejar vacío para usar la global)"
                    />
                    <button
                      type="button"
                      onClick={() => setShowOpenaiKey(!showOpenaiKey)}
                      className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 min-w-[2.75rem] min-h-[2.75rem] flex items-center justify-center"
                    >
                      {showOpenaiKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                    API Key de Anthropic (opcional)
                  </label>
                  <div className="relative">
                    <input
                      type={showAnthropicKey ? "text" : "password"}
                      className="input-field pr-10"
                      value={agentConfig.anthropicApiKey}
                      onChange={(e) => setAgentConfig({ ...agentConfig, anthropicApiKey: e.target.value })}
                      placeholder="sk-ant-... (dejar vacío para usar la global)"
                    />
                    <button
                      type="button"
                      onClick={() => setShowAnthropicKey(!showAnthropicKey)}
                      className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 min-w-[2.75rem] min-h-[2.75rem] flex items-center justify-center"
                    >
                      {showAnthropicKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Instrucciones personalizadas (opcional)
                </label>
                <textarea
                  className="input-field min-h-[5rem]"
                  value={agentConfig.customPrompt}
                  onChange={(e) => setAgentConfig({ ...agentConfig, customPrompt: e.target.value })}
                  placeholder="Instrucciones adicionales para el agente, por ejemplo: &quot;Siempre responde en formato de tabla&quot;"
                  rows={3}
                />
              </div>

              <div>
                <p className="text-sm font-medium text-slate-700 dark:text-slate-300 mb-3">
                  Capacidades habilitadas
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                  {agentCapabilities.map((cap) => (
                    <label
                      key={cap.id}
                      className={`flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                        agentConfig.capabilities[cap.id]
                          ? "border-violet-300 dark:border-violet-600 bg-violet-50 dark:bg-violet-500/10"
                          : "border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600"
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={agentConfig.capabilities[cap.id] ?? false}
                        onChange={(e) =>
                          setAgentConfig({
                            ...agentConfig,
                            capabilities: { ...agentConfig.capabilities, [cap.id]: e.target.checked },
                          })
                        }
                        className="mt-0.5 rounded border-slate-300 text-violet-600 focus:ring-violet-500"
                      />
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-slate-900 dark:text-white">{cap.label}</p>
                        <p className="text-xs text-slate-500 dark:text-slate-400">{cap.description}</p>
                      </div>
                    </label>
                  ))}
                </div>
                <div className="mt-3 flex gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      const all: Record<string, boolean> = {};
                      agentCapabilities.forEach((c) => { all[c.id] = true; });
                      setAgentConfig({ ...agentConfig, capabilities: all });
                    }}
                    className="text-xs text-violet-600 dark:text-violet-400 hover:underline"
                  >
                    Seleccionar todas
                  </button>
                  <span className="text-xs text-slate-300 dark:text-slate-600">|</span>
                  <button
                    type="button"
                    onClick={() => setAgentConfig({ ...agentConfig, capabilities: {} })}
                    className="text-xs text-slate-500 dark:text-slate-400 hover:underline"
                  >
                    Deseleccionar todas
                  </button>
                </div>
              </div>

              <div className="flex flex-col sm:flex-row gap-3">
                <Button type="submit" icon={<Save className="w-4 h-4" />} loading={agentSaving}>
                  Guardar Configuración
                </Button>
                <Button
                  type="button"
                  variant="secondary"
                  onClick={testAgent}
                  loading={agentTesting}
                  icon={<Bot className="w-4 h-4" />}
                >
                  Probar Agente
                </Button>
              </div>
            </>
          )}
        </form>
      </div>

      {/* Close cash modal */}
      <Modal open={showCashClose} onClose={() => setShowCashClose(false)} title="Cerrar Caja" size="sm">
        {cashSession && (
          <form onSubmit={closeCash} className="space-y-4">
            <div className="bg-slate-50 dark:bg-white/[0.03] rounded-lg p-3 space-y-1 text-sm">
              <div className="flex justify-between"><span>Monto Inicial:</span><span>{formatCurrency(cashSession.openingAmount)}</span></div>
              <div className="flex justify-between"><span>Ventas del Turno:</span><span className="font-semibold">{formatCurrency(cashSession.salesTotal)}</span></div>
              <div className="flex justify-between font-bold border-t pt-1"><span>Esperado:</span><span>{formatCurrency(Number(cashSession.openingAmount) + Number(cashSession.salesTotal))}</span></div>
            </div>
            <div><label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Monto Contado en Caja</label>
              <input type="number" step="0.01" className="input-field text-lg font-bold text-center" value={closingAmount} onChange={e => setClosingAmount(e.target.value)} required autoFocus />
            </div>
            {closingAmount && (
              <div className={`text-center text-lg font-bold ${Number(closingAmount) - (Number(cashSession.openingAmount) + Number(cashSession.salesTotal)) >= 0 ? "text-emerald-600" : "text-red-600"}`}>
                Diferencia: {formatCurrency(Number(closingAmount) - (Number(cashSession.openingAmount) + Number(cashSession.salesTotal)))}
              </div>
            )}
            <div className="flex flex-col sm:flex-row gap-2 sm:gap-3"><Button type="button" variant="secondary" onClick={() => setShowCashClose(false)} className="flex-1">Cancelar</Button><Button type="submit" variant="danger" className="flex-1">Cerrar Caja</Button></div>
          </form>
        )}
      </Modal>
    </div>
  );
}
