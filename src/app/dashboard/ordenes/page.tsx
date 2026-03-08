"use client";

import { useEffect, useState, useCallback } from "react";
import { ClipboardList, Search, Plus, Eye, CheckCircle, CreditCard, XCircle } from "lucide-react";
import Modal from "@/components/ui/Modal";
import Toast from "@/components/ui/Toast";
import { formatCurrency, formatDateTime } from "@/lib/utils";

interface Order {
  id: number; type: string; status: string; subtotal: string; tax: string; total: string; notes: string | null;
  createdAt: string; table: { number: string } | null; customer: { name: string } | null;
  user: { name: string }; waiter: { name: string } | null;
  items: { id: number; quantity: string; unitPrice: string; total: string; status: string; notes: string | null; product: { name: string; salePrice: string } }[];
}
interface Product { id: number; name: string; salePrice: string; }

export default function OrdenesPage() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [statusFilter, setStatusFilter] = useState("OPEN");
  const [showDetail, setShowDetail] = useState<Order | null>(null);
  const [showAddItem, setShowAddItem] = useState(false);
  const [itemForm, setItemForm] = useState({ productId: "", quantity: "1", notes: "" });
  const [search, setSearch] = useState("");
  const [toast, setToast] = useState<{ message: string; type: "success" | "error" } | null>(null);

  const load = useCallback(async () => {
    const params = new URLSearchParams();
    if (statusFilter) params.set("status", statusFilter);
    const res = await fetch(`/api/orders?${params}`);
    if (res.ok) setOrders(await res.json());
    else setOrders([]);
  }, [statusFilter]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => { fetch("/api/products?active=true").then(r => r.ok ? r.json() : []).then(setProducts); }, []);

  async function addItem(e: React.FormEvent) {
    e.preventDefault();
    if (!showDetail) return;
    const res = await fetch(`/api/orders/${showDetail.id}/items`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify(itemForm),
    });
    if (res.ok) {
      setShowAddItem(false);
      const updRes = await fetch(`/api/orders/${showDetail.id}`);
      if (updRes.ok) setShowDetail(await updRes.json());
      load();
      setToast({ message: "Producto agregado", type: "success" });
    }
  }

  async function updateOrderStatus(id: number, status: string, message: string) {
    const res = await fetch(`/api/orders/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
    if (res.ok) {
      setShowDetail(null);
      load();
      setToast({ message, type: "success" });
    } else {
      setToast({ message: "Error al actualizar orden", type: "error" });
    }
  }

  async function cancelOrder(id: number) {
    if (!confirm("¿Cancelar esta orden?")) return;
    await updateOrderStatus(id, "CANCELLED", "Orden cancelada");
  }

  const statusColors: Record<string, string> = {
    OPEN: "bg-blue-100 text-blue-700", READY: "bg-emerald-100 text-emerald-700",
    PAID: "bg-gray-100 text-gray-600", CANCELLED: "bg-red-100 text-red-700",
  };
  const statusLabels: Record<string, string> = { OPEN: "Abierta", READY: "Lista", PAID: "Pagada", CANCELLED: "Cancelada" };
  const typeLabels: Record<string, string> = { TABLE: "Mesa", TAKEOUT: "Para Llevar", DELIVERY: "Domicilio" };

  const filteredProducts = products.filter(p => p.name.toLowerCase().includes(search.toLowerCase()));
  const hasItems = showDetail ? showDetail.items.filter(i => i.status !== "CANCELLED").length > 0 : false;

  return (
    <div className="space-y-6">
      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}

      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <ClipboardList className="w-7 h-7 text-indigo-600" />
          <h1 className="text-2xl font-bold text-gray-900">Órdenes</h1>
        </div>
      </div>

      <div className="card">
        <div className="flex gap-2 mb-4">
          {["OPEN", "READY", "PAID", "CANCELLED", ""].map(s => (
            <button key={s} onClick={() => setStatusFilter(s)}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${statusFilter === s ? "bg-indigo-600 text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200"}`}>
              {s ? statusLabels[s] : "Todas"}
            </button>
          ))}
        </div>

        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr>
                <th className="table-header">#</th>
                <th className="table-header">Tipo</th>
                <th className="table-header">Mesa</th>
                <th className="table-header">Mesero</th>
                <th className="table-header text-right">Total</th>
                <th className="table-header">Estado</th>
                <th className="table-header">Fecha</th>
                <th className="table-header">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {orders.map(o => (
                <tr key={o.id} className="hover:bg-gray-50">
                  <td className="table-cell font-medium">#{o.id}</td>
                  <td className="table-cell">{typeLabels[o.type]}</td>
                  <td className="table-cell">{o.table?.number || "-"}</td>
                  <td className="table-cell">{o.waiter?.name || "-"}</td>
                  <td className="table-cell text-right font-semibold">{formatCurrency(o.total)}</td>
                  <td className="table-cell"><span className={`px-2 py-1 rounded-full text-xs font-medium ${statusColors[o.status]}`}>{statusLabels[o.status]}</span></td>
                  <td className="table-cell">{formatDateTime(o.createdAt)}</td>
                  <td className="table-cell">
                    <button onClick={() => setShowDetail(o)} className="p-1.5 hover:bg-indigo-50 rounded-lg"><Eye className="w-4 h-4 text-indigo-600" /></button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <Modal open={!!showDetail} onClose={() => setShowDetail(null)} title={showDetail ? `Orden #${showDetail.id}` : ""} size="lg">
        {showDetail && (
          <div className="space-y-4">
            <div className="grid grid-cols-3 gap-3 text-sm">
              <div><span className="text-gray-500">Tipo:</span> <span className="font-medium">{typeLabels[showDetail.type]}</span></div>
              <div><span className="text-gray-500">Mesa:</span> <span className="font-medium">{showDetail.table?.number || "-"}</span></div>
              <div><span className="text-gray-500">Mesero:</span> <span className="font-medium">{showDetail.waiter?.name || "-"}</span></div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full">
                <thead><tr><th className="table-header">Producto</th><th className="table-header text-right">Cant</th><th className="table-header text-right">Precio</th><th className="table-header text-right">Total</th><th className="table-header">Estado</th></tr></thead>
                <tbody>
                  {showDetail.items.map(item => (
                    <tr key={item.id}><td className="table-cell">{item.product.name}</td><td className="table-cell text-right">{Number(item.quantity).toFixed(0)}</td><td className="table-cell text-right">{formatCurrency(item.unitPrice)}</td><td className="table-cell text-right font-medium">{formatCurrency(item.total)}</td><td className="table-cell"><span className={`px-2 py-0.5 rounded-full text-xs ${statusColors[item.status] || "bg-gray-100"}`}>{item.status}</span></td></tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="bg-gray-50 rounded-lg p-3 space-y-1 text-sm">
              <div className="flex justify-between"><span>Subtotal</span><span>{formatCurrency(showDetail.subtotal)}</span></div>
              <div className="flex justify-between"><span>IVA</span><span>{formatCurrency(showDetail.tax)}</span></div>
              <div className="flex justify-between font-bold text-base pt-1 border-t"><span>Total</span><span>{formatCurrency(showDetail.total)}</span></div>
            </div>

            {showDetail.status === "OPEN" && (
              <div className="flex gap-3">
                <button onClick={() => setShowAddItem(true)} className="btn-primary flex items-center gap-2 flex-1">
                  <Plus className="w-4 h-4" /> Agregar Producto
                </button>
                {hasItems && (
                  <button onClick={() => updateOrderStatus(showDetail.id, "READY", "Orden marcada como lista")}
                    className="btn-success flex items-center gap-2 flex-1">
                    <CheckCircle className="w-4 h-4" /> Marcar Lista
                  </button>
                )}
                <button onClick={() => cancelOrder(showDetail.id)} className="btn-danger flex items-center gap-2">
                  <XCircle className="w-4 h-4" /> Cancelar
                </button>
              </div>
            )}

            {showDetail.status === "READY" && (
              <div className="flex gap-3">
                <button onClick={() => updateOrderStatus(showDetail.id, "PAID", "Orden cobrada")}
                  className="btn-success flex items-center gap-2 flex-1">
                  <CreditCard className="w-4 h-4" /> Cobrar Orden
                </button>
                <button onClick={() => cancelOrder(showDetail.id)} className="btn-danger flex items-center gap-2">
                  <XCircle className="w-4 h-4" /> Cancelar
                </button>
              </div>
            )}
          </div>
        )}
      </Modal>

      <Modal open={showAddItem} onClose={() => setShowAddItem(false)} title="Agregar Producto a Orden" size="md">
        <form onSubmit={addItem} className="space-y-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input className="input-field pl-9" placeholder="Buscar producto..." value={search} onChange={e => setSearch(e.target.value)} />
          </div>
          <div className="max-h-48 overflow-y-auto space-y-1">
            {filteredProducts.slice(0, 20).map(p => (
              <button key={p.id} type="button" onClick={() => setItemForm({...itemForm, productId: String(p.id)})}
                className={`w-full flex justify-between p-2 rounded-lg text-sm ${String(p.id) === itemForm.productId ? "bg-indigo-50 border border-indigo-300" : "hover:bg-gray-50"}`}>
                <span>{p.name}</span><span className="font-medium">{formatCurrency(p.salePrice)}</span>
              </button>
            ))}
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div><label className="block text-sm font-medium text-gray-700 mb-1">Cantidad</label><input type="number" min="1" className="input-field" value={itemForm.quantity} onChange={e => setItemForm({...itemForm, quantity: e.target.value})} /></div>
            <div><label className="block text-sm font-medium text-gray-700 mb-1">Notas</label><input className="input-field" value={itemForm.notes} onChange={e => setItemForm({...itemForm, notes: e.target.value})} /></div>
          </div>
          <div className="flex justify-end gap-3"><button type="button" onClick={() => setShowAddItem(false)} className="btn-secondary">Cancelar</button><button type="submit" disabled={!itemForm.productId} className="btn-primary">Agregar</button></div>
        </form>
      </Modal>
    </div>
  );
}
