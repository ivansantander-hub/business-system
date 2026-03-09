"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import {
  UserCheck,
  Plus,
  Pencil,
  Trash2,
  Loader2,
  Search,
  User,
  Briefcase,
  CreditCard,
  Shield,
  Link2,
} from "lucide-react";
import Modal from "@/components/ui/Modal";
import Toast from "@/components/ui/Toast";
import Button from "@/components/atoms/Button";
import { formatCurrency } from "@/lib/utils";
import { PageHeader, SearchInput, EmptyState } from "@/components/molecules";

const CONTRACT_TYPES = [
  { value: "INDEFINITE", label: "Indefinido" },
  { value: "FIXED", label: "Fijo" },
  { value: "OBRA_LABOR", label: "Obra o labor" },
  { value: "APPRENTICE", label: "Aprendizaje" },
  { value: "TEMPORARY", label: "Temporal" },
] as const;

const SALARY_TYPES = [
  { value: "ORDINARY", label: "Ordinario" },
  { value: "INTEGRAL", label: "Integral" },
] as const;

const DOC_TYPES = ["CC", "CE", "TI", "PA", "NIT"] as const;
const GENDERS = ["M", "F", "Otro"] as const;
const PAYMENT_METHODS = ["TRANSFER", "CASH", "CARD"] as const;

interface Employee {
  id: string;
  firstName: string;
  lastName: string;
  docType: string | null;
  docNumber: string;
  position: string | null;
  baseSalary: string;
  isActive: boolean;
  branch: { id: string; name: string } | null;
  user: { id: string; name: string; email: string } | null;
}

interface UserItem {
  id: string;
  name: string;
  email: string;
}

interface BranchItem {
  id: string;
  name: string;
}

const emptyForm = {
  firstName: "",
  lastName: "",
  docType: "CC",
  docNumber: "",
  birthDate: "",
  address: "",
  email: "",
  phone: "",
  gender: "",
  contractType: "INDEFINITE",
  startDate: "",
  endDate: "",
  position: "",
  costCenter: "",
  baseSalary: "",
  salaryType: "ORDINARY",
  workSchedule: "Lunes a Viernes",
  bank: "",
  accountType: "",
  accountNumber: "",
  paymentMethod: "TRANSFER",
  eps: "",
  pensionFund: "",
  arl: "",
  arlRiskLevel: "1",
  compensationFund: "",
  branchId: "",
  userId: "",
};

type FormData = typeof emptyForm;

const TABS = [
  { id: "personal", label: "Personal", icon: User },
  { id: "labor", label: "Laboral", icon: Briefcase },
  { id: "payment", label: "Pago", icon: CreditCard },
  { id: "social", label: "Seguridad Social", icon: Shield },
  { id: "user", label: "Usuario", icon: Link2 },
] as const;

