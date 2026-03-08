"use client";

import { useEffect, useState, useCallback } from "react";
import { Calendar, Plus, Users, Search, UserPlus, Check, X } from "lucide-react";
import Modal from "@/components/ui/Modal";
import Toast from "@/components/ui/Toast";

const DAYS = [
  { label: "Lunes", dayOfWeek: 1 },
  { label: "Martes", dayOfWeek: 2 },
  { label: "Miércoles", dayOfWeek: 3 },
  { label: "Jueves", dayOfWeek: 4 },
  { label: "Viernes", dayOfWeek: 5 },
  { label: "Sábado", dayOfWeek: 6 },
  { label: "Domingo", dayOfWeek: 0 },
];

function getDateForDayOfWeek(dayOfWeek: number): string {
  const now = new Date();
  const today = now.getDay();
  const diffToMonday = today === 0 ? -6 : 1 - today;
  const monday = new Date(now);
  monday.setDate(now.getDate() + diffToMonday);
  const dayOffset = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
  const d = new Date(monday);
  d.setDate(monday.getDate() + dayOffset);
  return d.toISOString().split("T")[0];
}

interface GymClass {
  id: string;
  name: string;
  description: string | null;
  dayOfWeek: number;
  startTime: string;
  endTime: string;
  maxCapacity: number;
  room: string | null;
  trainer: { id: string; name: string } | null;
  _count: { enrollments: number };
  enrollmentCountForDate?: number;
  enrollmentsForDate?: { id: string; status: string; member: { customer: { name: string; email: string } } }[];
}

interface User {
  id: string;
  name: string;
  email: string;
  role: string;
}

interface GymMember {
  id: string;
  customer: { name: string; email: string };
}

const emptyClassForm = {
  name: "",
  description: "",
  trainerId: "",
  dayOfWeek: "1",
  startTime: "09:00",
  endTime: "10:00",
  maxCapacity: "20",
  room: "",
};

