"use client";

import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/atoms";
import { Bell, Users, Shield, ToggleLeft, ToggleRight, ChevronDown, ChevronRight } from "lucide-react";

interface NotifTemplate {
  eventType: string;
  label: string;
  enabled: boolean;
}

interface UserPref {
  userId: string;
  userName: string;
  eventType: string;
  enabled: boolean;
}

interface RoleGroup {
  role: string;
  users: {
    userId: string;
    userName: string;
    preferences: { eventType: string; label: string; enabled: boolean }[];
  }[];
}

const ROLE_LABELS: Record<string, string> = {
  ADMIN: "Administrador",
  CASHIER: "Cajero",
  WAITER: "Mesero",
  ACCOUNTANT: "Contador",
  TRAINER: "Entrenador",
};

type Tab = "company" | "users" | "roles";

export default function NotificacionesPage() {
  const [tab, setTab] = useState<Tab>("company");
  const [templates, setTemplates] = useState<NotifTemplate[]>([]);
  const [userPrefs, setUserPrefs] = useState<UserPref[]>([]);
  const [roleGroups, setRoleGroups] = useState<RoleGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);
  const [expandedRoles, setExpandedRoles] = useState<Set<string>>(new Set());

  const fetchCompanyTemplates = useCallback(async () => {
    const res = await fetch("/api/notifications");
    if (res.ok) setTemplates(await res.json());
  }, []);

  const fetchUserPrefs = useCallback(async () => {
    const res = await fetch("/api/notifications/users");
    if (res.ok) setUserPrefs(await res.json());
  }, []);

  const fetchRoleGroups = useCallback(async () => {
    const res = await fetch("/api/notifications/roles");
    if (res.ok) setRoleGroups(await res.json());
  }, []);

  useEffect(() => {
    setLoading(true);
    Promise.all([fetchCompanyTemplates(), fetchUserPrefs(), fetchRoleGroups()])
      .finally(() => setLoading(false));
  }, [fetchCompanyTemplates, fetchUserPrefs, fetchRoleGroups]);

  const toggleCompany = async (eventType: string, enabled: boolean) => {
    setSaving(eventType);
    await fetch("/api/notifications", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ eventType, enabled }),
    });
    setTemplates((prev) => prev.map((t) => t.eventType === eventType ? { ...t, enabled } : t));
    setSaving(null);
  };

  const toggleUser = async (userId: string, eventType: string, enabled: boolean) => {
    const key = `${userId}-${eventType}`;
    setSaving(key);
    await fetch("/api/notifications/users", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId, eventType, enabled }),
    });
    setUserPrefs((prev) => {
      const idx = prev.findIndex((p) => p.userId === userId && p.eventType === eventType);
      if (idx >= 0) {
        const copy = [...prev];
        copy[idx] = { ...copy[idx], enabled };
        return copy;
      }
      return [...prev, { userId, userName: "", eventType, enabled }];
    });
    setSaving(null);
  };

  const toggleRole = async (role: string, eventType: string, enabled: boolean) => {
    const key = `role-${role}-${eventType}`;
    setSaving(key);
    await fetch("/api/notifications/roles", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ role, eventType, enabled }),
    });
    await fetchRoleGroups();
    setSaving(null);
  };

  const toggleRoleExpand = (role: string) => {
    setExpandedRoles((prev) => {
      const next = new Set(prev);
      if (next.has(role)) next.delete(role); else next.add(role);
      return next;
    });
  };

  const tabs: { key: Tab; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
    { key: "company", label: "Empresa", icon: Bell },
    { key: "users", label: "Usuarios", icon: Users },
    { key: "roles", label: "Roles", icon: Shield },
  ];

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-500" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Notificaciones</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            Gestiona las notificaciones por email de tu empresa
          </p>
        </div>
      </div>

      <div className="flex gap-1 p-1 bg-gray-100 dark:bg-gray-800 rounded-xl w-fit">
        {tabs.map(({ key, label, icon: Icon }) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
              tab === key
                ? "bg-white dark:bg-gray-700 text-primary-600 dark:text-primary-400 shadow-sm"
                : "text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200"
            }`}
          >
            <Icon className="w-4 h-4" />
            <span className="hidden sm:inline">{label}</span>
          </button>
        ))}
      </div>

      {tab === "company" && (
        <div className="card">
          <div className="p-4 border-b border-gray-200 dark:border-gray-700">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Notificaciones de empresa</h2>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
              Activa o desactiva tipos de notificación para toda la empresa
            </p>
          </div>
          <div className="divide-y divide-gray-200 dark:divide-gray-700">
            {templates.map((t) => (
              <div key={t.eventType} className="flex items-center justify-between p-4 hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors">
                <div>
                  <p className="font-medium text-gray-900 dark:text-white">{t.label}</p>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{t.eventType}</p>
                </div>
                <button
                  onClick={() => toggleCompany(t.eventType, !t.enabled)}
                  disabled={saving === t.eventType}
                  className="relative flex-shrink-0"
                  aria-label={t.enabled ? "Desactivar" : "Activar"}
                >
                  {t.enabled ? (
                    <ToggleRight className="w-10 h-10 text-primary-500" />
                  ) : (
                    <ToggleLeft className="w-10 h-10 text-gray-300 dark:text-gray-600" />
                  )}
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {tab === "roles" && (
        <div className="space-y-4">
          {roleGroups.map((group) => (
            <div key={group.role} className="card overflow-hidden">
              <button
                onClick={() => toggleRoleExpand(group.role)}
                className="w-full flex items-center justify-between p-4 hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <Shield className="w-5 h-5 text-primary-500" />
                  <div className="text-left">
                    <p className="font-semibold text-gray-900 dark:text-white">
                      {ROLE_LABELS[group.role] || group.role}
                    </p>
                    <p className="text-xs text-gray-500 dark:text-gray-400">
                      {group.users.length} usuario{group.users.length !== 1 && "s"}
                    </p>
                  </div>
                </div>
                {expandedRoles.has(group.role) ? (
                  <ChevronDown className="w-5 h-5 text-gray-400" />
                ) : (
                  <ChevronRight className="w-5 h-5 text-gray-400" />
                )}
              </button>

              {expandedRoles.has(group.role) && (
                <div className="border-t border-gray-200 dark:border-gray-700">
                  <div className="p-4 bg-gray-50/50 dark:bg-gray-800/30">
                    <p className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-3">Aplicar a todo el rol</p>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      {templates.map((t) => {
                        const allEnabled = group.users.every((u) => {
                          const pref = u.preferences.find((p) => p.eventType === t.eventType);
                          return pref ? pref.enabled : true;
                        });
                        const key = `role-${group.role}-${t.eventType}`;
                        return (
                          <div key={t.eventType} className="flex items-center justify-between p-2 rounded-lg bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700">
                            <span className="text-sm text-gray-700 dark:text-gray-300">{t.label}</span>
                            <button
                              onClick={() => toggleRole(group.role, t.eventType, !allEnabled)}
                              disabled={saving === key}
                              className="flex-shrink-0"
                            >
                              {allEnabled ? (
                                <ToggleRight className="w-8 h-8 text-primary-500" />
                              ) : (
                                <ToggleLeft className="w-8 h-8 text-gray-300 dark:text-gray-600" />
                              )}
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
              )}
            </div>
          ))}
          {roleGroups.length === 0 && (
            <div className="card p-8 text-center text-gray-500 dark:text-gray-400">
              No hay roles con usuarios asignados
            </div>
          )}
        </div>
      )}

      {tab === "users" && (
        <div className="card">
          <div className="p-4 border-b border-gray-200 dark:border-gray-700">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Preferencias por usuario</h2>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
              Sobreescribe la configuración de empresa para usuarios específicos
            </p>
          </div>

          {(() => {
            const userMap = new Map<string, { name: string; prefs: Map<string, boolean> }>();
            for (const p of userPrefs) {
              if (!userMap.has(p.userId)) userMap.set(p.userId, { name: p.userName, prefs: new Map() });
              userMap.get(p.userId)!.prefs.set(p.eventType, p.enabled);
            }

            if (userMap.size === 0) {
              return (
                <div className="p-8 text-center text-gray-500 dark:text-gray-400">
                  No hay preferencias de usuario configuradas. Las preferencias se crean automáticamente al gestionar por roles.
                </div>
              );
            }

            return (
              <div className="divide-y divide-gray-200 dark:divide-gray-700">
                {Array.from(userMap.entries()).map(([userId, { name, prefs }]) => (
                  <div key={userId} className="p-4">
                    <p className="font-medium text-gray-900 dark:text-white mb-3">{name || userId}</p>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      {templates.map((t) => {
                        const enabled = prefs.get(t.eventType) ?? true;
                        const key = `${userId}-${t.eventType}`;
                        return (
                          <div key={t.eventType} className="flex items-center justify-between p-2 rounded-lg bg-gray-50 dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700">
                            <span className="text-sm text-gray-700 dark:text-gray-300">{t.label}</span>
                            <button
                              onClick={() => toggleUser(userId, t.eventType, !enabled)}
                              disabled={saving === key}
                              className="flex-shrink-0"
                            >
                              {enabled ? (
                                <ToggleRight className="w-8 h-8 text-primary-500" />
                              ) : (
                                <ToggleLeft className="w-8 h-8 text-gray-300 dark:text-gray-600" />
                              )}
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            );
          })()}
        </div>
      )}
    </div>
  );
}
