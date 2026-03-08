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
  | "settings";

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
  ],
  CASHIER: ["dashboard", "pos", "orders", "invoices", "customers"],
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
};

export function hasPermission(role: string, permission: Permission): boolean {
  const permissions = ROLE_PERMISSIONS[role];
  if (!permissions) return false;
  return permissions.includes(permission);
}

export function getPermissions(role: string): Permission[] {
  return ROLE_PERMISSIONS[role] || [];
}
