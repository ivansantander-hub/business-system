import type { ToolDefinition } from "./providers";

export const ALL_TOOLS: ToolDefinition[] = [
  // ──── Business Overview ────
  {
    name: "get_business_overview",
    description: "Resumen general del negocio: cantidad de productos, clientes, proveedores, empleados y facturas del día. Úsala para responder preguntas generales como 'cuántos clientes/productos/empleados tenemos'",
    parameters: { type: "object", properties: {} },
  },

  // ──── Sales ────
  {
    name: "get_sales_summary",
    description: "Obtiene resumen de ventas: total facturado, cantidad de facturas, impuestos y descuentos para un periodo dado",
    parameters: {
      type: "object",
      properties: {
        period: { type: "string", enum: ["today", "yesterday", "week", "month", "year", "custom"], description: "Periodo de consulta" },
        startDate: { type: "string", description: "Fecha inicio (ISO 8601) para periodo custom" },
        endDate: { type: "string", description: "Fecha fin (ISO 8601) para periodo custom" },
      },
      required: ["period"],
    },
  },
  {
    name: "get_sales_by_payment_method",
    description: "Desglose de ventas por método de pago (efectivo, tarjeta, transferencia, etc.)",
    parameters: {
      type: "object",
      properties: {
        period: { type: "string", enum: ["today", "yesterday", "week", "month", "year", "custom"] },
        startDate: { type: "string" },
        endDate: { type: "string" },
      },
      required: ["period"],
    },
  },
  {
    name: "get_top_selling_products",
    description: "Obtiene los productos más vendidos ordenados por ingresos",
    parameters: {
      type: "object",
      properties: {
        period: { type: "string", enum: ["today", "yesterday", "week", "month", "year", "custom"] },
        limit: { type: "number", description: "Cantidad de productos a retornar (default 10)" },
        startDate: { type: "string" },
        endDate: { type: "string" },
      },
      required: ["period"],
    },
  },
  {
    name: "get_invoice_details",
    description: "Obtiene los detalles completos de una factura por su número",
    parameters: {
      type: "object",
      properties: {
        invoiceNumber: { type: "string", description: "Número de la factura" },
      },
      required: ["invoiceNumber"],
    },
  },

  // ──── Products ────
  {
    name: "get_product_stats",
    description: "Estadísticas generales de productos: total, activos, inactivos, categorías",
    parameters: { type: "object", properties: {} },
  },
  {
    name: "search_products",
    description: "Busca productos por nombre, categoría o estado de stock",
    parameters: {
      type: "object",
      properties: {
        query: { type: "string", description: "Texto a buscar en nombre del producto" },
        categoryId: { type: "string", description: "Filtrar por categoría" },
        lowStockOnly: { type: "boolean", description: "Solo productos con bajo stock" },
      },
    },
  },
  {
    name: "get_product_details",
    description: "Obtiene información detallada de un producto específico",
    parameters: {
      type: "object",
      properties: {
        productId: { type: "string", description: "ID del producto" },
      },
      required: ["productId"],
    },
  },
  {
    name: "get_low_stock_products",
    description: "Lista todos los productos con stock igual o por debajo del mínimo",
    parameters: { type: "object", properties: {} },
  },

  // ──── Inventory ────
  {
    name: "get_inventory_status",
    description: "Estado actual del inventario con niveles de stock y valor",
    parameters: {
      type: "object",
      properties: {
        productId: { type: "string", description: "Filtrar por producto específico" },
        lowStockOnly: { type: "boolean", description: "Solo productos con bajo stock" },
      },
    },
  },
  {
    name: "get_inventory_movements",
    description: "Historial de movimientos de inventario (entradas, salidas, ajustes)",
    parameters: {
      type: "object",
      properties: {
        productId: { type: "string", description: "Filtrar por producto" },
        limit: { type: "number", description: "Cantidad de registros (default 20)" },
      },
    },
  },

  // ──── Customers ────
  {
    name: "list_customers",
    description: "Lista todos los clientes con paginación. Incluye el conteo total. Úsala para saber cuántos clientes hay o ver la lista completa",
    parameters: {
      type: "object",
      properties: {
        limit: { type: "number", description: "Cantidad de clientes a retornar (default 20)" },
        offset: { type: "number", description: "Desde qué posición empezar (default 0)" },
      },
    },
  },
  {
    name: "search_customers",
    description: "Busca clientes por nombre o NIT/documento",
    parameters: {
      type: "object",
      properties: {
        query: { type: "string", description: "Texto a buscar (nombre o NIT)" },
      },
    },
  },
  {
    name: "get_customer_details",
    description: "Información detallada de un cliente: datos, saldo, historial",
    parameters: {
      type: "object",
      properties: {
        customerId: { type: "string", description: "ID del cliente" },
      },
      required: ["customerId"],
    },
  },
  {
    name: "get_customer_purchase_history",
    description: "Historial de compras/facturas de un cliente",
    parameters: {
      type: "object",
      properties: {
        customerId: { type: "string", description: "ID del cliente" },
        limit: { type: "number", description: "Cantidad de registros" },
      },
      required: ["customerId"],
    },
  },

  // ──── Suppliers ────
  {
    name: "list_suppliers",
    description: "Lista todos los proveedores con conteo total",
    parameters: {
      type: "object",
      properties: {
        limit: { type: "number", description: "Cantidad a retornar (default 20)" },
      },
    },
  },
  {
    name: "search_suppliers",
    description: "Busca proveedores por nombre o NIT",
    parameters: {
      type: "object",
      properties: {
        query: { type: "string", description: "Texto a buscar" },
      },
    },
  },
  {
    name: "get_purchase_orders",
    description: "Lista órdenes de compra con filtro de estado",
    parameters: {
      type: "object",
      properties: {
        status: { type: "string", enum: ["PENDING", "RECEIVED", "CANCELLED"], description: "Filtrar por estado" },
        limit: { type: "number" },
      },
    },
  },

  // ──── Orders ────
  {
    name: "get_active_orders",
    description: "Lista todas las órdenes activas (abiertas o en progreso) con sus ítems",
    parameters: { type: "object", properties: {} },
  },
  {
    name: "get_order_details",
    description: "Detalles completos de una orden específica",
    parameters: {
      type: "object",
      properties: {
        orderId: { type: "string", description: "ID de la orden" },
      },
      required: ["orderId"],
    },
  },
  {
    name: "get_table_status",
    description: "Estado de todas las mesas del restaurante (disponible, ocupada, etc.)",
    parameters: { type: "object", properties: {} },
  },

  // ──── Employees ────
  {
    name: "list_employees",
    description: "Lista todos los empleados con conteo total. Permite filtrar por activos/inactivos",
    parameters: {
      type: "object",
      properties: {
        activeOnly: { type: "boolean", description: "Solo empleados activos (default true)" },
        limit: { type: "number", description: "Cantidad a retornar (default 30)" },
      },
    },
  },
  {
    name: "search_employees",
    description: "Busca empleados por nombre o número de documento",
    parameters: {
      type: "object",
      properties: {
        query: { type: "string", description: "Texto a buscar" },
      },
    },
  },
  {
    name: "get_employee_details",
    description: "Información de un empleado: cargo, contrato, salario",
    parameters: {
      type: "object",
      properties: {
        employeeId: { type: "string", description: "ID del empleado" },
      },
      required: ["employeeId"],
    },
  },

  // ──── Payroll ────
  {
    name: "get_payroll_runs",
    description: "Lista corridas de nómina recientes con totales",
    parameters: {
      type: "object",
      properties: {
        limit: { type: "number", description: "Cantidad de corridas (default 5)" },
      },
    },
  },
  {
    name: "get_payroll_summary",
    description: "Detalle de una corrida de nómina con desglose por empleado",
    parameters: {
      type: "object",
      properties: {
        payrollRunId: { type: "string", description: "ID de la corrida de nómina" },
      },
      required: ["payrollRunId"],
    },
  },

  // ──── Accounting ────
  {
    name: "get_account_balances",
    description: "Saldos de cuentas contables, opcionalmente filtrados por tipo",
    parameters: {
      type: "object",
      properties: {
        type: { type: "string", enum: ["ASSET", "LIABILITY", "EQUITY", "INCOME", "EXPENSE"], description: "Tipo de cuenta" },
      },
    },
  },
  {
    name: "get_journal_entries",
    description: "Asientos contables recientes con líneas de débito/crédito",
    parameters: {
      type: "object",
      properties: {
        limit: { type: "number" },
        startDate: { type: "string" },
        endDate: { type: "string" },
      },
    },
  },

  // ──── Memberships ────
  {
    name: "get_active_memberships",
    description: "Lista membresías activas, opcionalmente las que vencen pronto",
    parameters: {
      type: "object",
      properties: {
        expiringInDays: { type: "number", description: "Solo membresías que vencen en los próximos N días" },
      },
    },
  },
  {
    name: "get_membership_stats",
    description: "Estadísticas de membresías: activas, inactivas, por vencer",
    parameters: { type: "object", properties: {} },
  },

  // ──── Cash ────
  {
    name: "get_cash_sessions",
    description: "Sesiones de caja con montos y estado",
    parameters: {
      type: "object",
      properties: {
        status: { type: "string", enum: ["OPEN", "CLOSED"], description: "Filtrar por estado" },
      },
    },
  },
  {
    name: "get_daily_cash_summary",
    description: "Resumen diario de caja: ventas, gastos y saldo neto",
    parameters: {
      type: "object",
      properties: {
        date: { type: "string", description: "Fecha (YYYY-MM-DD), default hoy" },
      },
    },
  },

  // ──── Audit ────
  {
    name: "get_recent_audit",
    description: "Actividad reciente del sistema: quién hizo qué y cuándo",
    parameters: {
      type: "object",
      properties: {
        entity: { type: "string", description: "Filtrar por entidad (Product, Invoice, User, etc.)" },
        action: { type: "string", description: "Filtrar por acción (create, update, delete)" },
        limit: { type: "number", description: "Cantidad de registros (default 20)" },
      },
    },
  },
  {
    name: "get_entity_audit_history",
    description: "Historial completo de cambios de una entidad específica",
    parameters: {
      type: "object",
      properties: {
        entity: { type: "string", description: "Tipo de entidad (Product, Invoice, etc.)" },
        entityId: { type: "string", description: "ID de la entidad" },
      },
      required: ["entity", "entityId"],
    },
  },
];

export function getToolsByNames(names: string[]): ToolDefinition[] {
  const nameSet = new Set(names);
  return ALL_TOOLS.filter((t) => nameSet.has(t.name));
}
