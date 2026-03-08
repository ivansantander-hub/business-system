"use client";

import { useEffect, useState, useCallback } from "react";
import { Ticket, Plus, Search } from "lucide-react";
import Modal from "@/components/ui/Modal";
import Toast from "@/components/ui/Toast";
import { formatCurrency, formatDate } from "@/lib/utils";

interface Customer {
  id: string;
  name: string;
  email: string | null;
  nit: string | null;
  phone: string | null;
}

interface DayPass {
  id: string;
  date: string;
  price: string;
  status: string;
  totalEntries: number;
  usedEntries: number;
  guestName: string | null;
  member: { id: string; customer: Customer } | null;
}

function statusBadgeClass(status: string) {
  if (status === "ACTIVE") return "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400";
  if (status === "USED") return "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400";
  return "bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400";
}

function statusLabel(status: string) {
  if (status === "ACTIVE") return "Activa";
  if (status === "USED") return "Agotada";
  return "Expirada";
}

export default function TiqueterasPage() {
  const [dayPasses, setDayPasses] = useState<DayPass[]>([]);
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState({ customerId: "", guestName: "", price: "15000", totalEntries: "10", paymentMethod: "CASH", paidAmount: "" });
  const [customerSearch, setCustomerSearch] = useState("");
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [toast, setToast] = useState<{ message: string; type: "success" | "error" } | null>(null);
  const [hasCashSession, setHasCashSession] = useState(false);

  const loadPasses = useCallback(async () => {
    const res = await fetch("/api/day-passes?from=2000-01-01");
    if (res.ok) setDayPasses(await res.json());
  }, []);

  useEffect(() => { loadPasses(); }, [loadPasses]);

  useEffect(() => {
    fetch("/api/cash?action=current")
      .then(r => r.json())
      .then(data => setHasCashSession(!!data?.id))
      .catch(() => setHasCashSession(false));
  }, []);

  useEffect(() => {
    if (showModal) {
      const params = customerSearch ? `?search=${encodeURIComponent(customerSearch)}` : "";
      fetch(`/api/customers${params}`)
        .then(r => r.ok ? r.json() : []).then(setCustomers);
    }
  }, [customerSearch, showModal]);

  const stats = {
    total: dayPasses.length,
    active: dayPasses.filter((p) => p.status === "ACTIVE").length,
    used: dayPasses.filter((p) => p.status === "USED").length,
    totalEntriesRemaining: dayPasses
      .filter((p) => p.status === "ACTIVE")
      .reduce((sum, p) => sum + (p.totalEntries - p.usedEntries), 0),
  };

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!form.customerId && !form.guestName.trim()) {
      setToast({ message: "Seleccione un cliente o ingrese nombre de invitado", type: "error" });
      return;
    }
    const res = await fetch("/api/day-passes", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        customerId: form.customerId || undefined,
        guestName: form.guestName.trim() || undefined,
        price: Number(form.price) || 0,
        totalEntries: Number(form.totalEntries) || 1,
        paymentMethod: form.paymentMethod,
        paidAmount: Number(form.paidAmount) || undefined,
      }),
    });
    if (res.ok) {
      setShowModal(false);
      setForm({ customerId: "", guestName: "", price: "15000", totalEntries: "10", paymentMethod: "CASH", paidAmount: "" });
      setCustomerSearch("");
      loadPasses();
      setToast({ message: "Tiquetera creada y facturada", type: "success" });
    } else {
      try {
        const data = await res.json();
        setToast({ message: data.error || "Error al crear", type: "error" });
      } catch {
        setToast({ message: "Error al crear tiquetera", type: "error" });
      }
    }
  }

  const displayName = (p: DayPass) => p.member?.customer?.name || p.guestName || "-";

  return (
    <div className="space-y-6">
      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Ticket className="w-7 h-7 text-indigo-600 dark:text-indigo-400" />
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Tiqueteras</h1>
        </div>
        <button
          onClick={() => {
            if (!hasCashSession) {
              setToast({ message: "Debe abrir una caja antes de vender tiqueteras", type: "error" });
              return;
            }
            setForm({ customerId: "", guestName: "", price: "15000", totalEntries: "10", paymentMethod: "CASH", paidAmount: "" });
            setCustomerSearch("");
            setShowModal(true);
          }}
          className="btn-primary flex items-center gap-2"
        >
          <Plus className="w-4 h-4" /> Nueva Tiquetera
        </button>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="card">
          <p className="text-sm text-gray-500 dark:text-gray-400">Total</p>
          <p className="text-2xl font-bold text-gray-900 dark:text-white">{stats.total}</p>
        </div>
        <div className="card">
          <p className="text-sm text-gray-500 dark:text-gray-400">Activas</p>
          <p className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">{stats.active}</p>
        </div>
        <div className="card">
          <p className="text-sm text-gray-500 dark:text-gray-400">Agotadas</p>
          <p className="text-2xl font-bold text-blue-600 dark:text-blue-400">{stats.used}</p>
        </div>
        <div className="card">
          <p className="text-sm text-gray-500 dark:text-gray-400">Entradas restantes</p>
          <p className="text-2xl font-bold text-amber-600 dark:text-amber-400">{stats.totalEntriesRemaining}</p>
        </div>
      </div>

      <div className="card overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr>
              <th className="table-header">Fecha</th>
              <th className="table-header">Cliente / Invitado</th>
              <th className="table-header">Documento</th>
              <th className="table-header text-center">Entradas</th>
              <th className="table-header text-right">Precio</th>
              <th className="table-header">Estado</th>
            </tr>
          </thead>
          <tbody>
            {dayPasses.map((p) => (
              <tr key={p.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/50">
                <td className="table-cell">{formatDate(p.date)}</td>
                <td className="table-cell font-medium">{displayName(p)}</td>
                <td className="table-cell font-mono text-sm">{p.member?.customer?.nit || "-"}</td>
                <td className="table-cell text-center">
                  <span className="font-semibold">{p.usedEntries}</span>
                  <span className="text-gray-400"> / </span>
                  <span className="text-gray-600 dark:text-gray-300">{p.totalEntries}</span>
                  {p.status === "ACTIVE" && (
                    <span className="ml-2 text-xs text-emerald-600 dark:text-emerald-400">({p.totalEntries - p.usedEntries} restantes)</span>
                  )}
                </td>
                <td className="table-cell text-right">{formatCurrency(p.price)}</td>
                <td className="table-cell">
                  <span className={`inline-flex px-2.5 py-0.5 rounded-full text-xs font-medium ${statusBadgeClass(p.status)}`}>
                    {statusLabel(p.status)}
                  </span>
                </td>
              </tr>
            ))}
            {dayPasses.length === 0 && (
              <tr>
                <td colSpan={6} className="table-cell text-center text-gray-400 py-12">
                  Sin tiqueteras
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <Modal open={showModal} onClose={() => setShowModal(false)} title="Nueva Tiquetera" size="md">
        <form onSubmit={handleCreate} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Buscar cliente</label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                className="input-field pl-9"
                placeholder="Nombre, documento, teléfono..."
                value={customerSearch}
                onChange={(e) => { setCustomerSearch(e.target.value); setForm({...form, customerId: ""}); }}
              />
            </div>
            <div className="mt-1 max-h-36 overflow-y-auto border border-gray-200 dark:border-gray-600 rounded-lg">
              {customers.length === 0 ? (
                <p className="text-sm text-gray-400 text-center py-3">
                  {customerSearch ? "Sin resultados" : "Cargando clientes..."}
                </p>
              ) : (
                customers.map((c) => (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => { setForm({...form, customerId: String(c.id), guestName: ""}); setCustomerSearch(c.name); }}
                    className={`w-full text-left px-3 py-2 text-sm border-b border-gray-100 dark:border-gray-700 last:border-0 transition-colors ${
                      form.customerId === String(c.id)
                        ? "bg-indigo-50 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300"
                        : "hover:bg-gray-50 dark:hover:bg-gray-700/50"
                    }`}
                  >
                    <span className="font-medium">{c.name}</span>
                    {c.nit && <span className="text-gray-400 ml-2">Doc: {c.nit}</span>}
                    {c.phone && <span className="text-gray-400 ml-2">Tel: {c.phone}</span>}
                  </button>
                ))
              )}
            </div>
            {form.customerId && <p className="text-xs text-emerald-600 dark:text-emerald-400 mt-1">Cliente seleccionado</p>}
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Nombre invitado (si no es cliente)</label>
            <input
              className="input-field"
              placeholder="Nombre del invitado"
              value={form.guestName}
              onChange={(e) => setForm({ ...form, guestName: e.target.value, customerId: "" })}
              disabled={!!form.customerId}
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Número de entradas *</label>
              <input
                type="number"
                min="1"
                className="input-field"
                value={form.totalEntries}
                onChange={(e) => setForm({ ...form, totalEntries: e.target.value })}
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Precio *</label>
              <input
                type="number"
                step="100"
                min="0"
                className="input-field"
                value={form.price}
                onChange={(e) => setForm({ ...form, price: e.target.value })}
                required
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Método de pago *</label>
              <select
                className="input-field"
                value={form.paymentMethod}
                onChange={(e) => setForm({ ...form, paymentMethod: e.target.value })}
              >
                <option value="CASH">Efectivo</option>
                <option value="CARD">Tarjeta</option>
                <option value="TRANSFER">Transferencia</option>
                <option value="CREDIT">Crédito</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Monto recibido</label>
              <input
                type="number"
                min="0"
                step="100"
                className="input-field"
                value={form.paidAmount}
                onChange={(e) => setForm({ ...form, paidAmount: e.target.value })}
                placeholder="Precio total"
              />
            </div>
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <button type="button" onClick={() => setShowModal(false)} className="btn-secondary">Cancelar</button>
            <button type="submit" className="btn-primary">Vender Tiquetera</button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
