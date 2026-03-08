"use client";

import { useEffect, useState, useCallback } from "react";
import { Ticket, Plus, LogIn } from "lucide-react";
import Modal from "@/components/ui/Modal";
import Toast from "@/components/ui/Toast";
import { formatCurrency, formatDate } from "@/lib/utils";

interface Customer {
  id: number;
  name: string;
  email: string | null;
}

interface DayPass {
  id: number;
  date: string;
  price: string;
  status: string;
  guestName: string | null;
  member: { id: number; customer: Customer } | null;
}

interface GymMember {
  id: number;
  customer: Customer;
}

function statusBadgeClass(status: string) {
  if (status === "ACTIVE") return "bg-emerald-100 text-emerald-800";
  if (status === "USED") return "bg-blue-100 text-blue-800";
  return "bg-gray-100 text-gray-600";
}

export default function TiqueterasPage() {
  const [dayPasses, setDayPasses] = useState<DayPass[]>([]);
  const [members, setMembers] = useState<GymMember[]>([]);
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState({ memberId: "", guestName: "", price: "0" });
  const [toast, setToast] = useState<{ message: string; type: "success" | "error" } | null>(null);

  const loadPasses = useCallback(async () => {
    const res = await fetch("/api/day-passes");
    if (res.ok) setDayPasses(await res.json());
  }, []);

  const loadMembers = useCallback(async () => {
    const res = await fetch("/api/gym-members?search=");
    if (res.ok) setMembers(await res.json());
  }, []);

  useEffect(() => {
    loadPasses();
  }, [loadPasses]);

  useEffect(() => {
    if (showModal) loadMembers();
  }, [showModal, loadMembers]);

  const stats = {
    total: dayPasses.length,
    active: dayPasses.filter((p) => p.status === "ACTIVE").length,
    used: dayPasses.filter((p) => p.status === "USED").length,
  };

  async function handleCreate(e: { preventDefault: () => void }) {
    e.preventDefault();
    if (!form.memberId && !form.guestName.trim()) {
      setToast({ message: "Seleccione un miembro o ingrese nombre de invitado", type: "error" });
      return;
    }
    const res = await fetch("/api/day-passes", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        memberId: form.memberId || undefined,
        guestName: form.guestName.trim() || undefined,
        price: Number(form.price) || 0,
      }),
    });
    if (res.ok) {
      setShowModal(false);
      setForm({ memberId: "", guestName: "", price: "0" });
      loadPasses();
      setToast({ message: "Pase creado", type: "success" });
    } else {
      const data = await res.json();
      setToast({ message: data.error || "Error al crear", type: "error" });
    }
  }

  async function handleQuickCheckIn(pass: DayPass) {
    if (!pass.member) return;
    const res = await fetch("/api/checkins", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        memberId: pass.member.id,
        type: "ENTRY",
        method: "DAY_PASS",
        dayPassId: pass.id,
      }),
    });
    if (res.ok) {
      loadPasses();
      setToast({ message: "Entrada registrada", type: "success" });
    } else {
      const data = await res.json();
      setToast({ message: data.error || "Error", type: "error" });
    }
  }

  const displayName = (p: DayPass) => p.member?.customer?.name || p.guestName || "-";

  return (
    <div className="space-y-6">
      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Ticket className="w-7 h-7 text-indigo-600" />
          <h1 className="text-2xl font-bold text-gray-900">Tiqueteras (Pases de Día)</h1>
        </div>
        <button
          onClick={() => {
            setForm({ memberId: "", guestName: "", price: "0" });
            setShowModal(true);
          }}
          className="btn-primary flex items-center gap-2"
        >
          <Plus className="w-4 h-4" />
          Nuevo Pase
        </button>
      </div>

      <div className="grid grid-cols-3 gap-4">
        <div className="card">
          <p className="text-sm text-gray-500">Total hoy</p>
          <p className="text-2xl font-bold text-gray-900">{stats.total}</p>
        </div>
        <div className="card">
          <p className="text-sm text-gray-500">Activos</p>
          <p className="text-2xl font-bold text-emerald-600">{stats.active}</p>
        </div>
        <div className="card">
          <p className="text-sm text-gray-500">Usados</p>
          <p className="text-2xl font-bold text-blue-600">{stats.used}</p>
        </div>
      </div>

      <div className="card overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr>
              <th className="table-header">Fecha</th>
              <th className="table-header">Miembro / Invitado</th>
              <th className="table-header text-right">Precio</th>
              <th className="table-header">Estado</th>
              <th className="table-header">Acciones</th>
            </tr>
          </thead>
          <tbody>
            {dayPasses.map((p) => (
              <tr key={p.id} className="hover:bg-gray-50">
                <td className="table-cell">{formatDate(p.date)}</td>
                <td className="table-cell font-medium">{displayName(p)}</td>
                <td className="table-cell text-right">{formatCurrency(p.price)}</td>
                <td className="table-cell">
                  <span className={`inline-flex px-2.5 py-0.5 rounded-full text-xs font-medium ${statusBadgeClass(p.status)}`}>
                    {p.status}
                  </span>
                </td>
                <td className="table-cell">
                  {p.status === "ACTIVE" && p.member && (
                    <button
                      onClick={() => handleQuickCheckIn(p)}
                      className="btn-success flex items-center gap-1 text-sm py-1.5 px-3"
                    >
                      <LogIn className="w-4 h-4" />
                      Check-in
                    </button>
                  )}
                </td>
              </tr>
            ))}
            {dayPasses.length === 0 && (
              <tr>
                <td colSpan={5} className="table-cell text-center text-gray-400 py-12">
                  Sin pases de día hoy
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <Modal open={showModal} onClose={() => setShowModal(false)} title="Nuevo Pase de Día" size="md">
        <form onSubmit={handleCreate} className="space-y-4">
          <div>
            <label htmlFor="member-select" className="block text-sm font-medium text-gray-700 mb-1">Miembro (opcional)</label>
            <select
              id="member-select"
              className="input-field"
              value={form.memberId}
              onChange={(e) => setForm({ ...form, memberId: e.target.value })}
            >
              <option value="">-- Sin miembro (invitado) --</option>
              {members.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.customer.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="guest-name" className="block text-sm font-medium text-gray-700 mb-1">Nombre invitado (si no hay miembro)</label>
            <input
              id="guest-name"
              className="input-field"
              placeholder="Nombre del invitado"
              value={form.guestName}
              onChange={(e) => setForm({ ...form, guestName: e.target.value })}
            />
          </div>
          <div>
            <label htmlFor="price-input" className="block text-sm font-medium text-gray-700 mb-1">Precio *</label>
            <input
              id="price-input"
              type="number"
              step="0.01"
              min="0"
              className="input-field"
              value={form.price}
              onChange={(e) => setForm({ ...form, price: e.target.value })}
              required
            />
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <button type="button" onClick={() => setShowModal(false)} className="btn-secondary">
              Cancelar
            </button>
            <button type="submit" className="btn-primary">
              Crear Pase
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
