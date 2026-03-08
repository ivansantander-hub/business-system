"use client";

import { useEffect, useState, useCallback } from "react";
import { Dumbbell, Calendar, Mail, User } from "lucide-react";
import Link from "next/link";

interface UserItem {
  id: number;
  name: string;
  email: string;
  role: string;
}

interface GymClass {
  id: number;
  name: string;
  dayOfWeek: number;
  startTime: string;
  endTime: string;
  room: string | null;
  trainerId: number | null;
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

  function getClassesForTrainer(trainerId: number) {
    return classes.filter((c) => c.trainerId === trainerId);
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Dumbbell className="w-7 h-7 text-indigo-600 dark:text-indigo-400" />
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Entrenadores</h1>
        </div>
      </div>

      {trainers.length === 0 ? (
        <div className="card text-center py-12">
          <p className="text-gray-400 dark:text-gray-500">No hay entrenadores registrados</p>
          <p className="text-sm text-gray-400 dark:text-gray-500 mt-1">
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
                  <div className="p-2 rounded-full bg-indigo-100 dark:bg-indigo-900/30">
                    <User className="w-6 h-6 text-indigo-600 dark:text-indigo-400" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="font-semibold text-gray-900 dark:text-white truncate">{trainer.name}</h3>
                    <div className="flex items-center gap-2 mt-1 text-sm text-gray-500 dark:text-gray-400">
                      <Mail className="w-4 h-4 flex-shrink-0" />
                      <span className="truncate">{trainer.email}</span>
                    </div>
                  </div>
                </div>
                <div className="mt-4 pt-4 border-t border-gray-100 dark:border-gray-700">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Clases que imparte</span>
                    <Link
                      href="/dashboard/clases"
                      className="text-xs text-indigo-600 dark:text-indigo-400 hover:text-indigo-700 dark:hover:text-indigo-300 font-medium"
                    >
                      Ver horario
                    </Link>
                  </div>
                  {trainerClasses.length === 0 ? (
                    <p className="text-sm text-gray-400 dark:text-gray-500">Sin clases asignadas</p>
                  ) : (
                    <ul className="space-y-1.5">
                      {trainerClasses.slice(0, 5).map((c) => (
                        <li
                          key={c.id}
                          className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-300"
                        >
                          <Calendar className="w-3.5 h-3.5 text-gray-400 dark:text-gray-500 flex-shrink-0" />
                          <span>
                            {c.name} • {DAY_LABELS[c.dayOfWeek] ?? c.dayOfWeek} {c.startTime}
                            {c.room && ` • ${c.room}`}
                          </span>
                        </li>
                      ))}
                      {trainerClasses.length > 5 && (
                        <li className="text-xs text-gray-400 dark:text-gray-500">
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
