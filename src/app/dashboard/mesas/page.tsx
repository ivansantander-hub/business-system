"use client";

import { useEffect, useState, useCallback } from "react";
import { UtensilsCrossed, Plus, Users } from "lucide-react";
import Modal from "@/components/ui/Modal";
import Toast from "@/components/ui/Toast";
import { formatCurrency } from "@/lib/utils";

interface TableData {
  id: number; number: string; capacity: number; section: string | null; status: string;
  orders: { id: number; total: string; waiter: { name: string } | null; items: { product: { name: string }; quantity: string; total: string; status: string }[] }[];
}
interface Waiter { id: number; name: string; }

export default function MesasPage() {
  const [tables, setTables] = useState<TableData[]>([]);
  const [waiters, setWaiters] = useState<Waiter[]>([]);
  const [showCreate, setShowCreate] = useState(false);
  const [showOrder, setShowOrder] = useState<TableData | null>(null);
  const [form, setForm] = useState({ number: "", capacity: "4", section: "" });
  const [toast, setToast] = useState<{ message: string; type: "success" | "error" } | null>(null);
  const [selectedWaiter, setSelectedWaiter] = useState("");

  const load = useCallback(async () => {
    const [tRes, usersRes] = await Promise.all([
      fetch("/api/tables"),
      fetch("/api/users"),
    ]);
    const t = tRes.ok ? await tRes.json() : [];
    const users = usersRes.ok ? await usersRes.json() : [];
    setTables(t);
    setWaiters(Array.isArray(users) ? users.filter((u: { role: string }) => u.role === "WAITER") : []);
  }, []);

  useEffect(() => { load(); }, [load]);

  async function createTable(e: React.FormEvent) {
    e.preventDefault();
    const res = await fetch("/api/tables", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    if (res.ok) { setShowCreate(false); load(); setToast({ message: "Mesa creada", type: "success" }); }
  }

  async function createOrder(tableId: number) {
    const res = await fetch("/api/orders", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ tableId, type: "TABLE", waiterId: selectedWaiter ? Number(selectedWaiter) : undefined }),
    });
    if (res.ok) { load(); setToast({ message: "Orden abierta", type: "success" }); }
  }

  const statusColors: Record<string, string> = {
    AVAILABLE: "border-emerald-300 bg-emerald-50",
    OCCUPIED: "border-red-300 bg-red-50",
    RESERVED: "border-amber-300 bg-amber-50",
  };
  const statusLabels: Record<string, string> = {
    AVAILABLE: "Disponible", OCCUPIED: "Ocupada", RESERVED: "Reservada",
  };

  const sections = [...new Set(tables.map(t => t.section).filter(Boolean))];

  return (
    <div className="space-y-6">
      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}

      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <UtensilsCrossed className="w-7 h-7 text-indigo-600" />
          <h1 className="text-2xl font-bold text-gray-900">Mesas</h1>
        </div>
        <button onClick={() => { setForm({ number: "", capacity: "4", section: "" }); setShowCreate(true); }} className="btn-primary flex items-center gap-2">
          <Plus className="w-4 h-4" /> Nueva Mesa
        </button>
      </div>

      <div className="flex gap-4 flex-wrap">
        <div className="flex items-center gap-2"><div className="w-4 h-4 rounded bg-emerald-300" /><span className="text-sm">Disponible</span></div>
        <div className="flex items-center gap-2"><div className="w-4 h-4 rounded bg-red-300" /><span className="text-sm">Ocupada</span></div>
        <div className="flex items-center gap-2"><div className="w-4 h-4 rounded bg-amber-300" /><span className="text-sm">Reservada</span></div>
      </div>

      {(sections.length > 0 ? sections : [null]).map(section => (
        <div key={section || "all"}>
          {section && <h3 className="font-semibold text-gray-700 mb-3">{section}</h3>}
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
            {tables.filter(t => section ? t.section === section : true).map(table => (
              <button key={table.id} onClick={() => setShowOrder(table)}
                className={`rounded-xl border-2 p-4 text-center transition-all hover:shadow-md ${statusColors[table.status]}`}>
                <p className="text-3xl font-bold text-gray-800">{table.number}</p>
                <p className="text-xs text-gray-500 mt-1">{statusLabels[table.status]}</p>
                <div className="flex items-center justify-center gap-1 mt-2 text-gray-400">
                  <Users className="w-3 h-3" />
                  <span className="text-xs">{table.capacity}</span>
                </div>
                {table.orders.length > 0 && (
                  <p className="text-sm font-semibold text-indigo-600 mt-2">
                    {formatCurrency(table.orders[0].total)}
                  </p>
                )}
              </button>
            ))}
          </div>
        </div>
      ))}

      {/* Create table modal */}
      <Modal open={showCreate} onClose={() => setShowCreate(false)} title="Nueva Mesa" size="sm">
        <form onSubmit={createTable} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Número *</label>
            <input className="input-field" value={form.number} onChange={e => setForm({...form, number: e.target.value})} required />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Capacidad</label>
            <input type="number" className="input-field" value={form.capacity} onChange={e => setForm({...form, capacity: e.target.value})} />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Sección</label>
            <input className="input-field" value={form.section} onChange={e => setForm({...form, section: e.target.value})} placeholder="Ej: Interior, Terraza" />
          </div>
          <div className="flex justify-end gap-3"><button type="button" onClick={() => setShowCreate(false)} className="btn-secondary">Cancelar</button><button type="submit" className="btn-primary">Crear</button></div>
        </form>
      </Modal>

      {/* Table detail modal */}
      <Modal open={!!showOrder} onClose={() => setShowOrder(null)} title={showOrder ? `Mesa ${showOrder.number}` : ""} size="md">
        {showOrder && (
          <div className="space-y-4">
            <div className="flex items-center justify-between bg-gray-50 rounded-lg p-3">
              <div>
                <p className="text-sm text-gray-500">Estado: <span className="font-semibold">{statusLabels[showOrder.status]}</span></p>
                <p className="text-sm text-gray-500">Capacidad: {showOrder.capacity} personas</p>
              </div>
            </div>

            {showOrder.orders.length > 0 ? (
              <div>
                <h4 className="font-medium text-gray-700 mb-2">Orden Activa</h4>
                {showOrder.orders[0].waiter && <p className="text-sm text-gray-500 mb-2">Mesero: {showOrder.orders[0].waiter.name}</p>}
                <div className="space-y-1">
                  {showOrder.orders[0].items.map((item, idx) => (
                    <div key={idx} className="flex justify-between text-sm py-1">
                      <span>{Number(item.quantity).toFixed(0)}x {item.product.name}</span>
                      <span className="font-medium">{formatCurrency(item.total)}</span>
                    </div>
                  ))}
                </div>
                <div className="border-t pt-2 mt-2 flex justify-between font-bold">
                  <span>Total</span>
                  <span>{formatCurrency(showOrder.orders[0].total)}</span>
                </div>
                <a href={`/dashboard/ordenes?id=${showOrder.orders[0].id}`} className="btn-primary w-full mt-3 block text-center">
                  Ver Orden Completa
                </a>
              </div>
            ) : (
              <div className="space-y-3">
                <p className="text-sm text-gray-500">Sin orden activa</p>
                {waiters.length > 0 && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Asignar Mesero</label>
                    <select className="input-field" value={selectedWaiter} onChange={e => setSelectedWaiter(e.target.value)}>
                      <option value="">Sin mesero</option>
                      {waiters.map(w => <option key={w.id} value={w.id}>{w.name}</option>)}
                    </select>
                  </div>
                )}
                <button onClick={() => { createOrder(showOrder.id); setShowOrder(null); }} className="btn-success w-full">
                  Abrir Orden
                </button>
              </div>
            )}
          </div>
        )}
      </Modal>
    </div>
  );
}
