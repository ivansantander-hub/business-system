"use client";

import { useEffect, useState, useCallback } from "react";
import { Settings, Save, DollarSign, Banknote, Shield, FileText } from "lucide-react";
import Toast from "@/components/ui/Toast";
import Modal from "@/components/ui/Modal";
import { Button } from "@/components/atoms";
import { PageHeader } from "@/components/molecules";
import { formatCurrency, formatDateTime } from "@/lib/utils";

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

  const load = useCallback(async () => {
    const [sRes, csRes, ccRes] = await Promise.all([
      fetch("/api/settings"),
      fetch("/api/cash?action=current"),
      fetch("/api/company/config"),
    ]);
    if (sRes.ok) setSettings(await sRes.json());
    if (csRes.ok) {
      const cs = await csRes.json();
      if (cs) setCashSession(cs);
    }
    if (ccRes.ok) setCompanyConfig(await ccRes.json());
  }, []);

  useEffect(() => { load(); }, [load]);

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
