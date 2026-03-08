"use client";

import { useEffect, useState, useCallback } from "react";
import { Settings, Save, DollarSign, Banknote } from "lucide-react";
import Toast from "@/components/ui/Toast";
import Modal from "@/components/ui/Modal";
import { formatCurrency, formatDateTime } from "@/lib/utils";

export default function ConfiguracionPage() {
  const [settings, setSettings] = useState<Record<string, string>>({});
  const [toast, setToast] = useState<{ message: string; type: "success" | "error" } | null>(null);
  const [showCashClose, setShowCashClose] = useState(false);
  const [closingAmount, setClosingAmount] = useState("");
  const [cashSession, setCashSession] = useState<{ id: number; openingAmount: string; salesTotal: string; openedAt: string } | null>(null);

  const load = useCallback(async () => {
    const [sRes, csRes] = await Promise.all([
      fetch("/api/settings"),
      fetch("/api/cash?action=current"),
    ]);
    if (sRes.ok) setSettings(await sRes.json());
    if (csRes.ok) {
      const cs = await csRes.json();
      if (cs) setCashSession(cs);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  async function saveSettings(e: React.FormEvent) {
    e.preventDefault();
    const res = await fetch("/api/settings", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(settings) });
    if (res.ok) setToast({ message: "Configuración guardada", type: "success" });
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

      <div className="flex items-center gap-3">
        <Settings className="w-7 h-7 text-indigo-600" />
        <h1 className="text-2xl font-bold text-gray-900">Configuración</h1>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Business info */}
        <div className="card">
          <h2 className="font-semibold text-gray-900 mb-4">Información del Negocio</h2>
          <form onSubmit={saveSettings} className="space-y-4">
            <div><label className="block text-sm font-medium text-gray-700 mb-1">Nombre del Negocio</label>
              <input className="input-field" value={settings.business_name || ""} onChange={e => setSettings({...settings, business_name: e.target.value})} /></div>
            <div><label className="block text-sm font-medium text-gray-700 mb-1">NIT</label>
              <input className="input-field" value={settings.business_nit || ""} onChange={e => setSettings({...settings, business_nit: e.target.value})} /></div>
            <div><label className="block text-sm font-medium text-gray-700 mb-1">Dirección</label>
              <input className="input-field" value={settings.business_address || ""} onChange={e => setSettings({...settings, business_address: e.target.value})} /></div>
            <div><label className="block text-sm font-medium text-gray-700 mb-1">Teléfono</label>
              <input className="input-field" value={settings.business_phone || ""} onChange={e => setSettings({...settings, business_phone: e.target.value})} /></div>
            <button type="submit" className="btn-primary flex items-center gap-2"><Save className="w-4 h-4" /> Guardar</button>
          </form>
        </div>

        {/* Invoice & Tax */}
        <div className="space-y-6">
          <div className="card">
            <h2 className="font-semibold text-gray-900 mb-4 flex items-center gap-2"><DollarSign className="w-5 h-5" /> Facturación</h2>
            <form onSubmit={saveSettings} className="space-y-4">
              <div><label className="block text-sm font-medium text-gray-700 mb-1">Prefijo de Factura</label>
                <input className="input-field" value={settings.invoice_prefix || ""} onChange={e => setSettings({...settings, invoice_prefix: e.target.value})} /></div>
              <div><label className="block text-sm font-medium text-gray-700 mb-1">Próximo Número</label>
                <input type="number" className="input-field" value={settings.invoice_next_number || ""} onChange={e => setSettings({...settings, invoice_next_number: e.target.value})} /></div>
              <div><label className="block text-sm font-medium text-gray-700 mb-1">Tasa de IVA</label>
                <input type="number" step="0.01" className="input-field" value={settings.tax_rate || ""} onChange={e => setSettings({...settings, tax_rate: e.target.value})} /></div>
              <div><label className="block text-sm font-medium text-gray-700 mb-1">Moneda (símbolo)</label>
                <input className="input-field" value={settings.currency || ""} onChange={e => setSettings({...settings, currency: e.target.value})} /></div>
              <button type="submit" className="btn-primary flex items-center gap-2"><Save className="w-4 h-4" /> Guardar</button>
            </form>
          </div>

          {/* Cash session */}
          <div className="card">
            <h2 className="font-semibold text-gray-900 mb-4 flex items-center gap-2"><Banknote className="w-5 h-5" /> Caja Actual</h2>
            {cashSession ? (
              <div className="space-y-3">
                <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-3">
                  <p className="text-sm text-emerald-700 font-medium">Caja Abierta</p>
                  <p className="text-xs text-emerald-600">Desde: {formatDateTime(cashSession.openedAt)}</p>
                </div>
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div><span className="text-gray-500">Monto Inicial:</span> <span className="font-semibold">{formatCurrency(cashSession.openingAmount)}</span></div>
                  <div><span className="text-gray-500">Ventas:</span> <span className="font-semibold text-emerald-600">{formatCurrency(cashSession.salesTotal)}</span></div>
                </div>
                <button onClick={() => setShowCashClose(true)} className="btn-danger w-full">Cerrar Caja</button>
              </div>
            ) : (
              <p className="text-sm text-gray-500 py-4 text-center">No hay caja abierta. Abra una desde el Punto de Venta.</p>
            )}
          </div>
        </div>
      </div>

      {/* Close cash modal */}
      <Modal open={showCashClose} onClose={() => setShowCashClose(false)} title="Cerrar Caja" size="sm">
        {cashSession && (
          <form onSubmit={closeCash} className="space-y-4">
            <div className="bg-gray-50 rounded-lg p-3 space-y-1 text-sm">
              <div className="flex justify-between"><span>Monto Inicial:</span><span>{formatCurrency(cashSession.openingAmount)}</span></div>
              <div className="flex justify-between"><span>Ventas del Turno:</span><span className="font-semibold">{formatCurrency(cashSession.salesTotal)}</span></div>
              <div className="flex justify-between font-bold border-t pt-1"><span>Esperado:</span><span>{formatCurrency(Number(cashSession.openingAmount) + Number(cashSession.salesTotal))}</span></div>
            </div>
            <div><label className="block text-sm font-medium text-gray-700 mb-1">Monto Contado en Caja</label>
              <input type="number" step="0.01" className="input-field text-lg font-bold text-center" value={closingAmount} onChange={e => setClosingAmount(e.target.value)} required autoFocus />
            </div>
            {closingAmount && (
              <div className={`text-center text-lg font-bold ${Number(closingAmount) - (Number(cashSession.openingAmount) + Number(cashSession.salesTotal)) >= 0 ? "text-emerald-600" : "text-red-600"}`}>
                Diferencia: {formatCurrency(Number(closingAmount) - (Number(cashSession.openingAmount) + Number(cashSession.salesTotal)))}
              </div>
            )}
            <div className="flex gap-3"><button type="button" onClick={() => setShowCashClose(false)} className="btn-secondary flex-1">Cancelar</button><button type="submit" className="btn-danger flex-1">Cerrar Caja</button></div>
          </form>
        )}
      </Modal>
    </div>
  );
}
