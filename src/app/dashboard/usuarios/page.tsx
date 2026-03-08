"use client";

import { useEffect, useState, useCallback } from "react";
import { Plus, Pencil, Shield, Building2, X } from "lucide-react";
import Modal from "@/components/ui/Modal";
import Toast from "@/components/ui/Toast";
import { formatDate } from "@/lib/utils";

interface CompanyAssignment {
  id: number;
  name: string;
  role: string;
}

interface UserItem {
  id: number;
  name: string;
  email: string;
  role: string;
  isActive: boolean;
  createdAt: string;
  companies?: CompanyAssignment[];
}

interface CompanyOption {
  id: number;
  name: string;
}

interface FormAssignment {
  companyId: number;
  companyName: string;
  role: string;
}

const emptyForm = { name: "", email: "", password: "", role: "CASHIER" };

export default function UsuariosPage() {
  const [users, setUsers] = useState<UserItem[]>([]);
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<UserItem | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [toast, setToast] = useState<{ message: string; type: "success" | "error" } | null>(null);
  const [isSuperAdmin, setIsSuperAdmin] = useState(false);
  const [allCompanies, setAllCompanies] = useState<CompanyOption[]>([]);
  const [formAssignments, setFormAssignments] = useState<FormAssignment[]>([]);
  const [selectedCompanyToAdd, setSelectedCompanyToAdd] = useState("");
  const [selectedRoleToAdd, setSelectedRoleToAdd] = useState("CASHIER");

  const load = useCallback(async () => {
    const meRes = await fetch("/api/auth/me");
    if (meRes.ok) {
      const me = await meRes.json();
      setIsSuperAdmin(me.role === "SUPER_ADMIN");
      if (me.role === "SUPER_ADMIN") {
        const compRes = await fetch("/api/companies");
        if (compRes.ok) setAllCompanies(await compRes.json());
      }
    }
    const res = await fetch("/api/users");
    if (res.ok) setUsers(await res.json());
  }, []);

  useEffect(() => { load(); }, [load]);

  function openCreate() {
    setEditing(null);
    setForm(emptyForm);
    setFormAssignments([]);
    setShowModal(true);
  }

  function openEdit(u: UserItem) {
    setEditing(u);
    setForm({ name: u.name, email: u.email, password: "", role: u.role });
    setFormAssignments(
      (u.companies || []).map((c) => ({
        companyId: c.id,
        companyName: c.name,
        role: c.role,
      }))
    );
    setShowModal(true);
  }

  function addCompanyAssignment() {
    const companyId = Number(selectedCompanyToAdd);
    if (!companyId) return;
    if (formAssignments.some((a) => a.companyId === companyId)) return;
    const company = allCompanies.find((c) => c.id === companyId);
    if (!company) return;
    setFormAssignments([
      ...formAssignments,
      { companyId, companyName: company.name, role: selectedRoleToAdd },
    ]);
    setSelectedCompanyToAdd("");
    setSelectedRoleToAdd("CASHIER");
  }

  function removeAssignment(companyId: number) {
    setFormAssignments(formAssignments.filter((a) => a.companyId !== companyId));
  }

  function updateAssignmentRole(companyId: number, role: string) {
    setFormAssignments(
      formAssignments.map((a) =>
        a.companyId === companyId ? { ...a, role } : a
      )
    );
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    const url = editing ? `/api/users/${editing.id}` : "/api/users";
    const body: Record<string, unknown> = {
      name: form.name,
      email: form.email,
      role: form.role,
    };

    if (form.password) body.password = form.password;
    if (!editing) body.password = form.password;
    if (editing) body.isActive = editing.isActive;

    if (isSuperAdmin) {
      body.companyAssignments = formAssignments.map((a) => ({
        companyId: a.companyId,
        role: a.role,
      }));
    }

    const res = await fetch(url, {
      method: editing ? "PUT" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    if (res.ok) {
      setShowModal(false);
      load();
      setToast({ message: editing ? "Usuario actualizado" : "Usuario creado", type: "success" });
    } else {
      const data = await res.json();
      setToast({ message: data.error || "Error", type: "error" });
    }
  }

  async function toggleActive(user: UserItem) {
    await fetch(`/api/users/${user.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: user.name, email: user.email, role: user.role, isActive: !user.isActive }),
    });
    load();
  }

  const roleLabels: Record<string, string> = {
    SUPER_ADMIN: "Super Admin",
    ADMIN: "Administrador",
    CASHIER: "Cajero",
    WAITER: "Mesero",
    ACCOUNTANT: "Contador",
    TRAINER: "Entrenador",
  };
  const roleColors: Record<string, string> = {
    SUPER_ADMIN: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",
    ADMIN: "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400",
    CASHIER: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
    WAITER: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400",
    ACCOUNTANT: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400",
    TRAINER: "bg-teal-100 text-teal-700 dark:bg-teal-900/30 dark:text-teal-400",
  };

  const availableCompanies = allCompanies.filter(
    (c) => !formAssignments.some((a) => a.companyId === c.id)
  );

  return (
    <div className="space-y-6">
      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Shield className="w-7 h-7 text-indigo-600 dark:text-indigo-400" />
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Usuarios</h1>
        </div>
        <button onClick={openCreate} className="btn-primary flex items-center gap-2">
          <Plus className="w-4 h-4" /> Nuevo Usuario
        </button>
      </div>

      <div className="card overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr>
              <th className="table-header">Nombre</th>
              <th className="table-header">Email</th>
              <th className="table-header">Rol</th>
              {isSuperAdmin && <th className="table-header">Empresas</th>}
              <th className="table-header">Estado</th>
              <th className="table-header">Creado</th>
              <th className="table-header">Acciones</th>
            </tr>
          </thead>
          <tbody>
            {users.map((u) => (
              <tr key={u.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/50">
                <td className="table-cell font-medium">{u.name}</td>
                <td className="table-cell">{u.email}</td>
                <td className="table-cell">
                  <span className={`px-2 py-1 rounded-full text-xs font-medium ${roleColors[u.role] || "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300"}`}>
                    {roleLabels[u.role] || u.role}
                  </span>
                </td>
                {isSuperAdmin && (
                  <td className="table-cell">
                    <div className="flex flex-wrap gap-1">
                      {(u.companies || []).map((c) => (
                        <span key={c.id} className="inline-flex items-center gap-1 px-2 py-0.5 bg-gray-100 text-gray-700 text-xs rounded-full">
                          <Building2 className="w-3 h-3" />
                          {c.name}
                        </span>
                      ))}
                      {(!u.companies || u.companies.length === 0) && (
                        <span className="text-xs text-gray-400 dark:text-gray-500">Sin empresa</span>
                      )}
                    </div>
                  </td>
                )}
                <td className="table-cell">
                  <button
                    onClick={() => toggleActive(u)}
                    className={`px-2 py-1 rounded-full text-xs font-medium ${
                      u.isActive ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400" : "bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400"
                    }`}
                  >
                    {u.isActive ? "Activo" : "Inactivo"}
                  </button>
                </td>
                <td className="table-cell">{formatDate(u.createdAt)}</td>
                <td className="table-cell">
                  <button onClick={() => openEdit(u)} className="p-1.5 hover:bg-indigo-50 dark:hover:bg-indigo-900/30 rounded-lg">
                    <Pencil className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <Modal open={showModal} onClose={() => setShowModal(false)} title={editing ? "Editar Usuario" : "Nuevo Usuario"} size={isSuperAdmin ? "lg" : "md"}>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className={isSuperAdmin ? "grid grid-cols-2 gap-4" : ""}>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Nombre *</label>
                <input className="input-field" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Email *</label>
                <input type="email" className="input-field" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} required />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  {editing ? "Nueva Contraseña (dejar vacío para no cambiar)" : "Contraseña *"}
                </label>
                <input type="password" className="input-field" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} required={!editing} />
              </div>
              {!isSuperAdmin && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Rol *</label>
                  <select className="input-field" value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })}>
                    <option value="ADMIN">Administrador</option>
                    <option value="CASHIER">Cajero</option>
                    <option value="WAITER">Mesero</option>
                    <option value="ACCOUNTANT">Contador</option>
                    <option value="TRAINER">Entrenador</option>
                  </select>
                </div>
              )}
            </div>

            {isSuperAdmin && (
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Rol global</label>
                  <select className="input-field" value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })}>
                    <option value="ADMIN">Administrador</option>
                    <option value="CASHIER">Cajero</option>
                    <option value="WAITER">Mesero</option>
                    <option value="ACCOUNTANT">Contador</option>
                    <option value="TRAINER">Entrenador</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Empresas asignadas</label>
                  <div className="space-y-2 max-h-40 overflow-y-auto">
                    {formAssignments.map((a) => (
                      <div key={a.companyId} className="flex items-center gap-2 bg-gray-50 dark:bg-gray-800/50 rounded-lg px-3 py-2">
                        <Building2 className="w-4 h-4 text-gray-400 dark:text-gray-500 flex-shrink-0" />
                        <span className="text-sm text-gray-700 dark:text-gray-300 flex-1 truncate">{a.companyName}</span>
                        <select
                          className="text-xs border border-gray-300 rounded px-1.5 py-1"
                          value={a.role}
                          onChange={(e) => updateAssignmentRole(a.companyId, e.target.value)}
                        >
                          <option value="ADMIN">Admin</option>
                          <option value="CASHIER">Cajero</option>
                          <option value="WAITER">Mesero</option>
                          <option value="ACCOUNTANT">Contador</option>
                          <option value="TRAINER">Entrenador</option>
                        </select>
                        <button type="button" onClick={() => removeAssignment(a.companyId)} className="text-red-400 hover:text-red-600">
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                    ))}
                    {formAssignments.length === 0 && (
                      <p className="text-xs text-gray-400 dark:text-gray-500 text-center py-2">Sin empresas asignadas</p>
                    )}
                  </div>
                </div>

                {availableCompanies.length > 0 && (
                  <div className="flex gap-2">
                    <select
                      className="input-field flex-1 text-sm"
                      value={selectedCompanyToAdd}
                      onChange={(e) => setSelectedCompanyToAdd(e.target.value)}
                    >
                      <option value="">Seleccionar empresa...</option>
                      {availableCompanies.map((c) => (
                        <option key={c.id} value={c.id}>{c.name}</option>
                      ))}
                    </select>
                    <select
                      className="input-field w-28 text-sm"
                      value={selectedRoleToAdd}
                      onChange={(e) => setSelectedRoleToAdd(e.target.value)}
                    >
                      <option value="ADMIN">Admin</option>
                      <option value="CASHIER">Cajero</option>
                      <option value="WAITER">Mesero</option>
                      <option value="ACCOUNTANT">Contador</option>
                      <option value="TRAINER">Entrenador</option>
                    </select>
                    <button
                      type="button"
                      onClick={addCompanyAssignment}
                      className="btn-secondary text-sm px-3"
                    >
                      <Plus className="w-4 h-4" />
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>

          <div className="flex justify-end gap-3 pt-2">
            <button type="button" onClick={() => setShowModal(false)} className="btn-secondary">Cancelar</button>
            <button type="submit" className="btn-primary">{editing ? "Actualizar" : "Crear"}</button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
