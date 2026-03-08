"use client";

import { useEffect, useState, useCallback } from "react";
import { Truck, Plus, Pencil, Trash2 } from "lucide-react";
import Modal from "@/components/ui/Modal";
import Toast from "@/components/ui/Toast";
import { PageHeader, SearchInput, EmptyState } from "@/components/molecules";

interface Supplier { id: string; name: string; nit: string | null; contactName: string | null; phone: string | null; email: string | null; address: string | null; }

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

  async function handleDelete(id: string) {
    if (!confirm("¿Desactivar proveedor?")) return;
    await fetch(`/api/suppliers/${id}`, { method: "DELETE" });
    load(); setToast({ message: "Proveedor desactivado", type: "success" });
  }

  return (
    <div className="space-y-6">
      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
      <PageHeader icon={<Truck className="w-full h-full" />} title="Proveedores" actions={<button onClick={() => { setEditing(null); setForm(emptyForm); setShowModal(true); }} className="btn-primary flex items-center gap-2"><Plus className="w-4 h-4" /> Nuevo Proveedor</button>} />

      <div className="card">
        <div className="mb-4">
          <SearchInput value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar..." className="w-full sm:w-auto sm:min-w-[300px]" />
        </div>
        {suppliers.length === 0 ? (
          <EmptyState icon={<Truck className="w-7 h-7" />} title="Sin proveedores" />
        ) : (
        <div className="overflow-x-auto -mx-4 px-4 sm:-mx-6 sm:px-6">
          <table className="w-full min-w-[600px]">
            <thead><tr><th className="table-header rounded-l-lg">Nombre</th><th className="table-header hidden sm:table-cell">NIT</th><th className="table-header hidden md:table-cell">Contacto</th><th className="table-header hidden sm:table-cell">Teléfono</th><th className="table-header hidden md:table-cell">Email</th><th className="table-header rounded-r-lg">Acciones</th></tr></thead>
            <tbody>
              {suppliers.map(s => (
                <tr key={s.id} className="hover:bg-slate-50 dark:hover:bg-white/[0.03]">
                  <td className="table-cell font-medium truncate max-w-[160px]">{s.name}</td><td className="table-cell hidden sm:table-cell">{s.nit || "-"}</td><td className="table-cell hidden md:table-cell">{s.contactName || "-"}</td>
                  <td className="table-cell hidden sm:table-cell">{s.phone || "-"}</td><td className="table-cell hidden md:table-cell truncate max-w-[140px]">{s.email || "-"}</td>
                  <td className="table-cell"><div className="flex gap-1 flex-wrap"><button onClick={() => openEdit(s)} className="p-1.5 hover:bg-violet-50 dark:hover:bg-violet-500/10 rounded-xl" title="Editar"><Pencil className="w-4 h-4 text-violet-600 dark:text-violet-400" /></button><button onClick={() => handleDelete(s.id)} className="p-1.5 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-xl" title="Desactivar"><Trash2 className="w-4 h-4 text-red-500" /></button></div></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        )}
      </div>

      <Modal open={showModal} onClose={() => setShowModal(false)} title={editing ? "Editar Proveedor" : "Nuevo Proveedor"}>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div><label className="block text-sm font-medium text-slate-700 mb-1">Nombre *</label><input className="input-field" value={form.name} onChange={e => setForm({...form, name: e.target.value})} required /></div>
            <div><label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">NIT</label><input className="input-field" value={form.nit} onChange={e => setForm({...form, nit: e.target.value})} /></div>
            <div><label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Contacto</label><input className="input-field" value={form.contactName} onChange={e => setForm({...form, contactName: e.target.value})} /></div>
            <div><label className="block text-sm font-medium text-slate-700 mb-1">Teléfono</label><input className="input-field" value={form.phone} onChange={e => setForm({...form, phone: e.target.value})} /></div>
            <div><label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Email</label><input type="email" className="input-field" value={form.email} onChange={e => setForm({...form, email: e.target.value})} /></div>
          </div>
          <div><label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Dirección</label><input className="input-field" value={form.address} onChange={e => setForm({...form, address: e.target.value})} /></div>
          <div className="flex flex-col sm:flex-row justify-end gap-2 pt-2"><button type="button" onClick={() => setShowModal(false)} className="btn-secondary">Cancelar</button><button type="submit" className="btn-primary">{editing ? "Actualizar" : "Crear"}</button></div>
        </form>
      </Modal>
    </div>
  );
}
