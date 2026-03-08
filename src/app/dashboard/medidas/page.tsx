"use client";

import { useEffect, useState, useCallback } from "react";
import { Ruler, Search, Plus, ArrowDown, ArrowUp } from "lucide-react";
import Modal from "@/components/ui/Modal";
import Toast from "@/components/ui/Toast";
import { formatDate } from "@/lib/utils";

interface Customer {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
}

interface GymMember {
  id: string;
  customer: Customer;
  birthDate: string | null;
  gender: string | null;
}

interface BodyMeasurement {
  id: string;
  date: string;
  weight: string | null;
  height: string | null;
  bodyFat: string | null;
  chest: string | null;
  waist: string | null;
  hips: string | null;
  leftArm: string | null;
  rightArm: string | null;
  leftThigh: string | null;
  rightThigh: string | null;
  notes: string | null;
}

const measurementFields = [
  { key: "weight", label: "Peso (kg)", type: "number" },
  { key: "height", label: "Estatura (cm)", type: "number" },
  { key: "bodyFat", label: "Grasa corporal (%)", type: "number" },
  { key: "chest", label: "Pecho (cm)", type: "number" },
  { key: "waist", label: "Cintura (cm)", type: "number" },
  { key: "hips", label: "Cadera (cm)", type: "number" },
  { key: "leftArm", label: "Brazo izquierdo (cm)", type: "number" },
  { key: "rightArm", label: "Brazo derecho (cm)", type: "number" },
  { key: "leftThigh", label: "Muslo izquierdo (cm)", type: "number" },
  { key: "rightThigh", label: "Muslo derecho (cm)", type: "number" },
  { key: "notes", label: "Notas", type: "text" },
] as const;

function getAge(birthDate: string | null): number | null {
  if (!birthDate) return null;
  const today = new Date();
  const birth = new Date(birthDate);
  let age = today.getFullYear() - birth.getFullYear();
  const m = today.getMonth() - birth.getMonth();
  if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) age--;
  return age;
}

function MetricChange({
  label,
  prev,
  curr,
  lowerIsBetter,
}: {
  label: string;
  prev: number;
  curr: number;
  lowerIsBetter: boolean;
}) {
  const diff = curr - prev;
  if (diff === 0) return <span className="text-slate-500 dark:text-slate-400">—</span>;
  const improved = lowerIsBetter ? diff < 0 : diff > 0;
  const Icon = diff < 0 ? ArrowDown : ArrowUp;
  return (
    <div className={`flex items-center gap-1 ${improved ? "text-emerald-600 dark:text-emerald-400" : "text-red-600 dark:text-red-400"}`}>
      <Icon className="w-4 h-4" />
      <span>
        {diff > 0 ? "+" : ""}
        {diff.toFixed(1)}
      </span>
    </div>
  );
}

