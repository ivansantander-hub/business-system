export interface Capability {
  id: string;
  label: string;
  description: string;
  tools: string[];
}

export const CAPABILITIES: Capability[] = [
  {
    id: "overview",
    label: "Resumen General",
    description: "Resumen general del negocio: conteos de productos, clientes, proveedores y empleados",
    tools: ["get_business_overview"],
  },
  {
    id: "sales",
    label: "Ventas y Facturación",
    description: "Consultas sobre facturas, totales diarios/mensuales, métodos de pago y productos más vendidos",
    tools: ["get_sales_summary", "get_sales_by_payment_method", "get_top_selling_products", "get_invoice_details"],
  },
  {
    id: "products",
    label: "Productos y Precios",
    description: "Búsqueda de productos, precios, categorías, estadísticas y alertas de bajo stock",
    tools: ["get_product_stats", "search_products", "get_product_details", "get_low_stock_products"],
  },
  {
    id: "inventory",
    label: "Inventario",
    description: "Niveles de stock, movimientos y ajustes de inventario",
    tools: ["get_inventory_status", "get_inventory_movements"],
  },
  {
    id: "customers",
    label: "Clientes",
    description: "Listar, buscar y consultar clientes, historial de compras y saldos",
    tools: ["list_customers", "search_customers", "get_customer_details", "get_customer_purchase_history"],
  },
  {
    id: "suppliers",
    label: "Proveedores y Compras",
    description: "Listar, buscar proveedores y consultar órdenes de compra",
    tools: ["list_suppliers", "search_suppliers", "get_purchase_orders"],
  },
  {
    id: "orders",
    label: "Órdenes",
    description: "Órdenes activas, estado de órdenes y mesas",
    tools: ["get_active_orders", "get_order_details", "get_table_status"],
  },
  {
    id: "employees",
    label: "Empleados",
    description: "Listar, buscar empleados e información de contratos",
    tools: ["list_employees", "search_employees", "get_employee_details"],
  },
  {
    id: "payroll",
    label: "Nómina",
    description: "Corridas de nómina, totales y devengados por empleado",
    tools: ["get_payroll_runs", "get_payroll_summary"],
  },
  {
    id: "accounting",
    label: "Contabilidad",
    description: "Saldos de cuentas y asientos contables",
    tools: ["get_account_balances", "get_journal_entries"],
  },
  {
    id: "memberships",
    label: "Membresías",
    description: "Membresías activas, vencimientos y check-ins",
    tools: ["get_active_memberships", "get_membership_stats"],
  },
  {
    id: "cash",
    label: "Caja",
    description: "Sesiones de caja abiertas, totales diarios y gastos",
    tools: ["get_cash_sessions", "get_daily_cash_summary"],
  },
  {
    id: "audit",
    label: "Auditoría",
    description: "Actividad reciente, historial de cambios por entidad",
    tools: ["get_recent_audit", "get_entity_audit_history"],
  },
];

export const ALL_CAPABILITY_IDS = CAPABILITIES.map((c) => c.id);

export function getEnabledCapabilities(config: Record<string, boolean>): Capability[] {
  return CAPABILITIES.filter((c) => config[c.id] === true);
}

export function getToolIdsForCapabilities(config: Record<string, boolean>): string[] {
  return getEnabledCapabilities(config).flatMap((c) => c.tools);
}
