import { prisma } from "@/lib/prisma";

export type Permission =
  | "dashboard"
  | "companies"
  | "products"
  | "inventory"
  | "pos"
  | "tables"
  | "orders"
  | "invoices"
  | "customers"
  | "suppliers"
  | "purchases"
  | "accounting"
  | "reports"
  | "users"
  | "settings"
  | "memberships"
  | "checkin"
  | "day_passes"
  | "classes"
  | "trainers"
  | "body_tracking"
  | "lockers"
  | "notifications"
  | "rbac";

export const ALL_PERMISSIONS: Permission[] = [
  "dashboard", "companies", "products", "inventory", "pos", "tables", "orders",
  "invoices", "customers", "suppliers", "purchases", "accounting", "reports",
  "users", "settings", "memberships", "checkin", "day_passes", "classes",
  "trainers", "body_tracking", "lockers", "notifications", "rbac",
];

export const PERMISSION_LABELS: Record<Permission, string> = {
  dashboard: "Dashboard",
  companies: "Empresas",
  products: "Productos",
  inventory: "Inventario",
  pos: "Punto de Venta",
  tables: "Mesas",
  orders: "Órdenes",
  invoices: "Facturas",
  customers: "Clientes",
  suppliers: "Proveedores",
  purchases: "Compras",
  accounting: "Contabilidad",
  reports: "Reportes",
  users: "Usuarios",
  settings: "Configuración",
  memberships: "Membresías",
  checkin: "Check-in",
  day_passes: "Tiqueteras",
  classes: "Clases",
  trainers: "Entrenadores",
  body_tracking: "Medidas Corporales",
  lockers: "Casilleros",
  notifications: "Notificaciones",
  rbac: "Control de Acceso",
};

export const ROLE_PERMISSIONS: Record<string, Permission[]> = {
  SUPER_ADMIN: ["dashboard", "companies", "users", "reports"],
  ADMIN: [
    "dashboard", "products", "inventory", "pos", "tables", "orders",
    "invoices", "customers", "suppliers", "purchases", "accounting",
    "reports", "users", "settings", "memberships", "checkin", "day_passes",
    "classes", "trainers", "body_tracking", "lockers", "notifications", "rbac",
  ],
  CASHIER: ["dashboard", "pos", "orders", "invoices", "customers", "checkin", "day_passes", "memberships"],
  WAITER: ["dashboard", "tables", "orders"],
  ACCOUNTANT: [
    "dashboard", "accounting", "reports", "invoices", "purchases",
    "suppliers", "customers",
  ],
  TRAINER: [
    "dashboard", "classes", "checkin", "body_tracking", "memberships",
  ],
};

export type CompanyType = "RESTAURANT" | "GYM";

export const COMPANY_TYPE_PERMISSIONS: Record<CompanyType, Permission[]> = {
  RESTAURANT: [
    "dashboard", "companies", "products", "inventory", "pos", "tables", "orders",
    "invoices", "customers", "suppliers", "purchases", "accounting", "reports",
    "users", "settings", "notifications", "rbac",
  ],
  GYM: [
    "dashboard", "companies", "products", "inventory", "pos",
    "invoices", "customers", "suppliers", "purchases", "accounting", "reports",
    "users", "settings", "notifications", "rbac", "memberships", "checkin", "day_passes",
    "classes", "trainers", "body_tracking", "lockers",
  ],
};

export function hasPermission(role: string, permission: Permission): boolean {
  const permissions = ROLE_PERMISSIONS[role];
  if (!permissions) return false;
  return permissions.includes(permission);
}

export function getPermissions(role: string, companyType?: string | null): Permission[] {
  const rolePerms = ROLE_PERMISSIONS[role] || [];
  if (!companyType || role === "SUPER_ADMIN") return rolePerms;
  const typePerms = COMPANY_TYPE_PERMISSIONS[companyType as CompanyType] || [];
  return rolePerms.filter((p) => typePerms.includes(p));
}

/**
 * Resolve permissions for a role within a company, checking DB overrides first.
 * Falls back to hardcoded defaults if no DB records exist.
 */
export async function getPermissionsFromDB(
  companyId: string,
  role: string,
  companyType?: string | null
): Promise<Permission[]> {
  if (role === "SUPER_ADMIN") return ROLE_PERMISSIONS.SUPER_ADMIN;

  const dbOverrides = await prisma.rolePermission.findMany({
    where: { companyId, role },
  });

  if (dbOverrides.length === 0) {
    return getPermissions(role, companyType);
  }

  const typePerms = companyType
    ? (COMPANY_TYPE_PERMISSIONS[companyType as CompanyType] || [])
    : null;

  return dbOverrides
    .filter((rp) => rp.enabled)
    .map((rp) => rp.permission as Permission)
    .filter((p) => !typePerms || typePerms.includes(p));
}
