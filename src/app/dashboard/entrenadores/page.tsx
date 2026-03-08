"use client";

import { useEffect, useState, useCallback } from "react";
import { Dumbbell, Calendar, Mail, User } from "lucide-react";
import Link from "next/link";

interface UserItem {
  id: string;
  name: string;
  email: string;
  role: string;
}

interface GymClass {
  id: string;
  name: string;
  dayOfWeek: number;
  startTime: string;
  endTime: string;
  room: string | null;
  trainerId: string | null;
}

const DAY_LABELS: Record<number, string> = {
  0: "Domingo",
  1: "Lunes",
  2: "Martes",
  3: "Miércoles",
  4: "Jueves",
  5: "Viernes",
  6: "Sábado",
};

export default function EntrenadoresPage() {
  const [users, setUsers] = useState<UserItem[]>([]);
  const [classes, setClasses] = useState<GymClass[]>([]);

  const loadUsers = useCallback(async () => {
    const res = await fetch("/api/users");
    if (res.ok) {
      const data = await res.json();
      setUsers(Array.isArray(data) ? data : []);
    }
  }, []);

  const loadClasses = useCallback(async () => {
    const res = await fetch("/api/gym-classes");
    if (res.ok) {
      const data = await res.json();
      setClasses(Array.isArray(data) ? data : []);
    }
  }, []);

  useEffect(() => {
    loadUsers();
    loadClasses();
  }, [loadUsers, loadClasses]);

  const trainers = users.filter((u) => u.role === "TRAINER");

  function getClassesForTrainer(trainerId: string) {
    return classes.filter((c) => c.trainerId === trainerId);
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="page-header">
          <div className="page-icon"><Dumbbell className="w-full h-full" /></div>
          <h1 className="page-title">Entrenadores</h1>
        </div>
      </div>

      {trainers.length === 0 ? (
        <div className="card text-center py-12">
          <p className="text-slate-400 dark:text-slate-500">No hay entrenadores registrados</p>
          <p className="text-sm text-slate-400 dark:text-slate-500 mt-1">
            Los entrenadores son usuarios con rol TRAINER asignado en la empresa
          </p>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {trainers.map((trainer) => {
            const trainerClasses = getClassesForTrainer(trainer.id);
            return (
              <div key={trainer.id} className="card">
                <div className="flex items-start gap-3">
                  <div className="p-2 rounded-full bg-violet-100 dark:bg-violet-500/10">
                    <User className="w-6 h-6 text-violet-600 dark:text-violet-400" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="font-semibold text-slate-900 dark:text-white truncate">{trainer.name}</h3>
                    <div className="flex items-center gap-2 mt-1 text-sm text-slate-500 dark:text-slate-400">
                      <Mail className="w-4 h-4 flex-shrink-0" />
                      <span className="truncate">{trainer.email}</span>
                    </div>
                  </div>
                </div>
                <div className="mt-4 pt-4 border-t border-slate-100 dark:border-slate-800">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-medium text-slate-700 dark:text-slate-300">Clases que imparte</span>
                    <Link
                      href="/dashboard/clases"
                      className="text-xs text-violet-600 dark:text-violet-400 hover:text-violet-700 dark:hover:text-violet-300 font-medium"
                    >
                      Ver horario
                    </Link>
                  </div>
                  {trainerClasses.length === 0 ? (
                    <p className="text-sm text-slate-400 dark:text-slate-500">Sin clases asignadas</p>
                  ) : (
                    <ul className="space-y-1.5">
                      {trainerClasses.slice(0, 5).map((c) => (
                        <li
                          key={c.id}
                          className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-300"
                        >
                          <Calendar className="w-3.5 h-3.5 text-slate-400 dark:text-slate-500 flex-shrink-0" />
                          <span>
                            {c.name} • {DAY_LABELS[c.dayOfWeek] ?? c.dayOfWeek} {c.startTime}
                            {c.room && ` • ${c.room}`}
                          </span>
                        </li>
                      ))}
                      {trainerClasses.length > 5 && (
                        <li className="text-xs text-slate-400 dark:text-slate-500">
                          +{trainerClasses.length - 5} más
                        </li>
                      )}
                    </ul>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
