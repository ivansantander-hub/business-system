"use client";

import { useEffect, useState, useCallback } from "react";
import {
  CreditCard,
  Plus,
  Pencil,
  PowerOff,
  RefreshCw,
  Ban,
  XCircle,
  Search,
  Loader2,
} from "lucide-react";
import Modal from "@/components/ui/Modal";
import Toast from "@/components/ui/Toast";
import { formatCurrency, formatDate } from "@/lib/utils";

type TabType = "plans" | "memberships";

interface MembershipPlan {
  id: number;
  name: string;
  durationDays: number;
  price: string;
  description: string | null;
  features: string | null;
  isActive: boolean;
  _count?: { memberships: number };
}

interface CustomerOption {
  id: number;
  name: string;
  nit: string | null;
  phone: string | null;
  email: string | null;
}

interface Membership {
  id: number;
  memberId: number;
  planId: number;
  startDate: string;
  endDate: string;
  status: string;
  paymentStatus: string;
  member: { customer: { name: string } };
  plan: { name: string; durationDays: number; price: string };
}

const STATUS_BADGE: Record<string, string> = {
  ACTIVE: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400",
  EXPIRED: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400",
  SUSPENDED: "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400",
  FROZEN: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400",
  CANCELLED: "bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300",
};

const PAYMENT_BADGE: Record<string, string> = {
  PAID: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400",
  PENDING: "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400",
  OVERDUE: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400",
};