export default function ClasesPage() {
  const [classes, setClasses] = useState<GymClass[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [members, setMembers] = useState<GymMember[]>([]);
  const [selectedDay, setSelectedDay] = useState(1);
  const [showNewClassModal, setShowNewClassModal] = useState(false);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [showEnrollModal, setShowEnrollModal] = useState(false);
  const [selectedClass, setSelectedClass] = useState<GymClass | null>(null);
  const [classForm, setClassForm] = useState(emptyClassForm);
  const [memberSearch, setMemberSearch] = useState("");
  const [toast, setToast] = useState<{ message: string; type: "success" | "error" } | null>(null);

  const dateStr = getDateForDayOfWeek(selectedDay);

  const loadClasses = useCallback(async () => {
    const res = await fetch(`/api/gym-classes?dayOfWeek=${selectedDay}&date=${dateStr}`);
    const data = res.ok ? await res.json() : [];
    setClasses(data);
    return data;
  }, [selectedDay, dateStr]);

  useEffect(() => {
    loadClasses();
  }, [loadClasses]);

  const loadUsers = useCallback(async () => {
    const res = await fetch("/api/users");
    if (res.ok) {
      const data = await res.json();
      setUsers(Array.isArray(data) ? data : []);
    }
  }, []);

  const loadMembers = useCallback(async () => {
    const params = memberSearch ? `?search=${encodeURIComponent(memberSearch)}` : "";
    const res = await fetch(`/api/gym-members${params}`);
    setMembers(res.ok ? await res.json() : []);
  }, [memberSearch]);

  useEffect(() => {
    loadUsers();
  }, [loadUsers]);

  useEffect(() => {
    if (showEnrollModal) loadMembers();
  }, [showEnrollModal, memberSearch, loadMembers]);

  const trainers = users.filter((u) => u.role === "TRAINER");

  async function handleCreateClass(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const res = await fetch("/api/gym-classes", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: classForm.name,
        description: classForm.description || undefined,
        trainerId: classForm.trainerId || undefined,
        dayOfWeek: Number(classForm.dayOfWeek),
        startTime: classForm.startTime,
        endTime: classForm.endTime,
        maxCapacity: Number(classForm.maxCapacity) || 20,
        room: classForm.room || undefined,
      }),
    });
    if (res.ok) {
      setShowNewClassModal(false);
      setClassForm(emptyClassForm);
      loadClasses();
      setToast({ message: "Clase creada", type: "success" });
    } else {
      const data = await res.json();
      setToast({ message: data.error || "Error", type: "error" });
    }
  }

  function openClassDetail(c: GymClass) {
    setSelectedClass(c);
    setShowDetailModal(true);
  }

  async function handleEnroll(memberId: string) {
    if (!selectedClass) return;
    const res = await fetch("/api/gym-classes", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "enroll",
        classId: selectedClass.id,
        memberId,
        date: dateStr,
      }),
    });
    if (res.ok) {
      setShowEnrollModal(false);
      setMemberSearch("");
      const updated = await loadClasses();
      const refreshed = updated.find((c: GymClass) => c.id === selectedClass.id);
      if (refreshed) setSelectedClass(refreshed);
      setToast({ message: "Inscrito correctamente", type: "success" });
    } else {
      const data = await res.json();
      setToast({ message: data.error || "Error", type: "error" });
    }
  }

  async function handleAttendance(enrollmentId: string, status: "ATTENDED" | "ABSENT") {
    const res = await fetch("/api/gym-classes", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "attendance", enrollmentId, status }),
    });
    if (res.ok) {
      const updated = await loadClasses();
      if (selectedClass) {
        const refreshed = updated.find((c: GymClass) => c.id === selectedClass.id);
        if (refreshed) setSelectedClass(refreshed);
      }
      setToast({ message: "Asistencia actualizada", type: "success" });
    }
  }

  const displayClasses = classes;
  const enrollments = selectedClass?.enrollmentsForDate ?? [];

  return (
    <div className="space-y-6">
      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
      <div className="flex items-center justify-between">
        <div className="page-header">
          <div className="page-icon"><Calendar className="w-full h-full" /></div>
          <h1 className="page-title">Clases</h1>
        </div>
        <button
          onClick={() => {
            setClassForm({ ...emptyClassForm, dayOfWeek: String(selectedDay) });
            setShowNewClassModal(true);
          }}
          className="btn-primary flex items-center gap-2"
        >
          <Plus className="w-4 h-4" /> Nueva Clase
        </button>
      </div>

      <div className="flex gap-2 overflow-x-auto pb-2">
        {DAYS.map((d) => (
          <button
            key={d.dayOfWeek}
            onClick={() => setSelectedDay(d.dayOfWeek)}
            className={`px-4 py-2 rounded-lg font-medium whitespace-nowrap transition-colors ${
              selectedDay === d.dayOfWeek ? "btn-primary" : "btn-secondary"
            }`}
          >
            {d.label}
          </button>
        ))}
      </div>

      <div className="card">
        <div className="space-y-3">
          {displayClasses.length === 0 ? (
            <p className="text-center text-slate-400 py-12">No hay clases para este día</p>
          ) : (
            displayClasses.map((c) => (
              <div
                key={c.id}
                role="button"
                tabIndex={0}
                onClick={() => openClassDetail(c)}
                onKeyDown={(e) => e.key === "Enter" && openClassDetail(c)}
                className="flex items-center justify-between p-4 rounded-lg border border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-white/[0.03] cursor-pointer transition-colors"
              >
                <div className="flex items-center gap-4">
                  <div className="text-sm font-mono text-slate-500 dark:text-slate-400">
                    {c.startTime} - {c.endTime}
                  </div>
                  <div>
                    <div className="font-semibold text-slate-900 dark:text-white">{c.name}</div>
                    <div className="text-sm text-slate-500 dark:text-slate-400">
                      {c.trainer?.name || "Sin entrenador"} {c.room && `• ${c.room}`}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Users className="w-4 h-4 text-slate-400 dark:text-slate-500" />
                  <span className="text-sm font-medium">
                    {(c.enrollmentCountForDate ?? c._count?.enrollments ?? 0)}/{c.maxCapacity}
                  </span>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      <Modal
        open={showNewClassModal}
        onClose={() => setShowNewClassModal(false)}
        title="Nueva Clase"
        size="lg"
      >
        <form onSubmit={handleCreateClass} className="space-y-4">
          <div>
            <label htmlFor="class-name" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Nombre *</label>
            <input
              id="class-name"
              className="input-field"
              value={classForm.name}
              onChange={(e) => setClassForm({ ...classForm, name: e.target.value })}
              required
            />
          </div>
          <div>
            <label htmlFor="class-desc" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Descripción</label>
            <input
              id="class-desc"
              className="input-field"
              value={classForm.description}
              onChange={(e) => setClassForm({ ...classForm, description: e.target.value })}
            />
          </div>
          <div>
            <label htmlFor="class-trainer" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Entrenador</label>
            <select
              id="class-trainer"
              className="input-field"
              value={classForm.trainerId}
              onChange={(e) => setClassForm({ ...classForm, trainerId: e.target.value })}
            >
              <option value="">Sin asignar</option>
              {trainers.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.name} ({u.email})
                </option>
              ))}
              {trainers.length === 0 && (
                <option value="" disabled>
                  No hay entrenadores
                </option>
              )}
            </select>
          </div>
          <div>
            <label htmlFor="class-day" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Día de la semana</label>
            <select
              id="class-day"
              className="input-field"
              value={classForm.dayOfWeek}
              onChange={(e) => setClassForm({ ...classForm, dayOfWeek: e.target.value })}
            >
              {DAYS.map((d) => (
                <option key={d.dayOfWeek} value={d.dayOfWeek}>
                  {d.label}
                </option>
              ))}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label htmlFor="class-start" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Hora inicio</label>
              <input
                id="class-start"
                type="time"
                className="input-field"
                value={classForm.startTime}
                onChange={(e) => setClassForm({ ...classForm, startTime: e.target.value })}
              />
            </div>
            <div>
              <label htmlFor="class-end" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Hora fin</label>
              <input
                id="class-end"
                type="time"
                className="input-field"
                value={classForm.endTime}
                onChange={(e) => setClassForm({ ...classForm, endTime: e.target.value })}
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label htmlFor="class-capacity" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Capacidad máxima</label>
              <input
                id="class-capacity"
                type="number"
                min="1"
                className="input-field"
                value={classForm.maxCapacity}
                onChange={(e) => setClassForm({ ...classForm, maxCapacity: e.target.value })}
              />
            </div>
            <div>
              <label htmlFor="class-room" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Sala</label>
              <input
                id="class-room"
                className="input-field"
                value={classForm.room}
                onChange={(e) => setClassForm({ ...classForm, room: e.target.value })}
              />
            </div>
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <button type="button" onClick={() => setShowNewClassModal(false)} className="btn-secondary">
              Cancelar
            </button>
            <button type="submit" className="btn-primary">
              Crear Clase
            </button>
          </div>
        </form>
      </Modal>

      <Modal
        open={showDetailModal}
        onClose={() => {
          setShowDetailModal(false);
          setSelectedClass(null);
        }}
        title={selectedClass ? selectedClass.name : ""}
        size="lg"
      >
        {selectedClass && (
          <div className="space-y-4">
            <div className="flex items-center justify-between text-sm text-slate-500 dark:text-slate-400">
              <span>
                {selectedClass.startTime} - {selectedClass.endTime} • {selectedClass.trainer?.name || "Sin entrenador"}{" "}
                {selectedClass.room && `• ${selectedClass.room}`}
              </span>
              <span>
                {enrollments.length}/{selectedClass.maxCapacity}
              </span>
            </div>
            <div className="flex justify-end">
              <button
                onClick={() => setShowEnrollModal(true)}
                className="btn-primary flex items-center gap-2"
              >
                <UserPlus className="w-4 h-4" /> Inscribir miembro
              </button>
            </div>
            <div>
              <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2">Inscritos</h3>
              {enrollments.length === 0 ? (
                <p className="text-sm text-slate-400">Sin inscritos para esta fecha</p>
              ) : (
                <div className="space-y-2">
                  {enrollments.map((e) => (
                    <div
                      key={e.id}
                      className="flex items-center justify-between p-3 rounded-lg bg-slate-50 dark:bg-white/[0.03]"
                    >
                      <span className="font-medium">{e.member.customer.name}</span>
                      <div className="flex gap-2">
                        <button
                          onClick={() => handleAttendance(e.id, "ATTENDED")}
                          className={`p-1.5 rounded-lg transition-colors ${
                            e.status === "ATTENDED" ? "btn-success" : "bg-slate-200 dark:bg-slate-700 hover:bg-emerald-100 dark:hover:bg-emerald-900/30"
                          }`}
                          title="Asistió"
                        >
                          <Check className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleAttendance(e.id, "ABSENT")}
                          className={`p-1.5 rounded-lg transition-colors ${
                            e.status === "ABSENT" ? "btn-danger" : "bg-slate-200 hover:bg-red-100"
                          }`}
                          title="Ausente"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </Modal>

      <Modal
        open={showEnrollModal}
        onClose={() => {
          setShowEnrollModal(false);
          setMemberSearch("");
        }}
        title="Inscribir miembro"
      >
        <div className="space-y-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 dark:text-slate-500" />
            <input
              className="input-field pl-9"
              placeholder="Buscar por nombre o email..."
              value={memberSearch}
              onChange={(e) => setMemberSearch(e.target.value)}
            />
          </div>
          <div className="max-h-60 overflow-y-auto space-y-2">
            {members.map((m) => (
              <div
                key={m.id}
                className="flex items-center justify-between p-3 rounded-lg border border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-white/[0.03]"
              >
                <div>
                  <div className="font-medium">{m.customer.name}</div>
                  <div className="text-sm text-slate-500">{m.customer.email}</div>
                </div>
                <button
                  onClick={() => handleEnroll(m.id)}
                  className="btn-primary text-sm py-1.5 px-3"
                >
                  Inscribir
                </button>
              </div>
            ))}
            {members.length === 0 && (
              <p className="text-center text-slate-400 dark:text-slate-500 py-4">Sin resultados</p>
            )}
          </div>
        </div>
      </Modal>
    </div>
  );
}
