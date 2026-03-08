"use client";

import { useEffect, useState, useCallback } from "react";
import { Warehouse, Plus, ArrowDownCircle, ArrowUpCircle, RotateCcw } from "lucide-react";
import Modal from "@/components/ui/Modal";
import Toast from "@/components/ui/Toast";
import { formatDateTime } from "@/lib/utils";

interface Product { id: number; name: string; stock: string; minStock: string; unit: string; }
interface Movement {
  id: number; type: string; quantity: string; previousStock: string; newStock: string;
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

      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Warehouse className="w-7 h-7 text-indigo-600 dark:text-indigo-400" />
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Inventario</h1>
        </div>
        <button onClick={() => { setForm({ productId: "", type: "IN", quantity: "", reason: "", newStock: "" }); setShowModal(true); }} className="btn-primary flex items-center gap-2">
          <Plus className="w-4 h-4" /> Nuevo Movimiento
        </button>
      </div>

      {/* Low stock */}
      {products.filter(p => Number(p.stock) <= Number(p.minStock)).length > 0 && (
        <div className="card border-amber-200 dark:border-amber-800/50 bg-amber-50 dark:bg-amber-900/20">
          <h3 className="font-semibold text-amber-800 dark:text-amber-400 mb-2">Productos con stock bajo</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
            {products.filter(p => Number(p.stock) <= Number(p.minStock)).map(p => (
              <div key={p.id} className="flex justify-between bg-white dark:bg-gray-800/50 px-3 py-2 rounded-lg">
                <span className="text-sm">{p.name}</span>
                <span className="text-sm font-bold text-red-600">{Number(p.stock).toFixed(0)} {p.unit}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Movements history */}
      <div className="card">
        <h2 className="font-semibold text-gray-900 dark:text-white mb-4">Historial de Movimientos</h2>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr>
                <th className="table-header">Tipo</th>
                <th className="table-header">Producto</th>
                <th className="table-header text-right">Cantidad</th>
                <th className="table-header text-right">Stock Anterior</th>
                <th className="table-header text-right">Stock Nuevo</th>
                <th className="table-header">Razón</th>
                <th className="table-header">Usuario</th>
                <th className="table-header">Fecha</th>
              </tr>
            </thead>
            <tbody>
              {movements.map(m => (
                <tr key={m.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/50">
                  <td className="table-cell"><div className="flex items-center gap-2">{typeIcons[m.type]} {typeLabels[m.type]}</div></td>
                  <td className="table-cell font-medium">{m.product.name}</td>
                  <td className="table-cell text-right font-semibold">{Number(m.quantity).toFixed(0)}</td>
                  <td className="table-cell text-right">{Number(m.previousStock).toFixed(0)}</td>
                  <td className="table-cell text-right">{Number(m.newStock).toFixed(0)}</td>
                  <td className="table-cell text-gray-500 dark:text-gray-400">{m.reason || "-"}</td>
                  <td className="table-cell">{m.user.name}</td>
                  <td className="table-cell">{formatDateTime(m.createdAt)}</td>
                </tr>
              ))}
              {movements.length === 0 && (
                <tr><td colSpan={8} className="table-cell text-center text-gray-400 dark:text-gray-500 py-12">Sin movimientos</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <Modal open={showModal} onClose={() => setShowModal(false)} title="Nuevo Movimiento de Inventario">
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Producto *</label>
            <select className="input-field" value={form.productId} onChange={e => setForm({...form, productId: e.target.value})} required>
              <option value="">Seleccionar...</option>
              {products.map(p => <option key={p.id} value={p.id}>{p.name} (Stock: {Number(p.stock).toFixed(0)})</option>)}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Tipo *</label>
            <select className="input-field" value={form.type} onChange={e => setForm({...form, type: e.target.value})}>
              <option value="IN">Entrada</option>
              <option value="OUT">Salida</option>
              <option value="ADJUSTMENT">Ajuste</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              {form.type === "ADJUSTMENT" ? "Nuevo Stock" : "Cantidad"} *
            </label>
            <input type="number" step="1" className="input-field"
              value={form.type === "ADJUSTMENT" ? form.newStock : form.quantity}
              onChange={e => form.type === "ADJUSTMENT"
                ? setForm({...form, newStock: e.target.value, quantity: e.target.value})
                : setForm({...form, quantity: e.target.value})} required />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Razón</label>
            <input className="input-field" value={form.reason} onChange={e => setForm({...form, reason: e.target.value})} />
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <button type="button" onClick={() => setShowModal(false)} className="btn-secondary">Cancelar</button>
            <button type="submit" className="btn-primary">Registrar</button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