export default function MembresiasPage() {
  const [tab, setTab] = useState<TabType>("plans");
  const [plans, setPlans] = useState<MembershipPlan[]>([]);
  const [memberships, setMemberships] = useState<Membership[]>([]);
  const [customers, setCustomers] = useState<CustomerOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState<{ message: string; type: "success" | "error" | "info" } | null>(null);

  const [showPlanModal, setShowPlanModal] = useState(false);
  const [editingPlan, setEditingPlan] = useState<MembershipPlan | null>(null);
  const [planForm, setPlanForm] = useState({
    name: "",
    durationDays: "30",
    price: "",
    description: "",
    features: "",
  });

  const [showMembershipModal, setShowMembershipModal] = useState(false);
  const [membershipForm, setMembershipForm] = useState({ customerId: "", planId: "", paymentStatus: "PENDING" });
  const [customerSearch, setCustomerSearch] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/membership-plans?include=memberships");
      if (res.ok) {
        const data = await res.json();
        setPlans(data.plans || []);
        setMemberships(data.memberships || []);
      }
    } catch {
      setToast({ message: "Error al cargar datos", type: "error" });
    } finally {
      setLoading(false);
    }
  }, []);

  const loadCustomers = useCallback(async () => {
    const params = customerSearch ? `?search=${encodeURIComponent(customerSearch)}` : "";
    const res = await fetch(`/api/customers${params}`);
    if (res.ok) setCustomers(await res.json());
    else setCustomers([]);
  }, [customerSearch]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    if (showMembershipModal) loadCustomers();
  }, [showMembershipModal, customerSearch, loadCustomers]);

  function openCreatePlan() {
    setEditingPlan(null);
    setPlanForm({ name: "", durationDays: "30", price: "", description: "", features: "" });
    setShowPlanModal(true);
  }

  function openEditPlan(p: MembershipPlan) {
    setEditingPlan(p);
    setPlanForm({
      name: p.name,
      durationDays: String(p.durationDays),
      price: p.price,
      description: p.description || "",
      features: p.features || "",
    });
    setShowPlanModal(true);
  }

  async function handlePlanSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const action = editingPlan ? "update-plan" : "create-plan";
    const body = {
      action,
      ...(editingPlan && { id: editingPlan.id }),
      name: planForm.name,
      durationDays: Number(planForm.durationDays),
      price: Number(planForm.price),
      description: planForm.description || null,
      features: planForm.features || null,
    };
    const res = await fetch("/api/membership-plans", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (res.ok) {
      setShowPlanModal(false);
      load();
      setToast({ message: editingPlan ? "Plan actualizado" : "Plan creado", type: "success" });
    } else {
      const err = await res.json();
      setToast({ message: err.error || "Error", type: "error" });
    }
  }

  async function handleDeactivatePlan(p: MembershipPlan) {
    if (!confirm("¿Desactivar este plan?")) return;
    const res = await fetch("/api/membership-plans", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "update-plan", id: p.id, isActive: false }),
    });
    if (res.ok) {
      load();
      setToast({ message: "Plan desactivado", type: "success" });
    }
  }

  function openCreateMembership() {
    setMembershipForm({ customerId: "", planId: "", paymentStatus: "PENDING" });
    setCustomerSearch("");
    setShowMembershipModal(true);
  }

  async function handleMembershipSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!membershipForm.customerId || !membershipForm.planId) {
      setToast({ message: "Seleccione un cliente y un plan", type: "error" });
      return;
    }
    const res = await fetch("/api/membership-plans", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "create-membership",
        customerId: Number(membershipForm.customerId),
        planId: Number(membershipForm.planId),
        paymentStatus: membershipForm.paymentStatus,
      }),
    });
    if (res.ok) {
      setShowMembershipModal(false);
      load();
      setToast({ message: "Membresía creada", type: "success" });
    } else {
      const err = await res.json();
      setToast({ message: err.error || "Error", type: "error" });
    }
  }

  async function handleRenew(m: Membership) {
    const res = await fetch("/api/membership-plans", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "renew", id: m.id }),
    });
    if (res.ok) {
      load();
      setToast({ message: "Membresía renovada", type: "success" });
    } else {
      const err = await res.json();
      setToast({ message: err.error || "Error", type: "error" });
    }
  }

  async function handleUpdateStatus(m: Membership, status: string) {
    const res = await fetch("/api/membership-plans", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "update-status", id: m.id, status }),
    });
    if (res.ok) {
      load();
      setToast({ message: `Estado actualizado a ${status}`, type: "success" });
    } else {
      const err = await res.json();
      setToast({ message: err.error || "Error", type: "error" });
    }
  }

  const activePlans = plans.filter((p) => p.isActive);

  return (
    <div className="space-y-6">
      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}

      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <CreditCard className="w-7 h-7 text-indigo-600 dark:text-indigo-400" />
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Membresías</h1>
        </div>
      </div>

      <div className="flex gap-2 border-b border-gray-200 dark:border-gray-700">
        <button
          onClick={() => setTab("plans")}
          className={`px-4 py-2 font-medium rounded-t-lg transition-colors ${
            tab === "plans"
              ? "bg-white dark:bg-gray-800 border border-b-0 border-gray-200 dark:border-gray-700 text-indigo-600 dark:text-indigo-400"
              : "text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300"
          }`}
        >
          Planes
        </button>
        <button
          onClick={() => setTab("memberships")}
          className={`px-4 py-2 font-medium rounded-t-lg transition-colors ${
            tab === "memberships"
              ? "bg-white dark:bg-gray-800 border border-b-0 border-gray-200 dark:border-gray-700 text-indigo-600 dark:text-indigo-400"
              : "text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300"
          }`}
        >
          Membresías Activas
        </button>
      </div>

      {loading ? (
        <div className="card flex items-center justify-center py-16">
          <Loader2 className="w-8 h-8 animate-spin text-indigo-600" />
        </div>
      ) : (
        <>
          {tab === "plans" && (
            <div className="space-y-4">
              <div className="flex justify-end">
                <button onClick={openCreatePlan} className="btn-primary flex items-center gap-2">
                  <Plus className="w-4 h-4" /> Crear Plan
                </button>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {plans.map((p) => (
                  <div key={p.id} className={`card p-5 ${p.isActive ? "" : "opacity-60"}`}>
                    <div className="flex justify-between items-start mb-3">
                      <h3 className="font-semibold text-lg text-gray-900 dark:text-white">{p.name}</h3>
                      <span className="text-xl font-bold text-indigo-600 dark:text-indigo-400">
                        {formatCurrency(p.price)}
                      </span>
                    </div>
                    <p className="text-sm text-gray-500 dark:text-gray-400 mb-2">{p.durationDays} días</p>
                    {p.description && <p className="text-sm text-gray-600 dark:text-gray-300 mb-2 line-clamp-2">{p.description}</p>}
                    {p._count !== undefined && (
                      <p className="text-xs text-gray-400 mb-3">{p._count.memberships} membresías</p>
                    )}
                    <div className="flex gap-2">
                      {p.isActive && (
                        <>
                          <button onClick={() => openEditPlan(p)} className="btn-secondary text-xs flex items-center gap-1">
                            <Pencil className="w-3.5 h-3.5" /> Editar
                          </button>
                          <button onClick={() => handleDeactivatePlan(p)} className="btn-danger text-xs flex items-center gap-1">
                            <PowerOff className="w-3.5 h-3.5" /> Desactivar
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                ))}
                {plans.length === 0 && (
                  <div className="col-span-full card text-center text-gray-400 py-12">
                    No hay planes. Crea uno para comenzar.
                  </div>
                )}
              </div>
            </div>
          )}

          {tab === "memberships" && (
            <div className="space-y-4">
              <div className="flex justify-end">
                <button onClick={openCreateMembership} className="btn-primary flex items-center gap-2">
                  <Plus className="w-4 h-4" /> Nueva Membresía
                </button>
              </div>
              <div className="card overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr>
                      <th className="table-header">Cliente</th>
                      <th className="table-header">Plan</th>
                      <th className="table-header">Inicio</th>
                      <th className="table-header">Fin</th>
                      <th className="table-header">Estado</th>
                      <th className="table-header">Pago</th>
                      <th className="table-header">Acciones</th>
                    </tr>
                  </thead>
                  <tbody>
                    {memberships.map((m) => (
                      <tr key={m.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/50">
                        <td className="table-cell font-medium">{m.member.customer.name}</td>
                        <td className="table-cell">{m.plan.name}</td>
                        <td className="table-cell">{formatDate(m.startDate)}</td>
                        <td className="table-cell">{formatDate(m.endDate)}</td>
                        <td className="table-cell">
                          <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_BADGE[m.status] || "bg-gray-100 text-gray-700"}`}>
                            {m.status}
                          </span>
                        </td>
                        <td className="table-cell">
                          <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${PAYMENT_BADGE[m.paymentStatus] || "bg-gray-100 text-gray-700"}`}>
                            {m.paymentStatus}
                          </span>
                        </td>
                        <td className="table-cell">
                          <div className="flex gap-1">
                            {m.status === "ACTIVE" && (
                              <button onClick={() => handleRenew(m)} className="btn-success text-xs flex items-center gap-1">
                                <RefreshCw className="w-3.5 h-3.5" /> Renovar
                              </button>
                            )}
                            {m.status === "ACTIVE" && (
                              <button onClick={() => handleUpdateStatus(m, "SUSPENDED")} className="btn-secondary text-xs flex items-center gap-1">
                                <Ban className="w-3.5 h-3.5" /> Suspender
                              </button>
                            )}
                            {m.status !== "CANCELLED" && (
                              <button onClick={() => handleUpdateStatus(m, "CANCELLED")} className="btn-danger text-xs flex items-center gap-1">
                                <XCircle className="w-3.5 h-3.5" /> Cancelar
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                    {memberships.length === 0 && (
                      <tr>
                        <td colSpan={7} className="table-cell text-center text-gray-400 py-12">
                          No hay membresías
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      )}

      <Modal open={showPlanModal} onClose={() => setShowPlanModal(false)} title={editingPlan ? "Editar Plan" : "Crear Plan"} size="md">
        <form onSubmit={handlePlanSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Nombre *</label>
            <input className="input-field" value={planForm.name} onChange={(e) => setPlanForm({ ...planForm, name: e.target.value })} required />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Duración (días) *</label>
              <input type="number" min="1" className="input-field" value={planForm.durationDays} onChange={(e) => setPlanForm({ ...planForm, durationDays: e.target.value })} required />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Precio *</label>
              <input type="number" min="0" step="100" className="input-field" value={planForm.price} onChange={(e) => setPlanForm({ ...planForm, price: e.target.value })} required />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Descripción</label>
            <input className="input-field" value={planForm.description} onChange={(e) => setPlanForm({ ...planForm, description: e.target.value })} />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Características</label>
            <textarea className="input-field min-h-[80px]" value={planForm.features} onChange={(e) => setPlanForm({ ...planForm, features: e.target.value })} placeholder="Una por línea" />
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <button type="button" onClick={() => setShowPlanModal(false)} className="btn-secondary">Cancelar</button>
            <button type="submit" className="btn-primary">{editingPlan ? "Actualizar" : "Crear Plan"}</button>
          </div>
        </form>
      </Modal>

      <Modal open={showMembershipModal} onClose={() => setShowMembershipModal(false)} title="Nueva Membresía" size="md">
        <form onSubmit={handleMembershipSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Buscar cliente</label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                className="input-field pl-10"
                placeholder="Nombre, documento, teléfono..."
                value={customerSearch}
                onChange={(e) => setCustomerSearch(e.target.value)}
              />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Cliente *</label>
            <div className="max-h-40 overflow-y-auto border border-gray-200 dark:border-gray-600 rounded-lg">
              {customers.length === 0 ? (
                <p className="text-sm text-gray-400 text-center py-4">
                  {customerSearch ? "Sin resultados" : "Buscando clientes..."}
                </p>
              ) : (
                customers.map((c) => (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => setMembershipForm({ ...membershipForm, customerId: String(c.id) })}
                    className={`w-full text-left px-3 py-2.5 text-sm border-b border-gray-100 dark:border-gray-700 last:border-0 transition-colors ${
                      membershipForm.customerId === String(c.id)
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
            {membershipForm.customerId && (
              <p className="text-xs text-emerald-600 dark:text-emerald-400 mt-1">Cliente seleccionado</p>
            )}
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Plan *</label>
            <select
              className="input-field"
              value={membershipForm.planId}
              onChange={(e) => setMembershipForm({ ...membershipForm, planId: e.target.value })}
              required
            >
              <option value="">Seleccionar plan</option>
              {activePlans.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name} - {formatCurrency(p.price)} ({p.durationDays} días)
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Estado de pago</label>
            <select
              className="input-field"
              value={membershipForm.paymentStatus}
              onChange={(e) => setMembershipForm({ ...membershipForm, paymentStatus: e.target.value })}
            >
              <option value="PENDING">Pendiente</option>
              <option value="PAID">Pagado</option>
              <option value="OVERDUE">Vencido</option>
            </select>
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <button type="button" onClick={() => setShowMembershipModal(false)} className="btn-secondary">Cancelar</button>
            <button type="submit" className="btn-primary">Crear Membresía</button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
