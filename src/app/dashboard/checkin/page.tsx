"use client";

import { useEffect, useState, useCallback } from "react";
import { UserCheck, LogIn, LogOut, Search, Clock } from "lucide-react";
import Toast from "@/components/ui/Toast";
import { formatDateTime } from "@/lib/utils";

interface Customer {
  id: number;
  name: string;
  email: string | null;
  phone: string | null;
}

interface Membership {
  id: number;
  status: string;
  endDate: string;
  plan: { name: string };
}

interface CheckIn {
  id: number;
  timestamp: string;
  type: string;
  method: string;
}

interface GymMember {
  id: number;
  customer: Customer;
  memberships: Membership[];
  checkIns: CheckIn[];
  photoUrl: string | null;
}

interface CheckInRecord {
  id: number;
  timestamp: string;
  type: string;
  method: string;
  member: { customer: { name: string; email: string | null } };
}

export default function CheckInPage() {
  const [search, setSearch] = useState("");
  const [members, setMembers] = useState<GymMember[]>([]);
  const [selectedMember, setSelectedMember] = useState<GymMember | null>(null);
  const [checkIns, setCheckIns] = useState<CheckInRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: "success" | "error" } | null>(null);

  const loadCheckIns = useCallback(async () => {
    const res = await fetch("/api/checkins");
    if (res.ok) setCheckIns(await res.json());
  }, []);

  const loadMembers = useCallback(async () => {
    if (!search.trim()) {
      setMembers([]);
      return;
    }
    setLoading(true);
    const res = await fetch(`/api/gym-members?search=${encodeURIComponent(search)}`);
    if (res.ok) setMembers(await res.json());
    else setMembers([]);
    setLoading(false);
  }, [search]);

  useEffect(() => {
    loadCheckIns();
  }, [loadCheckIns]);

  useEffect(() => {
    const t = setTimeout(loadMembers, 300);
    return () => clearTimeout(t);
  }, [search, loadMembers]);

  const hasActiveMembership = (m: GymMember) => {
    const now = new Date();
    return m.memberships.some(
      (ms) => ms.status === "ACTIVE" && new Date(ms.endDate) >= now
    );
  };

  const lastCheckIn = (m: GymMember) => m.checkIns[0];

  async function handleCheckIn(type: "ENTRY" | "EXIT", method: "MEMBERSHIP" | "DAY_PASS" | "MANUAL", dayPassId?: number) {
    if (!selectedMember) return;
    if (method === "DAY_PASS" && !dayPassId) {
      const res = await fetch(`/api/day-passes?memberId=${selectedMember.id}&status=ACTIVE`);
      if (!res.ok) {
        setToast({ message: "Error al buscar pases activos", type: "error" });
        return;
      }
      const passes = await res.json();
      const activePass = passes.find((p: { status: string }) => p.status === "ACTIVE") || passes[0];
      if (!activePass) {
        setToast({ message: "Cree un pase de día en Tiqueteras primero", type: "error" });
        return;
      }
      dayPassId = activePass.id;
    }
    const body: Record<string, unknown> = { memberId: selectedMember.id, type, method };
    if (dayPassId) body.dayPassId = dayPassId;
    const res = await fetch("/api/checkins", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const data = await res.json();
    if (res.ok) {
      setToast({ message: type === "ENTRY" ? "Entrada registrada" : "Salida registrada", type: "success" });
      setSelectedMember(null);
      setSearch("");
      loadCheckIns();
    } else {
      setToast({ message: data.error || "Error al registrar", type: "error" });
    }
  }

  return (
    <div className="space-y-6">
      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
      <div className="flex items-center gap-3">
        <UserCheck className="w-7 h-7 text-indigo-600" />
        <h1 className="text-2xl font-bold text-gray-900">Registro de Entrada / Salida</h1>
      </div>

      <div className="card">
        <div className="relative">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
          <input
            className="input-field pl-12 text-lg py-3"
            placeholder="Buscar miembro por nombre o email..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        {loading && <p className="text-sm text-gray-500 mt-2">Buscando...</p>}
        {search.trim() && members.length > 0 && !selectedMember && (
          <div className="mt-4 space-y-2 max-h-64 overflow-y-auto">
            {members.map((m) => (
              <button
                key={m.id}
                onClick={() => setSelectedMember(m)}
                className="w-full text-left p-4 rounded-lg border border-gray-200 hover:bg-indigo-50 hover:border-indigo-200 transition-colors"
              >
                <div className="font-medium text-gray-900">{m.customer.name}</div>
                <div className="text-sm text-gray-500">{m.customer.email || m.customer.phone || "-"}</div>
                {lastCheckIn(m) && (
                  <div className="text-xs text-gray-400 mt-1 flex items-center gap-1">
                    <Clock className="w-3 h-3" />
                    Último: {formatDateTime(lastCheckIn(m).timestamp)} ({lastCheckIn(m).type})
                  </div>
                )}
              </button>
            ))}
          </div>
        )}
      </div>

      {selectedMember && (
        <div className="card border-2 border-indigo-200 bg-indigo-50/30">
          <div className="flex gap-6 items-start">
            <div className="w-20 h-20 rounded-full bg-gray-200 flex items-center justify-center flex-shrink-0">
              {selectedMember.photoUrl ? (
                <img src={selectedMember.photoUrl} alt="" className="w-full h-full rounded-full object-cover" />
              ) : (
                <UserCheck className="w-10 h-10 text-gray-400" />
              )}
            </div>
            <div className="flex-1">
              <h2 className="text-xl font-bold text-gray-900">{selectedMember.customer.name}</h2>
              <p className="text-gray-600">{selectedMember.customer.email || selectedMember.customer.phone || "-"}</p>
              <div className="mt-2">
                {hasActiveMembership(selectedMember) ? (
                  <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-emerald-100 text-emerald-800">
                    Membresía activa
                  </span>
                ) : (
                  <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-amber-100 text-amber-800">
                    Sin membresía activa
                  </span>
                )}
              </div>
              {lastCheckIn(selectedMember) && (
                <p className="text-sm text-gray-500 mt-1">
                  Último check-in: {formatDateTime(lastCheckIn(selectedMember).timestamp)} ({lastCheckIn(selectedMember).type})
                </p>
              )}
            </div>
            <div className="flex flex-col gap-3">
              {hasActiveMembership(selectedMember) ? (
                <>
                  <button
                    onClick={() => handleCheckIn("ENTRY", "MEMBERSHIP")}
                    className="btn-success flex items-center gap-2 px-6 py-3 text-lg"
                  >
                    <LogIn className="w-5 h-5" />
                    Registrar Entrada
                  </button>
                  <button
                    onClick={() => handleCheckIn("EXIT", "MEMBERSHIP")}
                    className="btn-danger flex items-center gap-2 px-6 py-3 text-lg"
                  >
                    <LogOut className="w-5 h-5" />
                    Registrar Salida
                  </button>
                </>
              ) : (
                <>
                  <p className="text-sm text-amber-700 font-medium">Sin membresía activa</p>
                  <button
                    onClick={() => handleCheckIn("ENTRY", "DAY_PASS")}
                    className="btn-success flex items-center gap-2 px-6 py-3"
                  >
                    <LogIn className="w-5 h-5" />
                    Entrada con Pase Día
                  </button>
                  <button
                    onClick={() => handleCheckIn("ENTRY", "MANUAL")}
                    className="btn-secondary flex items-center gap-2 px-6 py-3"
                  >
                    <LogIn className="w-5 h-5" />
                    Entrada Manual
                  </button>
                  <button
                    onClick={() => handleCheckIn("EXIT", "MANUAL")}
                    className="btn-danger flex items-center gap-2 px-6 py-3"
                  >
                    <LogOut className="w-5 h-5" />
                    Registrar Salida
                  </button>
                </>
              )}
              <button onClick={() => setSelectedMember(null)} className="btn-secondary text-sm">
                Cambiar miembro
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="card">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Check-ins de hoy</h3>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr>
                <th className="table-header">Hora</th>
                <th className="table-header">Miembro</th>
                <th className="table-header">Tipo</th>
                <th className="table-header">Método</th>
              </tr>
            </thead>
            <tbody>
              {checkIns.map((c) => (
                <tr key={c.id} className="hover:bg-gray-50">
                  <td className="table-cell">{formatDateTime(c.timestamp)}</td>
                  <td className="table-cell font-medium">{c.member.customer.name}</td>
                  <td className="table-cell">
                    <span className={`inline-flex items-center gap-1 ${c.type === "ENTRY" ? "text-emerald-600" : "text-red-600"}`}>
                      {c.type === "ENTRY" ? <LogIn className="w-4 h-4" /> : <LogOut className="w-4 h-4" />}
                      {c.type === "ENTRY" ? "Entrada" : "Salida"}
                    </span>
                  </td>
                  <td className="table-cell">{c.method}</td>
                </tr>
              ))}
              {checkIns.length === 0 && (
                <tr>
                  <td colSpan={4} className="table-cell text-center text-gray-400 py-12">
                    Sin check-ins hoy
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
