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
  | "notifications";

export const ROLE_PERMISSIONS: Record<string, Permission[]> = {
  SUPER_ADMIN: ["dashboard", "companies", "users", "reports"],
  ADMIN: [
    "dashboard",
    "products",
    "inventory",
    "pos",
    "tables",
    "orders",
    "invoices",
    "customers",
    "suppliers",
    "purchases",
    "accounting",
    "reports",
    "users",
    "settings",
    "memberships",
    "checkin",
    "day_passes",
    "classes",
    "trainers",
    "body_tracking",
    "lockers",
    "notifications",
  ],
  CASHIER: ["dashboard", "pos", "orders", "invoices", "customers", "checkin", "day_passes", "memberships"],
  WAITER: ["dashboard", "tables", "orders"],
  ACCOUNTANT: [
    "dashboard",
    "accounting",
    "reports",
    "invoices",
    "purchases",
    "suppliers",
    "customers",
  ],
  TRAINER: [
    "dashboard",
    "classes",
    "checkin",
    "body_tracking",
    "memberships",
  ],
};

export type CompanyType = "RESTAURANT" | "GYM";

export const COMPANY_TYPE_PERMISSIONS: Record<CompanyType, Permission[]> = {
  RESTAURANT: [
    "dashboard", "companies", "products", "inventory", "pos", "tables", "orders",
    "invoices", "customers", "suppliers", "purchases", "accounting", "reports",
    "users", "settings", "notifications",
  ],
  GYM: [
    "dashboard", "companies", "products", "inventory", "pos",
    "invoices", "customers", "suppliers", "purchases", "accounting", "reports",
    "users", "settings", "notifications", "memberships", "checkin", "day_passes",
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
