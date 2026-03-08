"use client";

import { useEffect, useState, useCallback } from "react";
import { ShoppingBag, Plus, Eye, CheckCircle, XCircle } from "lucide-react";
import Modal from "@/components/ui/Modal";
import Toast from "@/components/ui/Toast";
import { formatCurrency, formatDate } from "@/lib/utils";

interface Purchase {
  id: number; number: string; date: string; subtotal: string; tax: string; total: string; status: string; notes: string | null;
  supplier: { name: string }; user: { name: string };
  items: { id: number; quantity: string; unitPrice: string; total: string; product: { name: string } }[];
}
interface Supplier { id: number; name: string; }
interface Product { id: number; name: string; costPrice: string; }

export default function ComprasPage() {
  const [purchases, setPurchases] = useState<Purchase[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [showCreate, setShowCreate] = useState(false);
  const [showDetail, setShowDetail] = useState<Purchase | null>(null);
  const [form, setForm] = useState({ supplierId: "", notes: "", items: [{ productId: "", quantity: "1", unitPrice: "" }] });
  const [toast, setToast] = useState<{ message: string; type: "success" | "error" } | null>(null);

  const load = useCallback(async () => {
    const res = await fetch("/api/purchases");
    setPurchases(res.ok ? await res.json() : []);
  }, []);

  useEffect(() => { load(); }, [load]);
  useEffect(() => {
    fetch("/api/suppliers").then(r => r.ok ? r.json() : []).then(setSuppliers);
    fetch("/api/products?active=true").then(r => r.ok ? r.json() : []).then(setProducts);
  }, []);

  function addItemRow() {
    setForm(prev => ({ ...prev, items: [...prev.items, { productId: "", quantity: "1", unitPrice: "" }] }));
  }

  function updateItem(index: number, field: string, value: string) {
    setForm(prev => {
      const items = [...prev.items];
      items[index] = { ...items[index], [field]: value };
      if (field === "productId") {
        const product = products.find(p => p.id === Number(value));
        if (product) items[index].unitPrice = product.costPrice;
      }
      return { ...prev, items };
    });
  }

  function removeItem(index: number) {
    setForm(prev => ({ ...prev, items: prev.items.filter((_, i) => i !== index) }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const validItems = form.items.filter(i => i.productId && Number(i.quantity) > 0);
    if (validItems.length === 0) { setToast({ message: "Agregue al menos un producto", type: "error" }); return; }
    const res = await fetch("/api/purchases", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ supplierId: form.supplierId, notes: form.notes, items: validItems }),
    });
    if (res.ok) { setShowCreate(false); load(); setToast({ message: "Orden de compra creada", type: "success" }); }
  }

  async function updateStatus(id: number, status: string) {
    const msg = status === "RECEIVED" ? "¿Marcar como recibida? Se actualizará el inventario." : "¿Cancelar esta orden?";
    if (!confirm(msg)) return;
    const res = await fetch(`/api/purchases/${id}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ status }) });
    if (res.ok) { setShowDetail(null); load(); setToast({ message: `Orden ${status === "RECEIVED" ? "recibida" : "cancelada"}`, type: "success" }); }
  }

  const statusColors: Record<string, string> = { PENDING: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400", RECEIVED: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400", CANCELLED: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400" };
  const statusLabels: Record<string, string> = { PENDING: "Pendiente", RECEIVED: "Recibida", CANCELLED: "Cancelada" };

  return (
    <div className="space-y-6">
      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3"><ShoppingBag className="w-7 h-7 text-indigo-600 dark:text-indigo-400" /><h1 className="text-2xl font-bold text-gray-900 dark:text-white">Compras</h1></div>
        <button onClick={() => { setForm({ supplierId: "", notes: "", items: [{ productId: "", quantity: "1", unitPrice: "" }] }); setShowCreate(true); }} className="btn-primary flex items-center gap-2"><Plus className="w-4 h-4" /> Nueva Orden</button>
      </div>

      <div className="card overflow-x-auto">
        <table className="w-full">
          <thead><tr><th className="table-header">Número</th><th className="table-header">Proveedor</th><th className="table-header text-right">Total</th><th className="table-header">Estado</th><th className="table-header">Fecha</th><th className="table-header">Acciones</th></tr></thead>
          <tbody>
            {purchases.map(p => (
              <tr key={p.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/50">
                <td className="table-cell font-medium">{p.number}</td><td className="table-cell">{p.supplier.name}</td>
                <td className="table-cell text-right font-semibold">{formatCurrency(p.total)}</td>
                <td className="table-cell"><span className={`px-2 py-1 rounded-full text-xs font-medium ${statusColors[p.status]}`}>{statusLabels[p.status]}</span></td>
                <td className="table-cell">{formatDate(p.date)}</td>
                <td className="table-cell"><button onClick={() => setShowDetail(p)} className="p-1.5 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 rounded-lg"><Eye className="w-4 h-4 text-indigo-600 dark:text-indigo-400" /></button></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Create purchase */}
      <Modal open={showCreate} onClose={() => setShowCreate(false)} title="Nueva Orden de Compra" size="xl">
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div><label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Proveedor *</label>
              <select className="input-field" value={form.supplierId} onChange={e => setForm({...form, supplierId: e.target.value})} required>
                <option value="">Seleccionar...</option>{suppliers.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select></div>
            <div><label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Notas</label><input className="input-field" value={form.notes} onChange={e => setForm({...form, notes: e.target.value})} /></div>
          </div>

          <div><h4 className="font-medium text-gray-700 mb-2">Productos</h4>
            {form.items.map((item, i) => (
              <div key={i} className="flex gap-2 mb-2">
                <select className="input-field flex-1" value={item.productId} onChange={e => updateItem(i, "productId", e.target.value)}>
                  <option value="">Producto...</option>{products.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
                <input type="number" min="1" className="input-field w-24" placeholder="Cant" value={item.quantity} onChange={e => updateItem(i, "quantity", e.target.value)} />
                <input type="number" step="0.01" className="input-field w-32" placeholder="P/U" value={item.unitPrice} onChange={e => updateItem(i, "unitPrice", e.target.value)} />
                <span className="input-field w-32 bg-gray-50 dark:bg-gray-700/50 flex items-center">{formatCurrency(Number(item.quantity) * Number(item.unitPrice) || 0)}</span>
                {form.items.length > 1 && <button type="button" onClick={() => removeItem(i)} className="text-red-500 px-2"><XCircle className="w-5 h-5" /></button>}
              </div>
            ))}
            <button type="button" onClick={addItemRow} className="text-indigo-600 text-sm font-medium hover:underline">+ Agregar producto</button>
          </div>

          <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-3 text-right">
            <p className="font-bold text-lg">Subtotal: {formatCurrency(form.items.reduce((s, i) => s + Number(i.quantity) * Number(i.unitPrice), 0))}</p>
          </div>

          <div className="flex justify-end gap-3"><button type="button" onClick={() => setShowCreate(false)} className="btn-secondary">Cancelar</button><button type="submit" className="btn-primary">Crear Orden</button></div>
        </form>
      </Modal>

      {/* Detail */}
      <Modal open={!!showDetail} onClose={() => setShowDetail(null)} title={showDetail ? `Compra ${showDetail.number}` : ""} size="lg">
        {showDetail && (
          <div className="space-y-4">
            <div className="text-sm grid grid-cols-2 gap-2"><div>Proveedor: <b>{showDetail.supplier.name}</b></div><div>Estado: <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${statusColors[showDetail.status]}`}>{statusLabels[showDetail.status]}</span></div></div>
            <table className="w-full"><thead><tr><th className="table-header">Producto</th><th className="table-header text-right">Cant</th><th className="table-header text-right">P/U</th><th className="table-header text-right">Total</th></tr></thead>
              <tbody>{showDetail.items.map(item => (<tr key={item.id}><td className="table-cell">{item.product.name}</td><td className="table-cell text-right">{Number(item.quantity).toFixed(0)}</td><td className="table-cell text-right">{formatCurrency(item.unitPrice)}</td><td className="table-cell text-right font-medium">{formatCurrency(item.total)}</td></tr>))}</tbody></table>
            <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-3 text-right font-bold text-lg">Total: {formatCurrency(showDetail.total)}</div>
            {showDetail.status === "PENDING" && (
              <div className="flex gap-3"><button onClick={() => updateStatus(showDetail.id, "RECEIVED")} className="btn-success flex items-center gap-2 flex-1"><CheckCircle className="w-4 h-4" /> Marcar Recibida</button><button onClick={() => updateStatus(showDetail.id, "CANCELLED")} className="btn-danger flex items-center gap-2"><XCircle className="w-4 h-4" /> Cancelar</button></div>
            )}
          </div>
        )}
      </Modal>
    </div>
  );
}
