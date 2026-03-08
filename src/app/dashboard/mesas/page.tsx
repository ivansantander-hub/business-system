"use client";

import { useEffect, useState, useCallback } from "react";
import { UtensilsCrossed, Plus, Users } from "lucide-react";
import Modal from "@/components/ui/Modal";
import Toast from "@/components/ui/Toast";
import { Button } from "@/components/atoms";
import { PageHeader } from "@/components/molecules";
import { formatCurrency } from "@/lib/utils";

interface TableData {
  id: string; number: string; capacity: number; section: string | null; status: string;
  orders: { id: string; total: string; waiter: { name: string } | null; items: { product: { name: string }; quantity: string; total: string; status: string }[] }[];
}
interface Waiter { id: string; name: string; }

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

  async function createOrder(tableId: string) {
    const res = await fetch("/api/orders", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ tableId, type: "TABLE", waiterId: selectedWaiter || undefined }),
    });
    if (res.ok) { load(); setToast({ message: "Orden abierta", type: "success" }); }
  }

  const statusColors: Record<string, string> = {
    AVAILABLE: "border-emerald-300 bg-emerald-50 dark:border-emerald-600 dark:bg-emerald-900/20",
    OCCUPIED: "border-red-300 bg-red-50 dark:border-red-600 dark:bg-red-900/20",
    RESERVED: "border-amber-300 bg-amber-50 dark:border-amber-600 dark:bg-amber-900/20",
  };
  const statusLabels: Record<string, string> = {
    AVAILABLE: "Disponible", OCCUPIED: "Ocupada", RESERVED: "Reservada",
  };

  const sections = [...new Set(tables.map(t => t.section).filter(Boolean))];

  return (
    <div className="space-y-6">
      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}

      <PageHeader
        icon={<UtensilsCrossed className="w-full h-full" />}
        title="Mesas"
        actions={
          <Button onClick={() => { setForm({ number: "", capacity: "4", section: "" }); setShowCreate(true); }} icon={<Plus className="w-4 h-4" />}>
            Nueva Mesa
          </Button>
        }
      />

      <div className="flex gap-4 flex-wrap">
        <div className="flex items-center gap-2"><div className="w-4 h-4 rounded bg-emerald-300 dark:bg-emerald-600" /><span className="text-sm text-slate-700 dark:text-slate-300">Disponible</span></div>
        <div className="flex items-center gap-2"><div className="w-4 h-4 rounded bg-red-300 dark:bg-red-600" /><span className="text-sm text-slate-700 dark:text-slate-300">Ocupada</span></div>
        <div className="flex items-center gap-2"><div className="w-4 h-4 rounded bg-amber-300 dark:bg-amber-600" /><span className="text-sm text-slate-700 dark:text-slate-300">Reservada</span></div>
      </div>

      {(sections.length > 0 ? sections : [null]).map(section => (
        <div key={section || "all"}>
          {section && <h3 className="font-semibold text-slate-700 dark:text-slate-300 mb-3">{section}</h3>}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 w-full">
            {tables.filter(t => section ? t.section === section : true).map(table => (
              <button key={table.id} onClick={() => setShowOrder(table)}
                className={`rounded-xl border-2 p-4 text-center transition-all hover:shadow-md ${statusColors[table.status]}`}>
                <p className="text-3xl font-bold text-slate-800">{table.number}</p>
                <p className="text-xs text-slate-500 mt-1">{statusLabels[table.status]}</p>
                <div className="flex items-center justify-center gap-1 mt-2 text-slate-400">
                  <Users className="w-3 h-3" />
                  <span className="text-xs">{table.capacity}</span>
                </div>
                {table.orders.length > 0 && (
                  <p className="text-sm font-semibold text-violet-600 dark:text-violet-400 mt-2">
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
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Número *</label>
            <input className="input-field" value={form.number} onChange={e => setForm({...form, number: e.target.value})} required />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Capacidad</label>
            <input type="number" className="input-field" value={form.capacity} onChange={e => setForm({...form, capacity: e.target.value})} />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Sección</label>
            <input className="input-field" value={form.section} onChange={e => setForm({...form, section: e.target.value})} placeholder="Ej: Interior, Terraza" />
          </div>
          <div className="flex flex-col sm:flex-row justify-end gap-2 sm:gap-3"><Button type="button" variant="secondary" onClick={() => setShowCreate(false)}>Cancelar</Button><Button type="submit">Crear</Button></div>
        </form>
      </Modal>

      {/* Table detail modal */}
      <Modal open={!!showOrder} onClose={() => setShowOrder(null)} title={showOrder ? `Mesa ${showOrder.number}` : ""} size="md">
        {showOrder && (
          <div className="space-y-4">
            <div className="flex items-center justify-between bg-slate-50 dark:bg-white/[0.03] rounded-lg p-3">
              <div>
                <p className="text-sm text-slate-500 dark:text-slate-400">Estado: <span className="font-semibold">{statusLabels[showOrder.status]}</span></p>
                <p className="text-sm text-slate-500 dark:text-slate-400">Capacidad: {showOrder.capacity} personas</p>
              </div>
            </div>

            {showOrder.orders.length > 0 ? (
              <div>
                <h4 className="font-medium text-slate-700 dark:text-slate-300 mb-2">Orden Activa</h4>
                {showOrder.orders[0].waiter && <p className="text-sm text-slate-500 dark:text-slate-400 mb-2">Mesero: {showOrder.orders[0].waiter.name}</p>}
                <div className="space-y-1">
                  {showOrder.orders[0].items.map((item, idx) => (
                    <div key={idx} className="flex justify-between text-sm py-1">
                      <span>{Number(item.quantity).toFixed(0)}x {item.product.name}</span>
                      <span className="font-medium">{formatCurrency(item.total)}</span>
                    </div>
                  ))}
                </div>
                <div className="border-t dark:border-slate-700 pt-2 mt-2 flex justify-between font-bold">
                  <span>Total</span>
                  <span>{formatCurrency(showOrder.orders[0].total)}</span>
                </div>
                <a href={`/dashboard/ordenes?id=${showOrder.orders[0].id}`} className="btn-primary w-full mt-3 block text-center">
                  Ver Orden Completa
                </a>
              </div>
            ) : (
              <div className="space-y-3">
                <p className="text-sm text-slate-500 dark:text-slate-400">Sin orden activa</p>
                {waiters.length > 0 && (
                  <div>
                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Asignar Mesero</label>
                    <select className="input-field" value={selectedWaiter} onChange={e => setSelectedWaiter(e.target.value)}>
                      <option value="">Sin mesero</option>
                      {waiters.map(w => <option key={w.id} value={w.id}>{w.name}</option>)}
                    </select>
                  </div>
                )}
                <Button variant="success" onClick={() => { createOrder(showOrder.id); setShowOrder(null); }} className="w-full">
                  Abrir Orden
                </Button>
              </div>
            )}
          </div>
        )}
      </Modal>
    </div>
  );
}
