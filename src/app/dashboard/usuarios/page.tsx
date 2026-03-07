"use client";

import { useEffect, useState, useCallback } from "react";
import { Users, Plus, Pencil, Shield } from "lucide-react";
import Modal from "@/components/ui/Modal";
import Toast from "@/components/ui/Toast";

interface User { id: number; name: string; email: string; role: string; isActive: boolean; createdAt: string; }

const emptyForm = { name: "", email: "", password: "", role: "CASHIER" };

export default function UsuariosPage() {
  const [users, setUsers] = useState<User[]>([]);
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<User | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [toast, setToast] = useState<{ message: string; type: "success" | "error" } | null>(null);

  const load = useCallback(async () => {
    const res = await fetch("/api/users");
    if (res.ok) setUsers(await res.json());
  }, []);

  useEffect(() => { load(); }, [load]);

  function openEdit(u: User) {
    setEditing(u);
    setForm({ name: u.name, email: u.email, password: "", role: u.role });
    setShowModal(true);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const url = editing ? `/api/users/${editing.id}` : "/api/users";
    const body = editing ? { ...form, isActive: editing.isActive } : form;
    if (editing && !form.password) {
      const { ...rest } = body;
      delete (rest as Record<string, unknown>).password;
      Object.assign(body, rest);
    }
    const res = await fetch(url, { method: editing ? "PUT" : "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    if (res.ok) { setShowModal(false); load(); setToast({ message: editing ? "Usuario actualizado" : "Usuario creado", type: "success" }); }
    else { const data = await res.json(); setToast({ message: data.error || "Error", type: "error" }); }
  }

  async function toggleActive(user: User) {
    await fetch(`/api/users/${user.id}`, {
      method: "PUT", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...user, isActive: !user.isActive }),
    });
    load();
  }

  const roleLabels: Record<string, string> = { ADMIN: "Administrador", CASHIER: "Cajero", WAITER: "Mesero", ACCOUNTANT: "Contador" };
  const roleColors: Record<string, string> = { ADMIN: "bg-purple-100 text-purple-700", CASHIER: "bg-blue-100 text-blue-700", WAITER: "bg-amber-100 text-amber-700", ACCOUNTANT: "bg-emerald-100 text-emerald-700" };

  return (
    <div className="space-y-6">
      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3"><Shield className="w-7 h-7 text-indigo-600" /><h1 className="text-2xl font-bold text-gray-900">Usuarios</h1></div>
        <button onClick={() => { setEditing(null); setForm(emptyForm); setShowModal(true); }} className="btn-primary flex items-center gap-2"><Plus className="w-4 h-4" /> Nuevo Usuario</button>
      </div>

      <div className="card overflow-x-auto">
        <table className="w-full">
          <thead><tr><th className="table-header">Nombre</th><th className="table-header">Email</th><th className="table-header">Rol</th><th className="table-header">Estado</th><th className="table-header">Creado</th><th className="table-header">Acciones</th></tr></thead>
          <tbody>
            {users.map(u => (
              <tr key={u.id} className="hover:bg-gray-50">
                <td className="table-cell font-medium">{u.name}</td><td className="table-cell">{u.email}</td>
                <td className="table-cell"><span className={`px-2 py-1 rounded-full text-xs font-medium ${roleColors[u.role]}`}>{roleLabels[u.role]}</span></td>
                <td className="table-cell">
                  <button onClick={() => toggleActive(u)} className={`px-2 py-1 rounded-full text-xs font-medium ${u.isActive ? "bg-emerald-100 text-emerald-700" : "bg-gray-100 text-gray-500"}`}>
                    {u.isActive ? "Activo" : "Inactivo"}
                  </button>
                </td>
                <td className="table-cell">{new Date(u.createdAt).toLocaleDateString("es-GT")}</td>
                <td className="table-cell"><button onClick={() => openEdit(u)} className="p-1.5 hover:bg-indigo-50 rounded-lg"><Pencil className="w-4 h-4 text-indigo-600" /></button></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <Modal open={showModal} onClose={() => setShowModal(false)} title={editing ? "Editar Usuario" : "Nuevo Usuario"}>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div><label className="block text-sm font-medium text-gray-700 mb-1">Nombre *</label><input className="input-field" value={form.name} onChange={e => setForm({...form, name: e.target.value})} required /></div>
          <div><label className="block text-sm font-medium text-gray-700 mb-1">Email *</label><input type="email" className="input-field" value={form.email} onChange={e => setForm({...form, email: e.target.value})} required /></div>
          <div><label className="block text-sm font-medium text-gray-700 mb-1">{editing ? "Nueva Contraseña (dejar vacío para no cambiar)" : "Contraseña *"}</label><input type="password" className="input-field" value={form.password} onChange={e => setForm({...form, password: e.target.value})} required={!editing} /></div>
          <div><label className="block text-sm font-medium text-gray-700 mb-1">Rol *</label>
            <select className="input-field" value={form.role} onChange={e => setForm({...form, role: e.target.value})}>
              <option value="ADMIN">Administrador</option><option value="CASHIER">Cajero</option><option value="WAITER">Mesero</option><option value="ACCOUNTANT">Contador</option>
            </select></div>
          <div className="flex justify-end gap-3 pt-2"><button type="button" onClick={() => setShowModal(false)} className="btn-secondary">Cancelar</button><button type="submit" className="btn-primary">{editing ? "Actualizar" : "Crear"}</button></div>
        </form>
      </Modal>
    </div>
  );
}