export default function MedidasPage() {
  const [search, setSearch] = useState("");
  const [members, setMembers] = useState<GymMember[]>([]);
  const [selectedMember, setSelectedMember] = useState<GymMember | null>(null);
  const [measurements, setMeasurements] = useState<BodyMeasurement[]>([]);
  const [loading, setLoading] = useState(false);
  const [showNewModal, setShowNewModal] = useState(false);
  const [form, setForm] = useState<Record<string, string>>({});
  const [toast, setToast] = useState<{ message: string; type: "success" | "error" } | null>(null);

  const loadMeasurements = useCallback(async (memberId: string) => {
    const res = await fetch(`/api/body-measurements?memberId=${memberId}`);
    if (res.ok) setMeasurements(await res.json());
    else setMeasurements([]);
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
    const t = setTimeout(loadMembers, 300);
    return () => clearTimeout(t);
  }, [search, loadMembers]);

  useEffect(() => {
    if (selectedMember) loadMeasurements(selectedMember.id);
  }, [selectedMember, loadMeasurements]);

  async function handleSubmitMeasurement(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedMember) return;
    const body: Record<string, unknown> = { memberId: selectedMember.id };
    measurementFields.forEach(({ key }) => {
      const v = form[key];
      if (key === "notes") body[key] = v || undefined;
      else if (v !== undefined && v !== "") body[key] = v;
    });
    const res = await fetch("/api/body-measurements", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const data = await res.json();
    if (res.ok) {
      setShowNewModal(false);
      setForm({});
      loadMeasurements(selectedMember.id);
      setToast({ message: "Medición registrada", type: "success" });
    } else {
      setToast({ message: data.error || "Error al guardar", type: "error" });
    }
  }

  const lastTwo = measurements.slice(0, 2);
  const [latest, previous] = lastTwo;

  return (
    <div className="space-y-6">
      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}

      <div className="page-header">
        <div className="page-icon"><Ruler className="w-full h-full" /></div>
        <h1 className="page-title">Medidas Corporales</h1>
      </div>

      <div className="card">
        <div className="relative">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400 dark:text-slate-500" />
          <input
            className="input-field pl-12 text-lg py-3"
            placeholder="Buscar miembro por nombre, email o teléfono..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        {loading && <p className="text-sm text-slate-500 dark:text-slate-400 mt-2">Buscando...</p>}
        {search.trim() && members.length > 0 && !selectedMember && (
          <div className="mt-4 space-y-2 max-h-64 overflow-y-auto">
            {members.map((m) => (
              <button
                key={m.id}
                onClick={() => setSelectedMember(m)}
                className="w-full text-left p-4 rounded-lg border border-slate-200 dark:border-slate-800 hover:bg-violet-50 dark:hover:bg-violet-500/10 hover:border-violet-200 dark:hover:border-violet-700 transition-colors"
              >
                <div className="font-medium text-slate-900 dark:text-white">{m.customer.name}</div>
                <div className="text-sm text-slate-500 dark:text-slate-400">{m.customer.email || m.customer.phone || "-"}</div>
              </button>
            ))}
          </div>
        )}
      </div>

      {selectedMember && (
        <>
          <div className="card border-2 border-violet-200 dark:border-violet-700 bg-violet-50/30 dark:bg-violet-500/10">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-xl font-bold text-slate-900 dark:text-white">{selectedMember.customer.name}</h2>
                <div className="flex gap-4 mt-1 text-sm text-slate-600 dark:text-slate-300">
                  {selectedMember.birthDate && (
                    <span>Edad: {getAge(selectedMember.birthDate) ?? "-"} años</span>
                  )}
                  {selectedMember.gender && <span>Género: {selectedMember.gender}</span>}
                </div>
              </div>
              <div className="flex gap-3">
                <button
                  onClick={() => {
                    setForm({});
                    setShowNewModal(true);
                  }}
                  className="btn-primary flex items-center gap-2"
                >
                  <Plus className="w-4 h-4" />
                  Nueva Medición
                </button>
                <button onClick={() => setSelectedMember(null)} className="btn-secondary">
                  Cambiar miembro
                </button>
              </div>
            </div>
          </div>

          {lastTwo.length >= 2 && (
            <div className="card">
              <h3 className="text-lg font-semibold text-slate-900 mb-4">Progreso (últimas 2 mediciones)</h3>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="p-3 bg-slate-50 rounded-lg">
                  <p className="text-xs text-slate-500 mb-1">Peso</p>
                  <MetricChange
                    label="Peso"
                    prev={Number(previous.weight ?? 0)}
                    curr={Number(latest.weight ?? 0)}
                    lowerIsBetter
                  />
                </div>
                <div className="p-3 bg-slate-50 rounded-lg">
                  <p className="text-xs text-slate-500 mb-1">Grasa %</p>
                  <MetricChange
                    label="Grasa"
                    prev={Number(previous.bodyFat ?? 0)}
                    curr={Number(latest.bodyFat ?? 0)}
                    lowerIsBetter
                  />
                </div>
                <div className="p-3 bg-slate-50 rounded-lg">
                  <p className="text-xs text-slate-500 mb-1">Cintura</p>
                  <MetricChange
                    label="Cintura"
                    prev={Number(previous.waist ?? 0)}
                    curr={Number(latest.waist ?? 0)}
                    lowerIsBetter
                  />
                </div>
                <div className="p-3 bg-slate-50 rounded-lg">
                  <p className="text-xs text-slate-500 mb-1">Pecho</p>
                  <MetricChange
                    label="Pecho"
                    prev={Number(previous.chest ?? 0)}
                    curr={Number(latest.chest ?? 0)}
                    lowerIsBetter={false}
                  />
                </div>
              </div>
            </div>
          )}

          <div className="card">
            <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-4">Historial de mediciones</h3>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr>
                    <th className="table-header">Fecha</th>
                    <th className="table-header">Peso</th>
                    <th className="table-header">Grasa %</th>
                    <th className="table-header">Cintura</th>
                    <th className="table-header">Pecho</th>
                  </tr>
                </thead>
                <tbody>
                  {measurements.map((m) => (
                    <tr key={m.id} className="hover:bg-slate-50 dark:hover:bg-white/[0.03]">
                      <td className="table-cell font-medium">{formatDate(m.date)}</td>
                      <td className="table-cell">{m.weight ?? "-"}</td>
                      <td className="table-cell">{m.bodyFat ?? "-"}</td>
                      <td className="table-cell">{m.waist ?? "-"}</td>
                      <td className="table-cell">{m.chest ?? "-"}</td>
                    </tr>
                  ))}
                  {measurements.length === 0 && (
                    <tr>
                      <td colSpan={5} className="table-cell text-center text-slate-400 dark:text-slate-500 py-12">
                        Sin mediciones registradas
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      <Modal open={showNewModal} onClose={() => setShowNewModal(false)} title="Nueva Medición" size="lg">
        <form onSubmit={handleSubmitMeasurement} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            {measurementFields.map(({ key, label, type }) => (
              <div key={key}>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">{label}</label>
                <input
                  type={type}
                  step={type === "number" ? "0.1" : undefined}
                  className="input-field"
                  value={form[key] ?? ""}
                  onChange={(e) => setForm({ ...form, [key]: e.target.value })}
                />
              </div>
            ))}
          </div>
          <div className="flex justify-end gap-3">
            <button type="button" onClick={() => setShowNewModal(false)} className="btn-secondary">
              Cancelar
            </button>
            <button type="submit" className="btn-primary">
              Guardar medición
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
