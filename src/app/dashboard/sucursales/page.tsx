"use client";

import { useEffect, useState, useCallback } from "react";
import { Building2, Plus, Pencil, Trash2, Users, MapPin, Phone } from "lucide-react";
import { useAtomValue } from "jotai";
import { userRoleAtom } from "@/store";
import Modal from "@/components/ui/Modal";
import Toast from "@/components/ui/Toast";
import { PageHeader, SearchInput, EmptyState } from "@/components/molecules";
import { Button } from "@/components/atoms";

interface Branch {
  id: string;
  name: string;
  address: string | null;
  city: string | null;
  phone: string | null;
  isActive: boolean;
  createdAt: string;
  userCount?: number;
}

interface UserItem {
  id: string;
  name: string;
  email: string;
}

const emptyForm = { name: "", address: "", city: "", phone: "" };

export default function SucursalesPage() {
  const userRole = useAtomValue(userRoleAtom);
  const canCreate = userRole === "ADMIN" || userRole === "SUPER_ADMIN";
  const [branches, setBranches] = useState<Branch[]>([]);
  const [search, setSearch] = useState("");
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<Branch | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [toast, setToast] = useState<{ message: string; type: "success" | "error" } | null>(null);
  const [detailBranch, setDetailBranch] = useState<Branch | null>(null);
  const [companyUsers, setCompanyUsers] = useState<UserItem[]>([]);
  const [assignedUserIds, setAssignedUserIds] = useState<Set<string>>(new Set());

  const load = useCallback(async () => {
    const res = await fetch("/api/branches");
    setBranches(res.ok ? await res.json() : []);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    async function loadUsers() {
      const res = await fetch("/api/users");
      if (res.ok) {
        const users = await res.json();
        setCompanyUsers(users);
      }
    }
    loadUsers();
  }, []);

  useEffect(() => {
    if (detailBranch) {
      fetch(`/api/branches/${detailBranch.id}/users`)
        .then((r) => r.ok ? r.json() : [])
        .then((users: UserItem[]) => setAssignedUserIds(new Set(users.map((u) => u.id))));
    }
  }, [detailBranch]);

  function openCreate() {
    setEditing(null);
    setForm(emptyForm);
    setShowModal(true);
  }

  function openEdit(b: Branch) {
    setEditing(b);
    setForm({
      name: b.name,
      address: b.address || "",
      city: b.city || "",
      phone: b.phone || "",
    });
    setShowModal(true);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const url = editing ? `/api/branches/${editing.id}` : "/api/branches";
    const body = editing ? { ...form, isActive: editing.isActive } : form;
    const res = await fetch(url, {
      method: editing ? "PUT" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (res.ok) {
      setShowModal(false);
      load();
      setToast({ message: editing ? "Sucursal actualizada" : "Sucursal creada", type: "success" });
    } else {
      const data = await res.json();
      setToast({ message: data.error || "Error", type: "error" });
    }
  }

  async function handleDelete(b: Branch) {
    if (!confirm(`¿Desactivar sucursal "${b.name}"?`)) return;
    const res = await fetch(`/api/branches/${b.id}`, { method: "DELETE" });
    if (res.ok) {
      load();
      setDetailBranch(null);
      setToast({ message: "Sucursal desactivada", type: "success" });
    }
  }

  async function toggleUserAssignment(userId: string) {
    if (!detailBranch) return;
    const isAssigned = assignedUserIds.has(userId);
    if (isAssigned) {
      await fetch(`/api/branches/${detailBranch.id}/users`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId }),
      });
      setAssignedUserIds((prev) => {
        const next = new Set(prev);
        next.delete(userId);
        return next;
      });
    } else {
      await fetch(`/api/branches/${detailBranch.id}/users`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userIds: [userId] }),
      });
      setAssignedUserIds((prev) => new Set([...prev, userId]));
    }
    load();
  }

  const filtered = branches.filter(
    (b) =>
      !search ||
      b.name.toLowerCase().includes(search.toLowerCase()) ||
      (b.address?.toLowerCase().includes(search.toLowerCase())) ||
      (b.city?.toLowerCase().includes(search.toLowerCase()))
  );

  return (
    <div className="space-y-6">
      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
      <PageHeader
        icon={<Building2 className="w-full h-full" />}
        title="Sucursales"
        subtitle="Gestiona las sucursales de tu empresa"
        actions={
          canCreate ? (
            <Button onClick={openCreate} icon={<Plus className="w-4 h-4" />}>
              Nueva Sucursal
            </Button>
          ) : undefined
        }
      />

      <div className="card">
        <div className="mb-4">
          <SearchInput
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar sucursales..."
            className="w-full sm:w-auto sm:min-w-[300px]"
          />
        </div>
        {filtered.length === 0 ? (
          <EmptyState
            icon={<Building2 className="w-7 h-7" />}
            title="Sin sucursales"
            description="Crea tu primera sucursal para gestionar múltiples ubicaciones"
            action={canCreate ? <Button onClick={openCreate} icon={<Plus className="w-4 h-4" />}>Nueva Sucursal</Button> : undefined}
          />
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {filtered.map((b) => (
              <div
                key={b.id}
                className={`rounded-xl border-2 p-4 transition-all hover:shadow-md ${
                  detailBranch?.id === b.id
                    ? "border-violet-500 bg-violet-50/50 dark:bg-violet-500/10 dark:border-violet-500"
                    : "border-slate-200 dark:border-slate-700 bg-white dark:bg-[#141925] hover:border-slate-300 dark:hover:border-slate-600"
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <h3 className="font-semibold text-slate-900 dark:text-white truncate">{b.name}</h3>
                    {b.address && (
                      <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5 flex items-center gap-1 truncate">
                        <MapPin className="w-3.5 h-3.5 flex-shrink-0" />
                        {b.address}
                      </p>
                    )}
                    {b.city && (
                      <p className="text-xs text-slate-400 dark:text-slate-500">{b.city}</p>
                    )}
                    {b.phone && (
                      <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 flex items-center gap-1">
                        <Phone className="w-3 h-3" />
                        {b.phone}
                      </p>
                    )}
                  </div>
                  <span
                    className={`px-2 py-0.5 rounded-full text-xs font-medium flex-shrink-0 ${
                      b.isActive
                        ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400"
                        : "bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400"
                    }`}
                  >
                    {b.isActive ? "Activa" : "Inactiva"}
                  </span>
                </div>
                <div className="flex items-center justify-between mt-3 pt-3 border-t border-slate-100 dark:border-slate-800">
                  <span className="text-xs text-slate-500 dark:text-slate-400 flex items-center gap-1">
                    <Users className="w-3.5 h-3.5" />
                    {b.userCount ?? 0} usuarios
                  </span>
                  <div className="flex gap-1">
                    <button
                      onClick={() => setDetailBranch(detailBranch?.id === b.id ? null : b)}
                      className="p-1.5 hover:bg-slate-100 dark:hover:bg-white/[0.05] rounded-lg"
                      title="Asignar usuarios"
                    >
                      <Users className="w-4 h-4 text-violet-600 dark:text-violet-400" />
                    </button>
                    {canCreate && (
                      <button
                        onClick={() => openEdit(b)}
                        className="p-1.5 hover:bg-violet-50 dark:hover:bg-violet-500/10 rounded-lg"
                        title="Editar"
                      >
                        <Pencil className="w-4 h-4 text-violet-600 dark:text-violet-400" />
                      </button>
                    )}
                    {b.isActive && canCreate && (
                      <button
                        onClick={() => handleDelete(b)}
                        className="p-1.5 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg"
                        title="Desactivar"
                      >
                        <Trash2 className="w-4 h-4 text-red-500" />
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Create/Edit modal */}
      <Modal open={showModal} onClose={() => setShowModal(false)} title={editing ? "Editar Sucursal" : "Nueva Sucursal"}>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="branch-name" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Nombre *</label>
            <input
              id="branch-name"
              className="input-field"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              required
            />
          </div>
          <div>
            <label htmlFor="branch-address" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Dirección</label>
            <input
              id="branch-address"
              className="input-field"
              value={form.address}
              onChange={(e) => setForm({ ...form, address: e.target.value })}
            />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label htmlFor="branch-city" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Ciudad</label>
              <input
                id="branch-city"
                className="input-field"
                value={form.city}
                onChange={(e) => setForm({ ...form, city: e.target.value })}
              />
            </div>
            <div>
              <label htmlFor="branch-phone" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Teléfono</label>
              <input
                id="branch-phone"
                className="input-field"
                value={form.phone}
                onChange={(e) => setForm({ ...form, phone: e.target.value })}
              />
            </div>
          </div>
          {editing && (
            <div>
              <label htmlFor="branch-status" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Estado</label>
              <select
                id="branch-status"
                className="input-field"
                value={editing.isActive ? "true" : "false"}
                onChange={(e) => setEditing({ ...editing, isActive: e.target.value === "true" })}
              >
                <option value="true">Activa</option>
                <option value="false">Inactiva</option>
              </select>
            </div>
          )}
          <div className="flex flex-col sm:flex-row justify-end gap-2 pt-2">
            <Button type="button" variant="secondary" onClick={() => setShowModal(false)}>
              Cancelar
            </Button>
            <Button type="submit">{editing ? "Actualizar" : "Crear"}</Button>
          </div>
        </form>
      </Modal>

      {/* User assignment modal */}
      <Modal
        open={!!detailBranch}
        onClose={() => setDetailBranch(null)}
        title={detailBranch ? `Usuarios - ${detailBranch.name}` : ""}
        size="md"
      >
        {detailBranch && (
          <div className="space-y-4">
            <p className="text-sm text-slate-500 dark:text-slate-400">
              Marca los usuarios que pueden trabajar en esta sucursal.
            </p>
            <div className="max-h-60 overflow-y-auto space-y-2 border border-slate-200 dark:border-slate-700 rounded-xl p-3">
              {companyUsers.length === 0 ? (
                <p className="text-sm text-slate-400 py-4 text-center">No hay usuarios en la empresa</p>
              ) : (
                companyUsers.map((u) => (
                  <label
                    key={u.id}
                    htmlFor={`user-branch-${u.id}`}
                    className="flex items-center gap-3 p-2 rounded-lg hover:bg-slate-50 dark:hover:bg-white/[0.03] cursor-pointer"
                  >
                    <input
                      id={`user-branch-${u.id}`}
                      type="checkbox"
                      checked={assignedUserIds.has(u.id)}
                      onChange={() => toggleUserAssignment(u.id)}
                      className="rounded border-slate-300 dark:border-slate-600 text-violet-600 focus:ring-violet-500"
                      aria-label={`Asignar ${u.name} a esta sucursal`}
                    />
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-slate-900 dark:text-white">{u.name}</p>
                      <p className="text-xs text-slate-500 dark:text-slate-400 truncate">{u.email}</p>
                    </div>
                  </label>
                ))
              )}
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
