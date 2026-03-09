"use client";

import { useState, useEffect, useCallback } from "react";
import { Shield, ChevronDown, ChevronRight, Check, X, RotateCcw } from "lucide-react";
import { Button } from "@/components/atoms";

interface PermissionItem {
  permission: string;
  label: string;
  enabled: boolean;
  isDefault: boolean;
}

interface RoleConfig {
  role: string;
  permissions: PermissionItem[];
}

const ROLE_LABELS: Record<string, string> = {
  ADMIN: "Administrador",
  CASHIER: "Cajero",
  WAITER: "Mesero",
  ACCOUNTANT: "Contador",
  TRAINER: "Entrenador",
};

const ROLE_DESCRIPTIONS: Record<string, string> = {
  ADMIN: "Acceso completo a la gestión de la empresa",
  CASHIER: "Gestión de ventas, caja y atención al cliente",
  WAITER: "Gestión de mesas y órdenes en restaurante",
  ACCOUNTANT: "Contabilidad, reportes y gestión financiera",
  TRAINER: "Gestión de clases y seguimiento de miembros",
};

const PERM_GROUPS: { label: string; permissions: string[] }[] = [
  { label: "General", permissions: ["dashboard", "companies"] },
  { label: "Ventas", permissions: ["pos", "tables", "orders", "kitchen", "invoices", "customers"] },
  { label: "Gimnasio", permissions: ["memberships", "checkin", "day_passes", "classes", "trainers", "body_tracking", "lockers"] },
  { label: "Inventario", permissions: ["products", "inventory", "suppliers", "purchases"] },
  { label: "Finanzas", permissions: ["accounting", "reports"] },
  { label: "Nómina", permissions: ["employees", "payroll", "payroll_config", "electronic_payroll"] },
  { label: "Comunicación", permissions: ["messaging", "notifications"] },
  { label: "Sistema", permissions: ["users", "settings", "branches", "rbac", "logs", "audit", "test_runs"] },
];

