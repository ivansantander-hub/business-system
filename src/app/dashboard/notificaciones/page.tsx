"use client";

import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/atoms";
import { PageHeader } from "@/components/molecules";
import { Bell, Users, Shield, ToggleLeft, ToggleRight, ChevronDown, ChevronRight, ExternalLink, Building2, Cog, Mail, Zap, ChevronLeft, ChevronRight as ChevronRightIcon } from "lucide-react";
import { formatTimeAgo } from "@/lib/utils";
import { useAtomValue, useSetAtom } from "jotai";
import { companyIdAtom, unreadNotificationCountAtom } from "@/store";

interface InboxNotification {
  id: string;
  userNotificationId: string;
  type: string;
  subject: string;
  bodyHtml: string | null;
  createdAt: string;
  readAt: string | null;
}

interface NotifTemplate {
  eventType: string;
  label: string;
  enabled: boolean;
  recipientType: "internal" | "external" | "system";
  recipientLabel: string;
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

function stripHtml(html: string): string {
  if (!html) return "";
  return html.replaceAll(/<[^>]*>/g, "").replaceAll(/\s+/g, " ").trim().slice(0, 120);
}

const RECIPIENT_CONFIG: Record<string, { label: string; color: string; bgColor: string; icon: React.ComponentType<{ className?: string }> }> = {
  internal: { label: "Internas (Empleados)", color: "text-blue-600 dark:text-blue-400", bgColor: "bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800", icon: Building2 },
  external: { label: "Externas (Clientes / Proveedores)", color: "text-emerald-600 dark:text-emerald-400", bgColor: "bg-emerald-50 dark:bg-emerald-900/20 border-emerald-200 dark:border-emerald-800", icon: ExternalLink },
  system: { label: "Sistema (Automáticas)", color: "text-gray-600 dark:text-gray-400", bgColor: "bg-gray-50 dark:bg-gray-800/50 border-gray-200 dark:border-gray-700", icon: Cog },
};

type Tab = "bandeja" | "company" | "users" | "roles";
type InboxFilter = "all" | "unread" | "email" | "system";

export default function NotificacionesPage() {
  const [tab, setTab] = useState<Tab>("bandeja");
  const [inboxNotifications, setInboxNotifications] = useState<InboxNotification[]>([]);
  const [inboxTotal, setInboxTotal] = useState(0);
  const [inboxUnreadCount, setInboxUnreadCount] = useState(0);
  const [inboxPage, setInboxPage] = useState(1);
  const [inboxFilter, setInboxFilter] = useState<InboxFilter>("all");
  const [inboxExpanded, setInboxExpanded] = useState<string | null>(null);
  const [inboxLoading, setInboxLoading] = useState(false);
  const [markingRead, setMarkingRead] = useState(false);
  const [templates, setTemplates] = useState<NotifTemplate[]>([]);
  const [userPrefs, setUserPrefs] = useState<UserPref[]>([]);
  const [roleGroups, setRoleGroups] = useState<RoleGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);
  const [expandedRoles, setExpandedRoles] = useState<Set<string>>(new Set());
  const companyId = useAtomValue(companyIdAtom);
  const setUnreadCount = useSetAtom(unreadNotificationCountAtom);

  const fetchInbox = useCallback(async () => {
    if (!companyId) return;
    setInboxLoading(true);
    const params = new URLSearchParams();
    params.set("page", String(inboxPage));
    params.set("limit", "20");
    if (inboxFilter === "unread") params.set("unreadOnly", "true");
    if (inboxFilter === "email") params.set("type", "email");
    if (inboxFilter === "system") params.set("type", "system");
    try {
      const res = await fetch(`/api/notifications/inbox?${params}`);
      if (res.ok) {
        const data = await res.json();
        setInboxNotifications(data.notifications);
        setInboxTotal(data.total);
        setInboxUnreadCount(data.unreadCount);
        setUnreadCount(data.unreadCount);
      }
    } finally {
      setInboxLoading(false);
    }
  }, [companyId, inboxPage, inboxFilter]);

  useEffect(() => {
    if (tab === "bandeja" && companyId) fetchInbox();
  }, [tab, companyId, fetchInbox]);

  const markAsRead = async (id: string) => {
    const res = await fetch(`/api/notifications/inbox/${id}/read`, { method: "PUT" });
    if (res.ok) {
      setInboxNotifications((prev) =>
        prev.map((n) => (n.id === id ? { ...n, readAt: new Date().toISOString() } : n))
      );
      const newCount = Math.max(0, inboxUnreadCount - 1);
      setInboxUnreadCount(newCount);
      setUnreadCount(newCount);
    }
  };