export default function EmpleadosPage() {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [branches, setBranches] = useState<BranchItem[]>([]);
  const [users, setUsers] = useState<UserItem[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<Employee | null>(null);
  const [form, setForm] = useState<FormData>(emptyForm);
  const [activeTab, setActiveTab] = useState<(typeof TABS)[number]["id"]>("personal");
  const [submitting, setSubmitting] = useState(false);
  const [userSearch, setUserSearch] = useState("");
  const [toast, setToast] = useState<{ message: string; type: "success" | "error" } | null>(null);
  const [showInactive, setShowInactive] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (showInactive) params.set("active", "false");
      const res = await fetch(`/api/employees?${params}`);
      setEmployees(res.ok ? await res.json() : []);
    } finally {
      setLoading(false);
    }
  }, [showInactive]);

  const loadBranches = useCallback(async () => {
    const res = await fetch("/api/branches");
    setBranches(res.ok ? await res.json() : []);
  }, []);

  const loadUsersForSearch = useCallback(async () => {
    const res = await fetch("/api/users");
    if (res.ok) {
      const data = await res.json();
      setUsers(Array.isArray(data) ? data : []);
    }
  }, []);

  const userSearchFiltered = useMemo(() => {
    if (!userSearch.trim()) return users.slice(0, 10);
    const q = userSearch.toLowerCase().trim();
    return users
      .filter((u) => u.name.toLowerCase().includes(q) || u.email.toLowerCase().includes(q))
      .slice(0, 10);
  }, [users, userSearch]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    loadBranches();
  }, [loadBranches]);

  useEffect(() => {
    if (showModal && activeTab === "user") loadUsersForSearch();
  }, [showModal, activeTab, loadUsersForSearch]);

  const filtered = useMemo(() => {
    if (!search.trim()) return employees;
    const q = search.toLowerCase().trim();
    return employees.filter(
      (e) =>
        `${e.firstName} ${e.lastName}`.toLowerCase().includes(q) ||
        e.docNumber?.toLowerCase().includes(q)
    );
  }, [employees, search]);

  function openCreate() {
    setEditing(null);
    setForm(emptyForm);
    setActiveTab("personal");
    setUserSearch("");
    setShowModal(true);
  }

  async function openEdit(emp: Employee) {
    setEditing(emp);
    const res = await fetch(`/api/employees/${emp.id}`);
    if (!res.ok) {
      setToast({ message: "Error al cargar empleado", type: "error" });
      return;
    }
    const data = await res.json();
    setForm({
      firstName: data.firstName ?? "",
      lastName: data.lastName ?? "",
      docType: data.docType ?? "CC",
      docNumber: data.docNumber ?? "",
      birthDate: data.birthDate ? data.birthDate.slice(0, 10) : "",
      address: data.address ?? "",
      email: data.email ?? "",
      phone: data.phone ?? "",
      gender: data.gender ?? "",
      contractType: data.contractType ?? "INDEFINITE",
      startDate: data.startDate ? data.startDate.slice(0, 10) : "",
      endDate: data.endDate ? data.endDate.slice(0, 10) : "",
      position: data.position ?? "",
      costCenter: data.costCenter ?? "",
      baseSalary: data.baseSalary?.toString() ?? "",
      salaryType: data.salaryType ?? "ORDINARY",
      workSchedule: data.workSchedule ?? "Lunes a Viernes",
      bank: data.bank ?? "",
      accountType: data.accountType ?? "",
      accountNumber: data.accountNumber ?? "",
      paymentMethod: data.paymentMethod ?? "TRANSFER",
      eps: data.eps ?? "",
      pensionFund: data.pensionFund ?? "",
      arl: data.arl ?? "",
      arlRiskLevel: String(data.arlRiskLevel ?? 1),
      compensationFund: data.compensationFund ?? "",
      branchId: data.branchId ?? "",
      userId: data.userId ?? "",
    });
    setUserSearch(data.user?.name ?? "");
    setShowModal(true);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    try {
      const payload = {
        firstName: form.firstName,
        lastName: form.lastName,
        docType: form.docType,
        docNumber: form.docNumber,
        birthDate: form.birthDate || undefined,
        address: form.address || undefined,
        email: form.email || undefined,
        phone: form.phone || undefined,
        gender: form.gender || undefined,
        contractType: form.contractType,
        startDate: form.startDate,
        endDate: form.endDate || undefined,
        position: form.position || undefined,
        costCenter: form.costCenter || undefined,
        baseSalary: form.baseSalary ? Number(form.baseSalary) : 0,
        salaryType: form.salaryType,
        workSchedule: form.workSchedule,
        bank: form.bank || undefined,
        accountType: form.accountType || undefined,
        accountNumber: form.accountNumber || undefined,
        paymentMethod: form.paymentMethod,
        eps: form.eps || undefined,
        pensionFund: form.pensionFund || undefined,
        arl: form.arl || undefined,
        arlRiskLevel: form.arlRiskLevel ? Number(form.arlRiskLevel) : 1,
        compensationFund: form.compensationFund || undefined,
        branchId: form.branchId || undefined,
        userId: form.userId || undefined,
      };

      const url = editing ? `/api/employees/${editing.id}` : "/api/employees";
      const method = editing ? "PUT" : "POST";
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (res.ok) {
        setShowModal(false);
        load();
        setToast({ message: editing ? "Empleado actualizado" : "Empleado creado", type: "success" });
      } else {
        setToast({ message: data.error || "Error al guardar", type: "error" });
      }
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDeactivate(id: string) {
    if (!confirm("¿Desactivar este empleado?")) return;
    const res = await fetch(`/api/employees/${id}`, { method: "DELETE" });
    if (res.ok) {
      load();
      setToast({ message: "Empleado desactivado", type: "success" });
    } else {
      const data = await res.json();
      setToast({ message: data.error || "Error al desactivar", type: "error" });
    }
  }

  const inputCls = "input-field w-full min-h-[44px]";
  const labelCls = "block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1";

  return (
    <div className="space-y-6">
      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}

      <PageHeader
        icon={<UserCheck className="w-full h-full" />}
        title="Empleados"
        actions={
          <Button icon={<Plus className="w-4 h-4" />} onClick={openCreate}>
            Nuevo Empleado
          </Button>
        }
      />

      <div className="card">
        <div className="flex flex-col sm:flex-row gap-3 sm:gap-4 mb-4">
          <SearchInput
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar por nombre o documento..."
            className="w-full sm:flex-1 sm:min-w-[200px]"
          />
          <label className="flex items-center gap-2 min-h-[44px] cursor-pointer">
            <input
              type="checkbox"
              checked={showInactive}
              onChange={(e) => setShowInactive(e.target.checked)}
              className="rounded border-slate-300"
            />
            <span className="text-sm text-slate-600 dark:text-slate-400">Ver inactivos</span>
          </label>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="w-8 h-8 animate-spin text-slate-400" aria-hidden="true" />
          </div>
        ) : filtered.length === 0 ? (
          <EmptyState
            icon={<UserCheck className="w-7 h-7" />}
            title="Sin empleados"
            description="Agrega tu primer empleado"
            action={
              <Button onClick={openCreate} icon={<Plus className="w-4 h-4" />}>
                Nuevo Empleado
              </Button>
            }
          />
        ) : (
          <div className="overflow-x-auto -mx-4 px-4 sm:-mx-6 sm:px-6">
            <table className="w-full min-w-[640px]">
              <thead>
                <tr>
                  <th className="table-header rounded-l-lg">Nombre</th>
                  <th className="table-header hidden sm:table-cell">Documento</th>
                  <th className="table-header hidden md:table-cell">Cargo</th>
                  <th className="table-header text-right hidden lg:table-cell">Salario</th>
                  <th className="table-header hidden sm:table-cell">Estado</th>
                  <th className="table-header hidden md:table-cell">Sucursal</th>
                  <th className="table-header rounded-r-lg">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((e) => (
                  <tr key={e.id} className="hover:bg-slate-50 dark:hover:bg-white/[0.03]">
                    <td className="table-cell font-medium truncate max-w-[180px]">
                      {e.firstName} {e.lastName}
                    </td>
                    <td className="table-cell hidden sm:table-cell">
                      {e.docType || ""} {e.docNumber}
                    </td>
                    <td className="table-cell hidden md:table-cell">{e.position || "-"}</td>
                    <td className="table-cell text-right hidden lg:table-cell font-semibold">
                      {formatCurrency(e.baseSalary)}
                    </td>
                    <td className="table-cell hidden sm:table-cell">
                      <span
                        className={`px-2 py-1 rounded-full text-xs font-medium ${
                          e.isActive
                            ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400"
                            : "bg-slate-100 text-slate-500 dark:bg-[#0a0e1a]/30 dark:text-slate-400"
                        }`}
                      >
                        {e.isActive ? "Activo" : "Inactivo"}
                      </span>
                    </td>
                    <td className="table-cell hidden md:table-cell">{e.branch?.name || "-"}</td>
                    <td className="table-cell">
                      <div className="flex gap-1 flex-wrap min-h-[44px] items-center">
                        <button
                          onClick={() => openEdit(e)}
                          className="p-2.5 sm:p-1.5 hover:bg-violet-50 dark:hover:bg-violet-500/10 rounded-xl"
                          title="Editar"
                          aria-label="Editar"
                        >
                          <Pencil className="w-4 h-4 text-violet-600 dark:text-violet-400" />
                        </button>
                        {e.isActive && (
                          <button
                            onClick={() => handleDeactivate(e.id)}
                            className="p-2.5 sm:p-1.5 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-xl"
                            title="Desactivar"
                            aria-label="Desactivar"
                          >
                            <Trash2 className="w-4 h-4 text-red-500" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <Modal open={showModal} onClose={() => setShowModal(false)} title={editing ? "Editar Empleado" : "Nuevo Empleado"} size="xl">
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="flex gap-2 overflow-x-auto pb-2 -mx-1 border-b border-slate-200 dark:border-slate-700">
            {TABS.map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => setActiveTab(t.id)}
                className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-medium whitespace-nowrap min-h-[44px] transition-colors ${
                  activeTab === t.id
                    ? "bg-violet-100 text-violet-700 dark:bg-violet-500/20 dark:text-violet-300"
                    : "text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
                }`}
              >
                <t.icon className="w-4 h-4" />
                {t.label}
              </button>
            ))}
          </div>

          {activeTab === "personal" && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className={labelCls}>Nombre *</label>
                <input className={inputCls} value={form.firstName} onChange={(e) => setForm({ ...form, firstName: e.target.value })} required />
              </div>
              <div>
                <label className={labelCls}>Apellido *</label>
                <input className={inputCls} value={form.lastName} onChange={(e) => setForm({ ...form, lastName: e.target.value })} required />
              </div>
              <div>
                <label className={labelCls}>Tipo documento</label>
                <select className={inputCls} value={form.docType} onChange={(e) => setForm({ ...form, docType: e.target.value })}>
                  {DOC_TYPES.map((d) => (
                    <option key={d} value={d}>{d}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className={labelCls}>Número documento *</label>
                <input className={inputCls} value={form.docNumber} onChange={(e) => setForm({ ...form, docNumber: e.target.value })} required />
              </div>
              <div>
                <label className={labelCls}>Fecha nacimiento</label>
                <input type="date" className={inputCls} value={form.birthDate} onChange={(e) => setForm({ ...form, birthDate: e.target.value })} />
              </div>
              <div>
                <label className={labelCls}>Género</label>
                <select className={inputCls} value={form.gender} onChange={(e) => setForm({ ...form, gender: e.target.value })}>
                  <option value="">—</option>
                  {GENDERS.map((g) => (
                    <option key={g} value={g}>{g}</option>
                  ))}
                </select>
              </div>
              <div className="sm:col-span-2">
                <label className={labelCls}>Dirección</label>
                <input className={inputCls} value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} />
              </div>
              <div>
                <label className={labelCls}>Email</label>
                <input type="email" className={inputCls} value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
              </div>
              <div>
                <label className={labelCls}>Teléfono</label>
                <input type="tel" className={inputCls} value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
              </div>
            </div>
          )}

          {activeTab === "labor" && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className={labelCls}>Tipo contrato</label>
                <select className={inputCls} value={form.contractType} onChange={(e) => setForm({ ...form, contractType: e.target.value })}>
                  {CONTRACT_TYPES.map((c) => (
                    <option key={c.value} value={c.value}>{c.label}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className={labelCls}>Sucursal</label>
                <select className={inputCls} value={form.branchId} onChange={(e) => setForm({ ...form, branchId: e.target.value })}>
                  <option value="">—</option>
                  {branches.map((b) => (
                    <option key={b.id} value={b.id}>{b.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className={labelCls}>Fecha inicio *</label>
                <input type="date" className={inputCls} value={form.startDate} onChange={(e) => setForm({ ...form, startDate: e.target.value })} required />
              </div>
              <div>
                <label className={labelCls}>Fecha fin</label>
                <input type="date" className={inputCls} value={form.endDate} onChange={(e) => setForm({ ...form, endDate: e.target.value })} />
              </div>
              <div>
                <label className={labelCls}>Cargo</label>
                <input className={inputCls} value={form.position} onChange={(e) => setForm({ ...form, position: e.target.value })} />
              </div>
              <div>
                <label className={labelCls}>Centro de costo</label>
                <input className={inputCls} value={form.costCenter} onChange={(e) => setForm({ ...form, costCenter: e.target.value })} />
              </div>
              <div>
                <label className={labelCls}>Salario base</label>
                <input type="number" step="0.01" min="0" className={inputCls} value={form.baseSalary} onChange={(e) => setForm({ ...form, baseSalary: e.target.value })} />
              </div>
              <div>
                <label className={labelCls}>Tipo salario</label>
                <select className={inputCls} value={form.salaryType} onChange={(e) => setForm({ ...form, salaryType: e.target.value })}>
                  {SALARY_TYPES.map((s) => (
                    <option key={s.value} value={s.value}>{s.label}</option>
                  ))}
                </select>
              </div>
              <div className="sm:col-span-2">
                <label className={labelCls}>Horario</label>
                <input className={inputCls} value={form.workSchedule} onChange={(e) => setForm({ ...form, workSchedule: e.target.value })} />
              </div>
            </div>
          )}

          {activeTab === "payment" && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className={labelCls}>Método de pago</label>
                <select className={inputCls} value={form.paymentMethod} onChange={(e) => setForm({ ...form, paymentMethod: e.target.value })}>
                  {PAYMENT_METHODS.map((p) => (
                    <option key={p} value={p}>{p === "TRANSFER" ? "Transferencia" : p === "CASH" ? "Efectivo" : "Tarjeta"}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className={labelCls}>Banco</label>
                <input className={inputCls} value={form.bank} onChange={(e) => setForm({ ...form, bank: e.target.value })} />
              </div>
              <div>
                <label className={labelCls}>Tipo cuenta</label>
                <input className={inputCls} value={form.accountType} onChange={(e) => setForm({ ...form, accountType: e.target.value })} placeholder="Ahorros / Corriente" />
              </div>
              <div>
                <label className={labelCls}>Número cuenta</label>
                <input className={inputCls} value={form.accountNumber} onChange={(e) => setForm({ ...form, accountNumber: e.target.value })} />
              </div>
            </div>
          )}

          {activeTab === "social" && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className={labelCls}>EPS</label>
                <input className={inputCls} value={form.eps} onChange={(e) => setForm({ ...form, eps: e.target.value })} />
              </div>
              <div>
                <label className={labelCls}>Fondo pensión</label>
                <input className={inputCls} value={form.pensionFund} onChange={(e) => setForm({ ...form, pensionFund: e.target.value })} />
              </div>
              <div>
                <label className={labelCls}>ARL</label>
                <input className={inputCls} value={form.arl} onChange={(e) => setForm({ ...form, arl: e.target.value })} />
              </div>
              <div>
                <label className={labelCls}>Nivel riesgo ARL</label>
                <select className={inputCls} value={form.arlRiskLevel} onChange={(e) => setForm({ ...form, arlRiskLevel: e.target.value })}>
                  {[1, 2, 3, 4, 5].map((n) => (
                    <option key={n} value={String(n)}>Nivel {n}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className={labelCls}>Caja compensación</label>
                <input className={inputCls} value={form.compensationFund} onChange={(e) => setForm({ ...form, compensationFund: e.target.value })} />
              </div>
            </div>
          )}

          {activeTab === "user" && (
            <div className="space-y-4">
              <p className="text-sm text-slate-600 dark:text-slate-400">Vincular a un usuario existente para que pueda acceder al sistema.</p>
              <div>
                <label className={labelCls}>Buscar usuario</label>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <input
                    className={`${inputCls} pl-10`}
                    value={userSearch}
                    onChange={(e) => setUserSearch(e.target.value)}
                    placeholder="Nombre o email..."
                  />
                </div>
                {userSearchFiltered.length > 0 && (
                  <ul className="mt-2 border border-slate-200 dark:border-slate-700 rounded-xl overflow-hidden max-h-40 overflow-y-auto">
                    {userSearchFiltered.map((u) => (
                      <li key={u.id}>
                        <button
                          type="button"
                          onClick={() => {
                            setForm({ ...form, userId: u.id });
                            setUserSearch(u.name);
                          }}
                          className="w-full text-left px-4 py-3 hover:bg-slate-50 dark:hover:bg-slate-800 flex justify-between items-center min-h-[44px]"
                        >
                          <span>{u.name}</span>
                          <span className="text-xs text-slate-500">{u.email}</span>
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
              {form.userId && (
                <div className="flex items-center justify-between">
                  <p className="text-sm text-emerald-600 dark:text-emerald-400">Usuario vinculado seleccionado.</p>
                  <button
                    type="button"
                    onClick={() => { setForm({ ...form, userId: "" }); setUserSearch(""); }}
                    className="text-sm text-slate-500 hover:text-red-600 dark:hover:text-red-400"
                  >
                    Desvincular
                  </button>
                </div>
              )}
            </div>
          )}

          <div className="flex flex-col-reverse sm:flex-row justify-end gap-2 pt-4 border-t border-slate-200 dark:border-slate-700">
            <Button type="button" variant="secondary" onClick={() => setShowModal(false)}>
              Cancelar
            </Button>
            <Button type="submit" loading={submitting} disabled={submitting}>
              {editing ? "Actualizar" : "Crear"}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