export default function RBACPage() {
  const [roles, setRoles] = useState<RoleConfig[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);
  const [expandedRoles, setExpandedRoles] = useState<Set<string>>(new Set(["ADMIN"]));
  const [dirty, setDirty] = useState<Set<string>>(new Set());

  const fetchRoles = useCallback(async () => {
    const res = await fetch("/api/rbac");
    if (res.ok) setRoles(await res.json());
  }, []);

  useEffect(() => {
    setLoading(true);
    fetchRoles().finally(() => setLoading(false));
  }, [fetchRoles]);

  const togglePermission = (role: string, permission: string) => {
    setRoles((prev) =>
      prev.map((r) =>
        r.role === role
          ? {
              ...r,
              permissions: r.permissions.map((p) =>
                p.permission === permission ? { ...p, enabled: !p.enabled } : p
              ),
            }
          : r
      )
    );
    setDirty((prev) => new Set(prev).add(role));
  };

  const saveRole = async (role: string) => {
    setSaving(role);
    const roleConfig = roles.find((r) => r.role === role);
    if (!roleConfig) return;

    await fetch("/api/rbac", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        role,
        permissions: roleConfig.permissions.map((p) => ({
          permission: p.permission,
          enabled: p.enabled,
        })),
      }),
    });

    setDirty((prev) => {
      const next = new Set(prev);
      next.delete(role);
      return next;
    });
    setSaving(null);
  };

  const resetRole = async (role: string) => {
    setSaving(role);
    await fetchRoles();
    setDirty((prev) => {
      const next = new Set(prev);
      next.delete(role);
      return next;
    });
    setSaving(null);
  };

  const toggleAll = (role: string, enabled: boolean) => {
    setRoles((prev) =>
      prev.map((r) =>
        r.role === role
          ? { ...r, permissions: r.permissions.map((p) => ({ ...p, enabled })) }
          : r
      )
    );
    setDirty((prev) => new Set(prev).add(role));
  };

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
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Control de Acceso (RBAC)</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            Define qué permisos tiene cada rol en tu empresa. Los cambios aplican inmediatamente a todos los usuarios del rol.
          </p>
        </div>
      </div>

      <div className="space-y-4">
        {roles.map((roleConfig) => {
          const isExpanded = expandedRoles.has(roleConfig.role);
          const isDirty = dirty.has(roleConfig.role);
          const enabledCount = roleConfig.permissions.filter((p) => p.enabled).length;
          const totalCount = roleConfig.permissions.length;

          return (
            <div key={roleConfig.role} className="card overflow-hidden">
              <button
                onClick={() => {
                  setExpandedRoles((prev) => {
                    const next = new Set(prev);
                    if (next.has(roleConfig.role)) next.delete(roleConfig.role);
                    else next.add(roleConfig.role);
                    return next;
                  });
                }}
                className="w-full flex items-center justify-between p-4 md:p-5 hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors"
              >
                <div className="flex items-center gap-3 md:gap-4">
                  <div className="w-10 h-10 rounded-xl bg-violet-500/10 dark:bg-violet-500/20 flex items-center justify-center flex-shrink-0">
                    <Shield className="w-5 h-5 text-violet-500" />
                  </div>
                  <div className="text-left">
                    <div className="flex items-center gap-2">
                      <p className="font-semibold text-gray-900 dark:text-white">
                        {ROLE_LABELS[roleConfig.role] || roleConfig.role}
                      </p>
                      {isDirty && (
                        <span className="text-[10px] bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300 px-1.5 py-0.5 rounded-full font-medium">
                          Sin guardar
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-gray-500 dark:text-gray-400 hidden sm:block">
                      {ROLE_DESCRIPTIONS[roleConfig.role] || ""}
                    </p>
                    <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">
                      {enabledCount}/{totalCount} permisos activos
                    </p>
                  </div>
                </div>
                {isExpanded ? (
                  <ChevronDown className="w-5 h-5 text-gray-400 flex-shrink-0" />
                ) : (
                  <ChevronRight className="w-5 h-5 text-gray-400 flex-shrink-0" />
                )}
              </button>

              {isExpanded && (
                <div className="border-t border-gray-200 dark:border-gray-700">
                  <div className="p-3 md:p-4 bg-gray-50/50 dark:bg-gray-800/30 flex flex-wrap items-center gap-2 border-b border-gray-200 dark:border-gray-700">
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() => toggleAll(roleConfig.role, true)}
                    >
                      <Check className="w-3.5 h-3.5 mr-1" /> Activar todos
                    </Button>
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() => toggleAll(roleConfig.role, false)}
                    >
                      <X className="w-3.5 h-3.5 mr-1" /> Desactivar todos
                    </Button>
                    <div className="flex-1" />
                    {isDirty && (
                      <>
                        <Button
                          variant="secondary"
                          size="sm"
                          onClick={() => resetRole(roleConfig.role)}
                          disabled={saving === roleConfig.role}
                        >
                          <RotateCcw className="w-3.5 h-3.5 mr-1" /> Descartar
                        </Button>
                        <Button
                          variant="primary"
                          size="sm"
                          onClick={() => saveRole(roleConfig.role)}
                          disabled={saving === roleConfig.role}
                        >
                          {saving === roleConfig.role ? "Guardando..." : "Guardar cambios"}
                        </Button>
                      </>
                    )}
                  </div>

                  <div className="p-3 md:p-4 space-y-4">
                    {PERM_GROUPS.map((group) => {
                      const groupPerms = roleConfig.permissions.filter((p) =>
                        group.permissions.includes(p.permission)
                      );
                      if (groupPerms.length === 0) return null;

                      return (
                        <div key={group.label}>
                          <p className="text-[11px] font-semibold uppercase tracking-wider text-gray-400 dark:text-gray-500 mb-2">
                            {group.label}
                          </p>
                          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-1.5">
                            {groupPerms.map((perm) => (
                              <button
                                key={perm.permission}
                                onClick={() => togglePermission(roleConfig.role, perm.permission)}
                                className={`flex items-center gap-2.5 px-3 py-2.5 rounded-lg border text-sm text-left transition-all duration-150 ${
                                  perm.enabled
                                    ? "bg-violet-50 dark:bg-violet-500/10 border-violet-200 dark:border-violet-500/30 text-violet-700 dark:text-violet-300"
                                    : "bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 text-gray-500 dark:text-gray-400"
                                }`}
                              >
                                <div
                                  className={`w-5 h-5 rounded-md flex items-center justify-center flex-shrink-0 transition-colors ${
                                    perm.enabled
                                      ? "bg-violet-500 text-white"
                                      : "bg-gray-200 dark:bg-gray-700"
                                  }`}
                                >
                                  {perm.enabled && <Check className="w-3 h-3" />}
                                </div>
                                <span className="truncate">{perm.label}</span>
                              </button>
                            ))}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
