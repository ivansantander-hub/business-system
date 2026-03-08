/**
 * Resolves entity type + ID to a dashboard navigation URL.
 * Used by audit log viewers for clickable entity links.
 */
export function getEntityUrl(entity: string | null, entityId: string | null): string | null {
  if (!entity || !entityId) return null;

  const routes: Record<string, string> = {
    Invoice: "/dashboard/facturas",
    Product: "/dashboard/productos",
    Customer: "/dashboard/clientes",
    Supplier: "/dashboard/proveedores",
    Purchase: "/dashboard/compras",
    Expense: "/dashboard/contabilidad",
    User: "/dashboard/usuarios",
    DayPass: "/dashboard/tiqueteras",
    Membership: "/dashboard/membresias",
    CashSession: "/dashboard/caja",
    Order: "/dashboard/ordenes",
  };

  const base = routes[entity];
  if (!base) return null;

  // For entities that have detail views accessible via query or modal
  return `${base}?highlight=${entityId}`;
}

export function getEntityLabel(entity: string | null): string {
  if (!entity) return "";
  const labels: Record<string, string> = {
    Invoice: "Factura",
    Product: "Producto",
    Customer: "Cliente",
    Supplier: "Proveedor",
    Purchase: "Compra",
    Expense: "Gasto",
    User: "Usuario",
    DayPass: "Tiquetera",
    Membership: "Membresía",
    CashSession: "Sesión de Caja",
    Order: "Orden",
  };
  return labels[entity] || entity;
}

export function getActionLabel(action: string): string {
  const labels: Record<string, string> = {
    "auth.login": "Inicio de sesión",
    "auth.logout": "Cierre de sesión",
    "product.create": "Producto creado",
    "product.update": "Producto actualizado",
    "product.delete": "Producto eliminado",
    "customer.create": "Cliente creado",
    "invoice.create": "Factura creada",
    "purchase.create": "Compra creada",
    "purchase.receive": "Compra recibida",
    "purchase.cancel": "Compra cancelada",
    "cash.open": "Caja abierta",
    "cash.close": "Caja cerrada",
    "expense.create": "Gasto registrado",
    "user.create": "Usuario creado",
    "rbac.update": "Permisos actualizados",
    "profile.update": "Perfil actualizado",
    "avatar.upload": "Foto de perfil subida",
    "avatar.delete": "Foto de perfil eliminada",
    "daypass.create": "Tiquetera creada",
    "membership.create": "Membresía creada",
    "page.view": "Página visitada",
  };
  return labels[action] || action;
}
