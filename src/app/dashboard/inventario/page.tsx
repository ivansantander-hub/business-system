"use client";

import { useEffect, useState, useCallback } from "react";
import { Warehouse, Plus, ArrowDownCircle, ArrowUpCircle, RotateCcw } from "lucide-react";
import Modal from "@/components/ui/Modal";
import Toast from "@/components/ui/Toast";
import { formatDateTime } from "@/lib/utils";
import { PageHeader, EmptyState } from "@/components/molecules";

interface Product { id: string; name: string; stock: string; minStock: string; unit: string; }
interface Movement {
  id: string; type: string; quantity: string; previousStock: string; newStock: string;
  reason: string | null; createdAt: string;
  product: { name: string }; user: { name: string };
}

export default function InventarioPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [movements, setMovements] = useState<Movement[]>([]);
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState({ productId: "", type: "IN", quantity: "", reason: "", newStock: "" });
  const [toast, setToast] = useState<{ message: string; type: "success" | "error" } | null>(null);

  const load = useCallback(async () => {
    const [prodsRes, movsRes] = await Promise.all([
      fetch("/api/products?active=true"),
      fetch("/api/inventory"),
    ]);
    setProducts(prodsRes.ok ? await prodsRes.json() : []);
    setMovements(movsRes.ok ? await movsRes.json() : []);
  }, []);

  useEffect(() => { load(); }, [load]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const res = await fetch("/api/inventory", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    if (res.ok) {
      setShowModal(false);
      load();
      setToast({ message: "Movimiento registrado", type: "success" });
    } else {
      const data = await res.json();
      setToast({ message: data.error || "Error", type: "error" });
    }
  }

  const typeIcons: Record<string, React.ReactNode> = {
    IN: <ArrowDownCircle className="w-4 h-4 text-emerald-500" />,
    OUT: <ArrowUpCircle className="w-4 h-4 text-red-500" />,
    ADJUSTMENT: <RotateCcw className="w-4 h-4 text-blue-500" />,
  };
  const typeLabels: Record<string, string> = { IN: "Entrada", OUT: "Salida", ADJUSTMENT: "Ajuste" };

  return (
    <div className="space-y-6">
      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}

      <PageHeader icon={<Warehouse className="w-full h-full" />} title="Inventario" actions={<button onClick={() => { setForm({ productId: "", type: "IN", quantity: "", reason: "", newStock: "" }); setShowModal(true); }} className="btn-primary flex items-center gap-2"><Plus className="w-4 h-4" /> Nuevo Movimiento</button>} />

      {/* Low stock */}
      {products.filter(p => Number(p.stock) <= Number(p.minStock)).length > 0 && (
        <div className="card border-amber-200 dark:border-amber-800/50 bg-amber-50 dark:bg-amber-900/20">
          <h3 className="font-semibold text-amber-800 dark:text-amber-400 mb-2 text-balance">Productos con stock bajo</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
            {products.filter(p => Number(p.stock) <= Number(p.minStock)).map(p => (
              <div key={p.id} className="flex justify-between bg-white dark:bg-[#141925]/50 px-3 py-2 rounded-xl">
                <span className="text-sm">{p.name}</span>
                <span className="text-sm font-bold text-red-600">{Number(p.stock).toFixed(0)} {p.unit}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Movements history */}
      <div className="card">
        <h2 className="font-semibold text-slate-900 dark:text-white mb-4 text-balance">Historial de Movimientos</h2>
        {movements.length === 0 ? (
          <EmptyState icon={<Warehouse className="w-7 h-7" />} title="Sin movimientos" />
        ) : (
        <div className="overflow-x-auto -mx-4 px-4 sm:-mx-6 sm:px-6">
          <table className="w-full min-w-[600px]">
            <thead>
              <tr>
                <th className="table-header rounded-l-lg">Tipo</th>
                <th className="table-header">Producto</th>
                <th className="table-header text-right">Cantidad</th>
                <th className="table-header text-right hidden md:table-cell">Stock Anterior</th>
                <th className="table-header text-right hidden md:table-cell">Stock Nuevo</th>
                <th className="table-header hidden sm:table-cell">Razón</th>
                <th className="table-header hidden lg:table-cell">Usuario</th>
                <th className="table-header rounded-r-lg hidden sm:table-cell">Fecha</th>
              </tr>
            </thead>
            <tbody>
              {movements.map(m => (
                <tr key={m.id} className="hover:bg-slate-50 dark:hover:bg-white/[0.03]">
                  <td className="table-cell"><div className="flex items-center gap-2">{typeIcons[m.type]} {typeLabels[m.type]}</div></td>
                  <td className="table-cell font-medium truncate max-w-[140px]">{m.product.name}</td>
                  <td className="table-cell text-right font-semibold">{Number(m.quantity).toFixed(0)}</td>
                  <td className="table-cell text-right hidden md:table-cell">{Number(m.previousStock).toFixed(0)}</td>
                  <td className="table-cell text-right hidden md:table-cell">{Number(m.newStock).toFixed(0)}</td>
                  <td className="table-cell text-slate-500 dark:text-slate-400 hidden sm:table-cell truncate max-w-[120px]">{m.reason || "-"}</td>
                  <td className="table-cell hidden lg:table-cell">{m.user.name}</td>
                  <td className="table-cell hidden sm:table-cell">{formatDateTime(m.createdAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        )}
      </div>

      <Modal open={showModal} onClose={() => setShowModal(false)} title="Nuevo Movimiento de Inventario">
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Producto *</label>
            <select className="input-field" value={form.productId} onChange={e => setForm({...form, productId: e.target.value})} required>
              <option value="">Seleccionar...</option>
              {products.map(p => <option key={p.id} value={p.id}>{p.name} (Stock: {Number(p.stock).toFixed(0)})</option>)}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Tipo *</label>
            <select className="input-field" value={form.type} onChange={e => setForm({...form, type: e.target.value})}>
              <option value="IN">Entrada</option>
              <option value="OUT">Salida</option>
              <option value="ADJUSTMENT">Ajuste</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
              {form.type === "ADJUSTMENT" ? "Nuevo Stock" : "Cantidad"} *
            </label>
            <input type="number" step="1" className="input-field"
              value={form.type === "ADJUSTMENT" ? form.newStock : form.quantity}
              onChange={e => form.type === "ADJUSTMENT"
                ? setForm({...form, newStock: e.target.value, quantity: e.target.value})
                : setForm({...form, quantity: e.target.value})} required />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Razón</label>
            <input className="input-field" value={form.reason} onChange={e => setForm({...form, reason: e.target.value})} />
          </div>
          </div>
          <div className="flex flex-col sm:flex-row justify-end gap-2 pt-2">
            <button type="button" onClick={() => setShowModal(false)} className="btn-secondary">Cancelar</button>
            <button type="submit" className="btn-primary">Registrar</button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