  const markAllAsRead = async () => {
    setMarkingRead(true);
    try {
      const res = await fetch("/api/notifications/inbox/read-all", { method: "PUT" });
      const data = await res.json();
      if (res.ok && data.ok) {
        setInboxNotifications((prev) =>
          prev.map((n) => ({ ...n, readAt: n.readAt ?? new Date().toISOString() }))
        );
        setInboxUnreadCount(0);
        setUnreadCount(0);
      }
    } finally {
      setMarkingRead(false);
    }
  };

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
    if (tab !== "bandeja") {
      setLoading(true);
      Promise.all([fetchCompanyTemplates(), fetchUserPrefs(), fetchRoleGroups()])
        .finally(() => setLoading(false));
    }
  }, [tab, fetchCompanyTemplates, fetchUserPrefs, fetchRoleGroups]);

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
    { key: "bandeja", label: "Bandeja", icon: Bell },
    { key: "company", label: "Configuración", icon: Cog },
    { key: "users", label: "Usuarios", icon: Users },
    { key: "roles", label: "Roles", icon: Shield },
  ];

  const inboxFilters: { key: InboxFilter; label: string }[] = [
    { key: "all", label: "Todas" },
    { key: "unread", label: "No leídas" },
    { key: "email", label: "Email" },
    { key: "system", label: "Sistema" },
  ];

  if (tab !== "bandeja" && loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-500" />
      </div>
    );
  }

  const groupedTemplates = {
    external: templates.filter((t) => t.recipientType === "external"),
    internal: templates.filter((t) => t.recipientType === "internal"),
    system: templates.filter((t) => t.recipientType === "system"),
  };

  return (
    <div className="space-y-4 sm:space-y-6">
      <PageHeader
        icon={<Bell className="w-6 h-6" />}
        title="Notificaciones"
        subtitle={tab === "bandeja" ? "Bandeja de entrada y correos enviados" : "Configuración de notificaciones por email"}
        actions={
          tab === "bandeja" && inboxUnreadCount > 0 ? (
            <Button variant="secondary" size="sm" onClick={markAllAsRead} loading={markingRead}>
              Marcar todas como leídas
            </Button>
          ) : undefined
        }
      />

      <div className="flex gap-1 p-1 bg-slate-100 dark:bg-slate-800 rounded-xl w-fit">
        {tabs.map(({ key, label, icon: Icon }) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
              tab === key
                ? "bg-white dark:bg-slate-700 text-violet-600 dark:text-violet-400 shadow-sm"
                : "text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200"
            }`}
          >
            <Icon className="w-4 h-4" />
            <span className="hidden sm:inline">{label}</span>
          </button>
        ))}
      </div>

      {tab === "bandeja" && (
        <div className="space-y-4">
          {!companyId ? (
            <div className="card p-8 text-center text-slate-500 dark:text-slate-400">
              Selecciona una empresa para ver las notificaciones.
            </div>
          ) : (
            <>
              <div className="flex flex-wrap gap-2">
                {inboxFilters.map(({ key, label }) => (
                  <button
                    key={key}
                    onClick={() => {
                      setInboxFilter(key);
                      setInboxPage(1);
                    }}
                    className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                      inboxFilter === key
                        ? "bg-violet-600 text-white dark:bg-violet-500"
                        : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700"
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>

              {inboxLoading ? (
                <div className="flex justify-center py-12">
                  <div className="animate-spin rounded-full h-8 w-8 border-2 border-violet-500 border-t-transparent" />
                </div>
              ) : inboxNotifications.length === 0 ? (
                <div className="card p-12 text-center">
                  <Bell className="w-12 h-12 mx-auto text-slate-300 dark:text-slate-600 mb-4" />
                  <p className="text-slate-600 dark:text-slate-400 font-medium">No hay notificaciones</p>
                  <p className="text-sm text-slate-500 dark:text-slate-500 mt-1">
                    {inboxFilter === "unread" ? "No tienes notificaciones sin leer" : "Las notificaciones por email aparecerán aquí"}
                  </p>
                </div>
              ) : (
                <div className="card divide-y divide-slate-200 dark:divide-slate-700 overflow-hidden">
                  {inboxNotifications.map((n) => {
                    const Icon = n.type === "email" ? Mail : Zap;
                    const isExpanded = inboxExpanded === n.id;
                    return (
                      <div
                        key={n.id}
                        className={`p-4 sm:p-5 transition-colors ${
                          !n.readAt ? "bg-violet-50/50 dark:bg-violet-900/10" : "hover:bg-slate-50 dark:hover:bg-slate-800/50"
                        }`}
                      >
                        <button
                          onClick={() => {
                            setInboxExpanded(isExpanded ? null : n.id);
                            if (!n.readAt) markAsRead(n.id);
                          }}
                          className="w-full text-left flex gap-3 sm:gap-4"
                        >
                          <div
                            className={`flex-shrink-0 w-10 h-10 rounded-xl flex items-center justify-center ${
                              n.type === "email"
                                ? "bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400"
                                : "bg-amber-100 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400"
                            }`}
                          >
                            <Icon className="w-5 h-5" />
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1">
                              <p className={`font-medium truncate ${!n.readAt ? "text-slate-900 dark:text-white" : "text-slate-700 dark:text-slate-300"}`}>
                                {n.subject}
                              </p>
                              <span className="text-xs text-slate-500 dark:text-slate-400 flex-shrink-0">
                                {formatTimeAgo(n.createdAt)}
                              </span>
                            </div>
                            <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5 line-clamp-1">
                              {stripHtml(n.bodyHtml || "")}
                            </p>
                          </div>
                          <ChevronDown
                            className={`w-5 h-5 text-slate-400 flex-shrink-0 transition-transform ${
                              isExpanded ? "rotate-180" : ""
                            }`}
                          />
                        </button>
                        {isExpanded && n.bodyHtml && (
                          <div
                            className="mt-4 pl-0 sm:pl-14 prose prose-sm dark:prose-invert max-w-none text-slate-600 dark:text-slate-400"
                            dangerouslySetInnerHTML={{ __html: n.bodyHtml }}
                          />
                        )}
                      </div>
                    );
                  })}
                </div>
              )}

              {inboxTotal > 20 && (
                <div className="flex items-center justify-between gap-4">
                  <p className="text-sm text-slate-500 dark:text-slate-400">
                    {inboxNotifications.length} de {inboxTotal}
                  </p>
                  <div className="flex gap-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      disabled={inboxPage <= 1}
                      onClick={() => setInboxPage((p) => Math.max(1, p - 1))}
                      icon={<ChevronLeft className="w-4 h-4" />}
                    />
                    <Button
                      variant="ghost"
                      size="sm"
                      disabled={inboxPage * 20 >= inboxTotal}
                      onClick={() => setInboxPage((p) => p + 1)}
                      icon={<ChevronRightIcon className="w-4 h-4" />}
                    />
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      )}

      {tab === "company" && (
        <div className="space-y-4">
          {(["external", "internal", "system"] as const).map((type) => {
            const items = groupedTemplates[type];
            if (items.length === 0) return null;
            const cfg = RECIPIENT_CONFIG[type];
            const Icon = cfg.icon;

            return (
              <div key={type} className="card overflow-hidden">
                <div className={`p-4 border-b ${cfg.bgColor}`}>
                  <div className="flex items-center gap-2">
                    <Icon className={`w-4 h-4 ${cfg.color}`} />
                    <h2 className={`text-sm font-semibold ${cfg.color}`}>{cfg.label}</h2>
                  </div>
                </div>
                <div className="divide-y divide-gray-200 dark:divide-gray-700">
                  {items.map((t) => (
                    <div key={t.eventType} className="flex items-center justify-between p-4 hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors">
                      <div>
                        <p className="font-medium text-gray-900 dark:text-white text-sm">{t.label}</p>
                        <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                          Destinatario: {t.recipientLabel}
                        </p>
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
            );
          })}
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
                            <div>
                              <span className="text-sm text-gray-700 dark:text-gray-300">{t.label}</span>
                              <span className={`ml-1.5 text-[10px] px-1.5 py-0.5 rounded-full ${
                                t.recipientType === "external"
                                  ? "bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400"
                                  : t.recipientType === "system"
                                    ? "bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400"
                                    : "bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400"
                              }`}>
                                {t.recipientType === "external" ? "Externo" : t.recipientType === "system" ? "Sistema" : "Interno"}
                              </span>
                            </div>
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
                            <div>
                              <span className="text-sm text-gray-700 dark:text-gray-300">{t.label}</span>
                              <span className={`ml-1.5 text-[10px] px-1.5 py-0.5 rounded-full ${
                                t.recipientType === "external"
                                  ? "bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400"
                                  : "bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400"
                              }`}>
                                {t.recipientType === "external" ? "Externo" : "Interno"}
                              </span>
                            </div>
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
