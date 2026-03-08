"use client";

import { useEffect, useState, useCallback } from "react";
import { Users, Plus, Search, Pencil, Trash2 } from "lucide-react";
import Modal from "@/components/ui/Modal";
import Toast from "@/components/ui/Toast";
import { formatCurrency } from "@/lib/utils";

interface Customer { id: string; name: string; nit: string | null; phone: string | null; email: string | null; address: string | null; creditLimit: string; balance: string; }

const emptyForm = { name: "", nit: "", phone: "", email: "", address: "", creditLimit: "0" };

export default function ClientesPage() {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [search, setSearch] = useState("");
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<Customer | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [toast, setToast] = useState<{ message: string; type: "success" | "error" } | null>(null);

  const load = useCallback(async () => {
    const params = search ? `?search=${encodeURIComponent(search)}` : "";
    const res = await fetch(`/api/customers${params}`);
    setCustomers(res.ok ? await res.json() : []);
  }, [search]);

  useEffect(() => { load(); }, [load]);

  function openEdit(c: Customer) {
    setEditing(c);
    setForm({ name: c.name, nit: c.nit || "", phone: c.phone || "", email: c.email || "", address: c.address || "", creditLimit: c.creditLimit });
    setShowModal(true);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const url = editing ? `/api/customers/${editing.id}` : "/api/customers";
    const res = await fetch(url, { method: editing ? "PUT" : "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(form) });
    if (res.ok) { setShowModal(false); load(); setToast({ message: editing ? "Actualizado" : "Creado", type: "success" }); }
  }

  async function handleDelete(id: string) {
    if (!confirm("¿Desactivar este cliente?")) return;
    await fetch(`/api/customers/${id}`, { method: "DELETE" });
    load(); setToast({ message: "Cliente desactivado", type: "success" });
  }

  return (
    <div className="space-y-6">
      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
      <div className="flex items-center justify-between">
        <div className="page-header">
          <div className="page-icon"><Users className="w-full h-full" /></div>
          <h1 className="page-title">Clientes</h1>
        </div>
        <button onClick={() => { setEditing(null); setForm(emptyForm); setShowModal(true); }} className="btn-primary flex items-center gap-2"><Plus className="w-4 h-4" /> Nuevo Cliente</button>
      </div>

      <div className="card">
        <div className="relative mb-4"><Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 dark:text-slate-500" /><input className="input-field pl-9" placeholder="Buscar..." value={search} onChange={e => setSearch(e.target.value)} /></div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead><tr><th className="table-header">Nombre</th><th className="table-header">NIT</th><th className="table-header">Teléfono</th><th className="table-header">Email</th><th className="table-header text-right">Límite Crédito</th><th className="table-header text-right">Saldo</th><th className="table-header">Acciones</th></tr></thead>
            <tbody>
              {customers.map(c => (
                <tr key={c.id} className="hover:bg-slate-50 dark:hover:bg-white/[0.03]">
                  <td className="table-cell font-medium">{c.name}</td><td className="table-cell">{c.nit || "-"}</td><td className="table-cell">{c.phone || "-"}</td>
                  <td className="table-cell">{c.email || "-"}</td><td className="table-cell text-right">{formatCurrency(c.creditLimit)}</td>
                  <td className="table-cell text-right font-semibold">{formatCurrency(c.balance)}</td>
                  <td className="table-cell"><div className="flex gap-1"><button onClick={() => openEdit(c)} className="p-1.5 hover:bg-violet-50 dark:hover:bg-violet-500/10 rounded-xl"><Pencil className="w-4 h-4 text-violet-600 dark:text-violet-400" /></button><button onClick={() => handleDelete(c.id)} className="p-1.5 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-xl"><Trash2 className="w-4 h-4 text-red-500" /></button></div></td>
                </tr>
              ))}
              {customers.length === 0 && <tr><td colSpan={7} className="table-cell text-center text-slate-400 dark:text-slate-500 py-12">Sin clientes</td></tr>}
            </tbody>
          </table>
        </div>
      </div>

      <Modal open={showModal} onClose={() => setShowModal(false)} title={editing ? "Editar Cliente" : "Nuevo Cliente"}>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div><label className="block text-sm font-medium text-slate-700 mb-1">Nombre *</label><input className="input-field" value={form.name} onChange={e => setForm({...form, name: e.target.value})} required /></div>
            <div><label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">NIT</label><input className="input-field" value={form.nit} onChange={e => setForm({...form, nit: e.target.value})} /></div>
            <div><label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Teléfono</label><input className="input-field" value={form.phone} onChange={e => setForm({...form, phone: e.target.value})} /></div>
            <div><label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Email</label><input type="email" className="input-field" value={form.email} onChange={e => setForm({...form, email: e.target.value})} /></div>
            <div><label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Límite de Crédito</label><input type="number" step="0.01" className="input-field" value={form.creditLimit} onChange={e => setForm({...form, creditLimit: e.target.value})} /></div>
          </div>
          <div><label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Dirección</label><input className="input-field" value={form.address} onChange={e => setForm({...form, address: e.target.value})} /></div>
          <div className="flex justify-end gap-3 pt-2"><button type="button" onClick={() => setShowModal(false)} className="btn-secondary">Cancelar</button><button type="submit" className="btn-primary">{editing ? "Actualizar" : "Crear"}</button></div>
        </form>
      </Modal>
    </div>
  );
}
