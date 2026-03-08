"use client";

import { useEffect, useState, useCallback } from "react";
import { Truck, Plus, Search, Pencil, Trash2 } from "lucide-react";
import Modal from "@/components/ui/Modal";
import Toast from "@/components/ui/Toast";

interface Supplier { id: number; name: string; nit: string | null; contactName: string | null; phone: string | null; email: string | null; address: string | null; }

const emptyForm = { name: "", nit: "", contactName: "", phone: "", email: "", address: "" };

export default function ProveedoresPage() {
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [search, setSearch] = useState("");
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<Supplier | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [toast, setToast] = useState<{ message: string; type: "success" | "error" } | null>(null);

  const load = useCallback(async () => {
    const params = search ? `?search=${encodeURIComponent(search)}` : "";
    const res = await fetch(`/api/suppliers${params}`);
    setSuppliers(res.ok ? await res.json() : []);
  }, [search]);

  useEffect(() => { load(); }, [load]);

  function openEdit(s: Supplier) {
    setEditing(s);
    setForm({ name: s.name, nit: s.nit || "", contactName: s.contactName || "", phone: s.phone || "", email: s.email || "", address: s.address || "" });
    setShowModal(true);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const url = editing ? `/api/suppliers/${editing.id}` : "/api/suppliers";
    const res = await fetch(url, { method: editing ? "PUT" : "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(form) });
    if (res.ok) { setShowModal(false); load(); setToast({ message: editing ? "Actualizado" : "Creado", type: "success" }); }
  }

  async function handleDelete(id: number) {
    if (!confirm("¿Desactivar proveedor?")) return;
    await fetch(`/api/suppliers/${id}`, { method: "DELETE" });
    load(); setToast({ message: "Proveedor desactivado", type: "success" });
  }

  return (
    <div className="space-y-6">
      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3"><Truck className="w-7 h-7 text-indigo-600 dark:text-indigo-400" /><h1 className="text-2xl font-bold text-gray-900 dark:text-white">Proveedores</h1></div>
        <button onClick={() => { setEditing(null); setForm(emptyForm); setShowModal(true); }} className="btn-primary flex items-center gap-2"><Plus className="w-4 h-4" /> Nuevo Proveedor</button>
      </div>

      <div className="card">
        <div className="relative mb-4"><Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 dark:text-gray-500" /><input className="input-field pl-9" placeholder="Buscar..." value={search} onChange={e => setSearch(e.target.value)} /></div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead><tr><th className="table-header">Nombre</th><th className="table-header">NIT</th><th className="table-header">Contacto</th><th className="table-header">Teléfono</th><th className="table-header">Email</th><th className="table-header">Acciones</th></tr></thead>
            <tbody>
              {suppliers.map(s => (
                <tr key={s.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/50">
                  <td className="table-cell font-medium">{s.name}</td><td className="table-cell">{s.nit || "-"}</td><td className="table-cell">{s.contactName || "-"}</td>
                  <td className="table-cell">{s.phone || "-"}</td><td className="table-cell">{s.email || "-"}</td>
                  <td className="table-cell"><div className="flex gap-1"><button onClick={() => openEdit(s)} className="p-1.5 hover:bg-indigo-50 rounded-lg"><Pencil className="w-4 h-4 text-indigo-600" /></button><button onClick={() => handleDelete(s.id)} className="p-1.5 hover:bg-red-50 rounded-lg"><Trash2 className="w-4 h-4 text-red-500" /></button></div></td>
                </tr>
              ))}
              {suppliers.length === 0 && <tr><td colSpan={6} className="table-cell text-center text-gray-400 dark:text-gray-500 py-12">Sin proveedores</td></tr>}
            </tbody>
          </table>
        </div>
      </div>

      <Modal open={showModal} onClose={() => setShowModal(false)} title={editing ? "Editar Proveedor" : "Nuevo Proveedor"}>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div><label className="block text-sm font-medium text-gray-700 mb-1">Nombre *</label><input className="input-field" value={form.name} onChange={e => setForm({...form, name: e.target.value})} required /></div>
            <div><label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">NIT</label><input className="input-field" value={form.nit} onChange={e => setForm({...form, nit: e.target.value})} /></div>
            <div><label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Contacto</label><input className="input-field" value={form.contactName} onChange={e => setForm({...form, contactName: e.target.value})} /></div>
            <div><label className="block text-sm font-medium text-gray-700 mb-1">Teléfono</label><input className="input-field" value={form.phone} onChange={e => setForm({...form, phone: e.target.value})} /></div>
            <div><label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Email</label><input type="email" className="input-field" value={form.email} onChange={e => setForm({...form, email: e.target.value})} /></div>
          </div>
          <div><label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Dirección</label><input className="input-field" value={form.address} onChange={e => setForm({...form, address: e.target.value})} /></div>
          <div className="flex justify-end gap-3 pt-2"><button type="button" onClick={() => setShowModal(false)} className="btn-secondary">Cancelar</button><button type="submit" className="btn-primary">{editing ? "Actualizar" : "Crear"}</button></div>
        </form>
      </Modal>
    </div>
  );
}
