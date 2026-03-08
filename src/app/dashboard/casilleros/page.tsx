"use client";

import { useEffect, useState, useCallback } from "react";
import { Package, Plus, Wrench, User, Search } from "lucide-react";
import Modal from "@/components/ui/Modal";
import Toast from "@/components/ui/Toast";
import { formatCurrency, formatDate } from "@/lib/utils";

interface Customer {
  id: string;
  name: string;
  email?: string | null;
  phone?: string | null;
}

interface GymMember {
  id: string;
  customer: Customer;
}

interface LockerAssignment {
  id: string;
  memberId: string;
  member: GymMember;
  startDate: string;
  monthlyFee: string;
}

interface Locker {
  id: string;
  number: string;
  section: string | null;
  status: string;
  currentAssignment: LockerAssignment | null;
}

export default function CasillerosPage() {
  const [lockers, setLockers] = useState<Locker[]>([]);
  const [members, setMembers] = useState<GymMember[]>([]);
  const [sectionFilter, setSectionFilter] = useState<string | null>(null);
  const [selectedLocker, setSelectedLocker] = useState<Locker | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [assignMemberId, setAssignMemberId] = useState("");
  const [assignFee, setAssignFee] = useState("");
  const [createForm, setCreateForm] = useState({ number: "", section: "" });
  const [memberSearch, setMemberSearch] = useState("");
  const [toast, setToast] = useState<{ message: string; type: "success" | "error" } | null>(null);

  const loadLockers = useCallback(async () => {
    const url =
      sectionFilter && sectionFilter !== "__none__"
        ? `/api/lockers?section=${encodeURIComponent(sectionFilter)}`
        : "/api/lockers";
    const res = await fetch(url);
    if (res.ok) setLockers(await res.json());
    else setLockers([]);
  }, [sectionFilter]);

  const loadMembers = useCallback(async () => {
    const res = await fetch(`/api/gym-members?search=${encodeURIComponent(memberSearch || " ")}`);
    if (res.ok) setMembers(await res.json());
    else setMembers([]);
  }, [memberSearch]);

  useEffect(() => {
    loadLockers();
  }, [loadLockers]);

  useEffect(() => {
    if (selectedLocker?.status === "AVAILABLE" && memberSearch) {
      const t = setTimeout(loadMembers, 300);
      return () => clearTimeout(t);
    }
  }, [selectedLocker?.status, memberSearch, loadMembers]);

  const sections = [...new Set(lockers.map((l) => l.section).filter(Boolean))] as string[];
  const filteredLockers = sectionFilter
    ? lockers.filter((l) => l.section === sectionFilter)
    : lockers;

  const stats = {
    total: lockers.length,
    available: lockers.filter((l) => l.status === "AVAILABLE").length,
    assigned: lockers.filter((l) => l.status === "ASSIGNED").length,
    maintenance: lockers.filter((l) => l.status === "MAINTENANCE").length,
  };

  const statusColors: Record<string, string> = {
    AVAILABLE: "border-emerald-300 bg-emerald-50 hover:bg-emerald-100",
    ASSIGNED: "border-blue-300 bg-blue-50 hover:bg-blue-100",
    MAINTENANCE: "border-amber-300 bg-amber-50 hover:bg-amber-100",
  };

  async function createLocker(e: React.FormEvent) {
    e.preventDefault();
    const res = await fetch("/api/lockers", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(createForm),
    });
    const data = await res.json();
    if (res.ok) {
      setShowCreate(false);
      setCreateForm({ number: "", section: "" });
      loadLockers();
      setToast({ message: "Casillero creado", type: "success" });
    } else {
      setToast({ message: data.error || "Error al crear", type: "error" });
    }
  }

  async function handleAssign() {
    if (!selectedLocker || !assignMemberId) return;
    const res = await fetch("/api/lockers", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "assign",
        lockerId: selectedLocker.id,
        memberId: assignMemberId,
        monthlyFee: assignFee ? Number(assignFee) : 0,
      }),
    });
    const data = await res.json();
    if (res.ok) {
      setSelectedLocker(null);
      setAssignMemberId("");
      setAssignFee("");
      loadLockers();
      setToast({ message: "Casillero asignado", type: "success" });
    } else {
      setToast({ message: data.error || "Error al asignar", type: "error" });
    }
  }

  async function handleRelease() {
    if (!selectedLocker) return;
    const res = await fetch("/api/lockers", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "release", lockerId: selectedLocker.id }),
    });
    const data = await res.json();
    if (res.ok) {
      setSelectedLocker(null);
      loadLockers();
      setToast({ message: "Casillero liberado", type: "success" });
    } else {
      setToast({ message: data.error || "Error al liberar", type: "error" });
    }
  }

  async function toggleMaintenance() {
    if (!selectedLocker) return;
    const newStatus = selectedLocker.status === "MAINTENANCE" ? "set_available" : "maintenance";
    const res = await fetch("/api/lockers", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: newStatus, lockerId: selectedLocker.id }),
    });
    const data = await res.json();
    if (res.ok) {
      loadLockers();
      setSelectedLocker({ ...selectedLocker, status: newStatus === "maintenance" ? "MAINTENANCE" : "AVAILABLE" });
      setToast({
        message: newStatus === "maintenance" ? "En mantenimiento" : "Disponible",
        type: "success",
      });
    } else {
      setToast({ message: data.error || "Error", type: "error" });
    }
  }

  return (
    <div className="space-y-6">
      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}

      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Package className="w-7 h-7 text-indigo-600 dark:text-indigo-400" />
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Casilleros</h1>
        </div>
        <button
          onClick={() => {
            setCreateForm({ number: "", section: "" });
            setShowCreate(true);
          }}
          className="btn-primary flex items-center gap-2"
        >
          <Plus className="w-4 h-4" />
          Nuevo Casillero
        </button>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="card">
          <p className="text-sm text-gray-500 dark:text-gray-400">Total</p>
          <p className="text-2xl font-bold text-gray-900 dark:text-white">{stats.total}</p>
        </div>
        <div className="card border-emerald-200 bg-emerald-50/50">
          <p className="text-sm text-emerald-700">Disponibles</p>
          <p className="text-2xl font-bold text-emerald-800">{stats.available}</p>
        </div>
        <div className="card border-blue-200 bg-blue-50/50">
          <p className="text-sm text-blue-700">Asignados</p>
          <p className="text-2xl font-bold text-blue-800">{stats.assigned}</p>
        </div>
        <div className="card border-amber-200 bg-amber-50/50">
          <p className="text-sm text-amber-700">Mantenimiento</p>
          <p className="text-2xl font-bold text-amber-800">{stats.maintenance}</p>
        </div>
      </div>

      <div className="flex gap-2 flex-wrap">
        <button
          onClick={() => setSectionFilter(null)}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
            !sectionFilter ? "btn-primary" : "btn-secondary"
          }`}
        >
          Todos
        </button>
        {sections.map((s) => (
          <button
            key={s}
            onClick={() => setSectionFilter(s)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              sectionFilter === s ? "btn-primary" : "btn-secondary"
            }`}
          >
            {s}
          </button>
        ))}
      </div>

      {(sections.length > 0 ? sections : [null]).map((section) => (
        <div key={section || "all"}>
          {section && <h3 className="font-semibold text-gray-700 mb-3">{section}</h3>}
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
            {filteredLockers
              .filter((l) => (section ? l.section === section : true))
              .map((locker) => (
                <button
                  key={locker.id}
                  onClick={() => setSelectedLocker(locker)}
                  className={`rounded-xl border-2 p-4 text-center transition-all ${statusColors[locker.status] || "bg-gray-50"}`}
                >
                  <p className="text-3xl font-bold text-gray-800">{locker.number}</p>
                  {locker.status === "ASSIGNED" && locker.currentAssignment && (
                    <p className="text-xs text-blue-700 mt-1 truncate" title={locker.currentAssignment.member.customer.name}>
                      {locker.currentAssignment.member.customer.name}
                    </p>
                  )}
                  {locker.status === "MAINTENANCE" && (
                    <p className="text-xs text-amber-700 mt-1 flex items-center justify-center gap-1">
                      <Wrench className="w-3 h-3" />
                      Mantenimiento
                    </p>
                  )}
                  {locker.status === "AVAILABLE" && (
                    <p className="text-xs text-emerald-700 dark:text-emerald-400 mt-1">Disponible</p>
                  )}
                </button>
              ))}
          </div>
        </div>
      ))}

      {filteredLockers.length === 0 && (
        <div className="card text-center text-gray-400 dark:text-gray-500 py-12">
          {sectionFilter ? "No hay casilleros en esta sección" : "No hay casilleros. Crea uno para comenzar."}
        </div>
      )}

      <Modal
        open={showCreate}
        onClose={() => setShowCreate(false)}
        title="Nuevo Casillero"
        size="sm"
      >
        <form onSubmit={createLocker} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Número *</label>
            <input
              className="input-field"
              value={createForm.number}
              onChange={(e) => setCreateForm({ ...createForm, number: e.target.value })}
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Sección</label>
            <input
              className="input-field"
              value={createForm.section}
              onChange={(e) => setCreateForm({ ...createForm, section: e.target.value })}
              placeholder="Ej: A, B, Vestuario"
            />
          </div>
          <div className="flex justify-end gap-3">
            <button type="button" onClick={() => setShowCreate(false)} className="btn-secondary">
              Cancelar
            </button>
            <button type="submit" className="btn-primary">
              Crear
            </button>
          </div>
        </form>
      </Modal>

      <Modal
        open={!!selectedLocker}
        onClose={() => {
          setSelectedLocker(null);
          setAssignMemberId("");
          setAssignFee("");
        }}
        title={selectedLocker ? `Casillero ${selectedLocker.number}` : ""}
        size="md"
      >
        {selectedLocker && (
          <div className="space-y-4">
            <div className="flex items-center justify-between bg-gray-50 dark:bg-gray-800/50 rounded-lg p-3">
              <div>
                <p className="text-sm text-gray-500">
                  Estado:{" "}
                  <span
                    className={`font-semibold ${
                      selectedLocker.status === "AVAILABLE"
                        ? "text-emerald-600 dark:text-emerald-400"
                        : selectedLocker.status === "ASSIGNED"
                          ? "text-blue-600 dark:text-blue-400"
                          : "text-amber-600 dark:text-amber-400"
                    }`}
                  >
                    {selectedLocker.status === "AVAILABLE"
                      ? "Disponible"
                      : selectedLocker.status === "ASSIGNED"
                        ? "Asignado"
                        : "Mantenimiento"}
                  </span>
                </p>
                {selectedLocker.section && (
                  <p className="text-sm text-gray-500 dark:text-gray-400">Sección: {selectedLocker.section}</p>
                )}
              </div>
            </div>

            {selectedLocker.status === "AVAILABLE" && (
              <div className="space-y-3">
                <h4 className="font-medium text-gray-700 dark:text-gray-300">Asignar a miembro</h4>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Buscar miembro</label>
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 dark:text-gray-500" />
                    <input
                      className="input-field pl-10"
                      placeholder="Nombre, email o teléfono..."
                      value={memberSearch}
                      onChange={(e) => setMemberSearch(e.target.value)}
                    />
                  </div>
                </div>
                {memberSearch && (
                  <div className="max-h-40 overflow-y-auto space-y-1">
                    {members.map((m) => (
                      <button
                        key={m.id}
                        type="button"
                        onClick={() => setAssignMemberId(String(m.id))}
                        className={`w-full text-left p-2 rounded-lg border transition-colors ${
                          assignMemberId === String(m.id)
                            ? "border-indigo-300 dark:border-indigo-600 bg-indigo-50 dark:bg-indigo-900/30"
                            : "border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700/50"
                        }`}
                      >
                        <span className="font-medium">{m.customer.name}</span>
                        <span className="text-sm text-gray-500 dark:text-gray-400 ml-2">
                          {m.customer.email || m.customer.phone || ""}
                        </span>
                      </button>
                    ))}
                    {members.length === 0 && (
                      <p className="text-sm text-gray-400 py-2">Sin resultados</p>
                    )}
                  </div>
                )}
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Cuota mensual (opcional)
                  </label>
                  <input
                    type="number"
                    className="input-field"
                    placeholder="0"
                    value={assignFee}
                    onChange={(e) => setAssignFee(e.target.value)}
                  />
                </div>
                <button
                  onClick={handleAssign}
                  disabled={!assignMemberId}
                  className="btn-success w-full flex items-center justify-center gap-2"
                >
                  <User className="w-4 h-4" />
                  Asignar
                </button>
              </div>
            )}

            {selectedLocker.status === "ASSIGNED" && selectedLocker.currentAssignment && (
              <div className="space-y-3">
                <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-3">
                  <p className="text-sm text-gray-600 dark:text-gray-300">
                    <span className="font-medium">Miembro:</span>{" "}
                    {selectedLocker.currentAssignment.member.customer.name}
                  </p>
                  <p className="text-sm text-gray-600 dark:text-gray-300">
                    <span className="font-medium">Desde:</span>{" "}
                    {formatDate(selectedLocker.currentAssignment.startDate)}
                  </p>
                  <p className="text-sm text-gray-600 dark:text-gray-300">
                    <span className="font-medium">Cuota mensual:</span>{" "}
                    {formatCurrency(selectedLocker.currentAssignment.monthlyFee)}
                  </p>
                </div>
                <button
                  onClick={handleRelease}
                  className="btn-danger w-full flex items-center justify-center gap-2"
                >
                  Liberar
                </button>
              </div>
            )}

            <div className="pt-3 border-t">
              <button
                onClick={toggleMaintenance}
                className={`w-full flex items-center justify-center gap-2 ${
                  selectedLocker.status === "MAINTENANCE" ? "btn-success" : "btn-secondary"
                }`}
              >
                <Wrench className="w-4 h-4" />
                {selectedLocker.status === "MAINTENANCE" ? "Finalizar mantenimiento" : "Enviar a mantenimiento"}
              </button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
