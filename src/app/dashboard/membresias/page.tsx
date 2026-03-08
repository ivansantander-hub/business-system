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

interface GymMember {
  id: number;
  customer: { id: number; name: string; phone: string | null };
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
  ACTIVE: "bg-emerald-100 text-emerald-800",
  EXPIRED: "bg-red-100 text-red-800",
  SUSPENDED: "bg-amber-100 text-amber-800",
  FROZEN: "bg-blue-100 text-blue-800",
  CANCELLED: "bg-gray-100 text-gray-700",
};

const PAYMENT_BADGE: Record<string, string> = {
  PAID: "bg-emerald-100 text-emerald-800",
  PENDING: "bg-amber-100 text-amber-800",
  OVERDUE: "bg-red-100 text-red-800",
};

export default function MembresiasPage() {
  const [tab, setTab] = useState<TabType>("plans");
  const [plans, setPlans] = useState<MembershipPlan[]>([]);
  const [memberships, setMemberships] = useState<Membership[]>([]);
  const [members, setMembers] = useState<GymMember[]>([]);
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
  const [membershipForm, setMembershipForm] = useState({ memberId: "", planId: "", paymentStatus: "PENDING" });
  const [memberSearch, setMemberSearch] = useState("");

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

  const loadMembers = useCallback(async () => {
    const params = memberSearch ? `?search=${encodeURIComponent(memberSearch)}` : "";
    const res = await fetch(`/api/gym-members${params}`);
    if (res.ok) setMembers(await res.json());
    else setMembers([]);
  }, [memberSearch]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (showMembershipModal) loadMembers();
  }, [showMembershipModal, memberSearch, loadMembers]);

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
    const body = editingPlan
      ? {
          action,
          id: editingPlan.id,
          name: planForm.name,
          durationDays: Number(planForm.durationDays),
          price: Number(planForm.price),
          description: planForm.description || null,
          features: planForm.features || null,
        }
      : {
          action,
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
    setMembershipForm({ memberId: "", planId: "", paymentStatus: "PENDING" });
    setMemberSearch("");
    setShowMembershipModal(true);
  }

  async function handleMembershipSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!membershipForm.memberId || !membershipForm.planId) {
      setToast({ message: "Seleccione miembro y plan", type: "error" });
      return;
    }
    const res = await fetch("/api/membership-plans", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "create-membership",
        memberId: Number(membershipForm.memberId),
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
          <CreditCard className="w-7 h-7 text-indigo-600" />
          <h1 className="text-2xl font-bold text-gray-900">Membresías</h1>
        </div>
      </div>

      <div className="flex gap-2 border-b border-gray-200">
        <button
          onClick={() => setTab("plans")}
          className={`px-4 py-2 font-medium rounded-t-lg transition-colors ${
            tab === "plans" ? "bg-white border border-b-0 border-gray-200 text-indigo-600" : "text-gray-500 hover:text-gray-700"
          }`}
        >
          Planes
        </button>
        <button
          onClick={() => setTab("memberships")}
          className={`px-4 py-2 font-medium rounded-t-lg transition-colors ${
            tab === "memberships" ? "bg-white border border-b-0 border-gray-200 text-indigo-600" : "text-gray-500 hover:text-gray-700"
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
                  <div
                    key={p.id}
                    className={`card p-5 ${p.isActive ? "" : "opacity-60"}`}
                  >
                    <div className="flex justify-between items-start mb-3">
                      <h3 className="font-semibold text-lg text-gray-900">{p.name}</h3>
                      <span className="text-xl font-bold text-indigo-600">
                        {formatCurrency(p.price)}
                      </span>
                    </div>
                    <p className="text-sm text-gray-500 mb-2">{p.durationDays} días</p>
                    {p.description && (
                      <p className="text-sm text-gray-600 mb-2 line-clamp-2">{p.description}</p>
                    )}
                    {p._count !== undefined && (
                      <p className="text-xs text-gray-400 mb-3">{p._count.memberships} membresías</p>
                    )}
                    <div className="flex gap-2">
                      {p.isActive && (
                        <>
                          <button
                            onClick={() => openEditPlan(p)}
                            className="btn-secondary text-xs flex items-center gap-1"
                          >
                            <Pencil className="w-3.5 h-3.5" /> Editar
                          </button>
                          <button
                            onClick={() => handleDeactivatePlan(p)}
                            className="btn-danger text-xs flex items-center gap-1"
                          >
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
                      <th className="table-header">Miembro</th>
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
                      <tr key={m.id} className="hover:bg-gray-50">
                        <td className="table-cell font-medium">{m.member.customer.name}</td>
                        <td className="table-cell">{m.plan.name}</td>
                        <td className="table-cell">{formatDate(m.startDate)}</td>
                        <td className="table-cell">{formatDate(m.endDate)}</td>
                        <td className="table-cell">
                          <span
                            className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                              STATUS_BADGE[m.status] || "bg-gray-100 text-gray-700"
                            }`}
                          >
                            {m.status}
                          </span>
                        </td>
                        <td className="table-cell">
                          <span
                            className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                              PAYMENT_BADGE[m.paymentStatus] || "bg-gray-100 text-gray-700"
                            }`}
                          >
                            {m.paymentStatus}
                          </span>
                        </td>
                        <td className="table-cell">
                          <div className="flex gap-1">
                            {m.status === "ACTIVE" && (
                              <button
                                onClick={() => handleRenew(m)}
                                className="btn-success text-xs flex items-center gap-1"
                              >
                                <RefreshCw className="w-3.5 h-3.5" /> Renovar
                              </button>
                            )}
                            {m.status === "ACTIVE" && (
                              <button
                                onClick={() => handleUpdateStatus(m, "SUSPENDED")}
                                className="btn-secondary text-xs flex items-center gap-1"
                              >
                                <Ban className="w-3.5 h-3.5" /> Suspender
                              </button>
                            )}
                            {m.status !== "CANCELLED" && (
                              <button
                                onClick={() => handleUpdateStatus(m, "CANCELLED")}
                                className="btn-danger text-xs flex items-center gap-1"
                              >
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

      <Modal
        open={showPlanModal}
        onClose={() => setShowPlanModal(false)}
        title={editingPlan ? "Editar Plan" : "Crear Plan"}
        size="md"
      >
        <form onSubmit={handlePlanSubmit} className="space-y-4">
          <div>
            <label htmlFor="plan-name" className="block text-sm font-medium text-gray-700 mb-1">Nombre *</label>
            <input
              id="plan-name"
              className="input-field"
              value={planForm.name}
              onChange={(e) => setPlanForm({ ...planForm, name: e.target.value })}
              required
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label htmlFor="plan-duration" className="block text-sm font-medium text-gray-700 mb-1">Duración (días) *</label>
              <input
                id="plan-duration"
                type="number"
                min="1"
                className="input-field"
                value={planForm.durationDays}
                onChange={(e) => setPlanForm({ ...planForm, durationDays: e.target.value })}
                required
              />
            </div>
            <div>
              <label htmlFor="plan-price" className="block text-sm font-medium text-gray-700 mb-1">Precio *</label>
              <input
                id="plan-price"
                type="number"
                min="0"
                step="0.01"
                className="input-field"
                value={planForm.price}
                onChange={(e) => setPlanForm({ ...planForm, price: e.target.value })}
                required
              />
            </div>
          </div>
          <div>
            <label htmlFor="plan-description" className="block text-sm font-medium text-gray-700 mb-1">Descripción</label>
            <input
              id="plan-description"
              className="input-field"
              value={planForm.description}
              onChange={(e) => setPlanForm({ ...planForm, description: e.target.value })}
            />
          </div>
          <div>
            <label htmlFor="plan-features" className="block text-sm font-medium text-gray-700 mb-1">Características</label>
            <textarea
              id="plan-features"
              className="input-field min-h-[80px]"
              value={planForm.features}
              onChange={(e) => setPlanForm({ ...planForm, features: e.target.value })}
              placeholder="Una por línea"
            />
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <button type="button" onClick={() => setShowPlanModal(false)} className="btn-secondary">
              Cancelar
            </button>
            <button type="submit" className="btn-primary">
              {editingPlan ? "Actualizar" : "Crear Plan"}
            </button>
          </div>
        </form>
      </Modal>

      <Modal
        open={showMembershipModal}
        onClose={() => setShowMembershipModal(false)}
        title="Nueva Membresía"
        size="lg"
      >
        <form onSubmit={handleMembershipSubmit} className="space-y-4">
          <div>
            <label htmlFor="member-search" className="block text-sm font-medium text-gray-700 mb-1">Buscar miembro</label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                id="member-search"
                className="input-field pl-10"
                placeholder="Nombre, teléfono..."
                value={memberSearch}
                onChange={(e) => setMemberSearch(e.target.value)}
              />
            </div>
          </div>
          <div>
            <label htmlFor="membership-member" className="block text-sm font-medium text-gray-700 mb-1">Miembro *</label>
            <select
              id="membership-member"
              className="input-field"
              value={membershipForm.memberId}
              onChange={(e) => setMembershipForm({ ...membershipForm, memberId: e.target.value })}
              required
            >
              <option value="">Seleccionar miembro</option>
              {members.map((mem) => (
                <option key={mem.id} value={mem.id}>
                  {mem.customer.name} {mem.customer.phone ? `(${mem.customer.phone})` : ""}
                </option>
              ))}
              {members.length === 0 && !memberSearch && (
                <option value="" disabled>Cargando...</option>
              )}
            </select>
          </div>
          <div>
            <label htmlFor="membership-plan" className="block text-sm font-medium text-gray-700 mb-1">Plan *</label>
            <select
              id="membership-plan"
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
            <label htmlFor="membership-payment" className="block text-sm font-medium text-gray-700 mb-1">Estado de pago</label>
            <select
              id="membership-payment"
              className="input-field"
              value={membershipForm.paymentStatus}
              onChange={(e) =>
                setMembershipForm({ ...membershipForm, paymentStatus: e.target.value })
              }
            >
              <option value="PENDING">Pendiente</option>
              <option value="PAID">Pagado</option>
              <option value="OVERDUE">Vencido</option>
            </select>
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <button type="button" onClick={() => setShowMembershipModal(false)} className="btn-secondary">
              Cancelar
            </button>
            <button type="submit" className="btn-primary">
              Crear Membresía
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
