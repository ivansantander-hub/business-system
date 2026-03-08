import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getUserFromHeaders } from "@/lib/auth";

export async function GET(request: Request) {
  const { role } = getUserFromHeaders(request);
  if (role !== "SUPER_ADMIN") {
    return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  }

  const companies = await prisma.company.findMany({
    include: { _count: { select: { userCompanies: true } } },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json(companies);
}

export async function POST(request: Request) {
  const { role } = getUserFromHeaders(request);
  if (role !== "SUPER_ADMIN") {
    return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  }

  try {
    const body = await request.json();
    const company = await prisma.company.create({
      data: {
        name: body.name,
        legalName: body.legalName || null,
        nit: body.nit,
        address: body.address || null,
        city: body.city || null,
        department: body.department || null,
        phone: body.phone || null,
        email: body.email || null,
        taxRegime: body.taxRegime || null,
      },
    });

    await seedCompanyDefaults(company.id);

    return NextResponse.json(company, { status: 201 });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : "Error al crear empresa";
    if (msg.includes("Unique constraint")) {
      return NextResponse.json({ error: "Ya existe una empresa con ese NIT" }, { status: 409 });
    }
    console.error("Create company error:", error);
    return NextResponse.json({ error: "Error al crear empresa" }, { status: 500 });
  }
}

async function seedCompanyDefaults(companyId: number) {
  const accounts = [
    { code: "1", name: "ACTIVO", type: "ASSET" as const },
    { code: "11", name: "Disponible", type: "ASSET" as const },
    { code: "1105", name: "Caja", type: "ASSET" as const },
    { code: "1110", name: "Bancos", type: "ASSET" as const },
    { code: "1120", name: "Cuentas de Ahorro", type: "ASSET" as const },
    { code: "13", name: "Deudores", type: "ASSET" as const },
    { code: "1305", name: "Clientes", type: "ASSET" as const },
    { code: "1355", name: "Anticipo de Impuestos y Contribuciones", type: "ASSET" as const },
    { code: "14", name: "Inventarios", type: "ASSET" as const },
    { code: "1435", name: "Mercancías no Fabricadas por la Empresa", type: "ASSET" as const },
    { code: "2", name: "PASIVO", type: "LIABILITY" as const },
    { code: "21", name: "Obligaciones Financieras", type: "LIABILITY" as const },
    { code: "22", name: "Proveedores", type: "LIABILITY" as const },
    { code: "2205", name: "Proveedores Nacionales", type: "LIABILITY" as const },
    { code: "23", name: "Cuentas por Pagar", type: "LIABILITY" as const },
    { code: "2335", name: "Costos y Gastos por Pagar", type: "LIABILITY" as const },
    { code: "24", name: "Impuestos, Gravámenes y Tasas", type: "LIABILITY" as const },
    { code: "2404", name: "IVA por Pagar (19%)", type: "LIABILITY" as const },
    { code: "2408", name: "ICA por Pagar", type: "LIABILITY" as const },
    { code: "2365", name: "Retención en la Fuente", type: "LIABILITY" as const },
    { code: "2367", name: "Retención de ICA", type: "LIABILITY" as const },
    { code: "2368", name: "Retención de IVA", type: "LIABILITY" as const },
    { code: "25", name: "Obligaciones Laborales", type: "LIABILITY" as const },
    { code: "3", name: "PATRIMONIO", type: "EQUITY" as const },
    { code: "31", name: "Capital Social", type: "EQUITY" as const },
    { code: "3105", name: "Capital Suscrito y Pagado", type: "EQUITY" as const },
    { code: "36", name: "Resultados del Ejercicio", type: "EQUITY" as const },
    { code: "3605", name: "Utilidad del Ejercicio", type: "EQUITY" as const },
    { code: "37", name: "Resultados de Ejercicios Anteriores", type: "EQUITY" as const },
    { code: "4", name: "INGRESOS", type: "INCOME" as const },
    { code: "41", name: "Operacionales", type: "INCOME" as const },
    { code: "4135", name: "Comercio al por Mayor y al por Menor", type: "INCOME" as const },
    { code: "4175", name: "Servicios de Restaurante y Hotel", type: "INCOME" as const },
    { code: "42", name: "No Operacionales", type: "INCOME" as const },
    { code: "4210", name: "Financieros", type: "INCOME" as const },
    { code: "5", name: "GASTOS", type: "EXPENSE" as const },
    { code: "51", name: "Operacionales de Administración", type: "EXPENSE" as const },
    { code: "5105", name: "Gastos de Personal", type: "EXPENSE" as const },
    { code: "5110", name: "Honorarios", type: "EXPENSE" as const },
    { code: "5115", name: "Impuestos", type: "EXPENSE" as const },
    { code: "5120", name: "Arrendamientos", type: "EXPENSE" as const },
    { code: "5135", name: "Servicios", type: "EXPENSE" as const },
    { code: "5195", name: "Diversos", type: "EXPENSE" as const },
    { code: "52", name: "Operacionales de Ventas", type: "EXPENSE" as const },
    { code: "6", name: "COSTOS DE VENTAS", type: "COST" as const },
    { code: "61", name: "Costo de Ventas y de Prestación de Servicios", type: "COST" as const },
    { code: "6135", name: "Comercio al por Mayor y al por Menor", type: "COST" as const },
  ];

  await prisma.account.createMany({
    data: accounts.map((a) => ({ ...a, companyId })),
  });

  const settings = [
    { key: "business_name", value: "Mi Empresa" },
    { key: "tax_rate", value: "0.19" },
    { key: "currency", value: "COP" },
    { key: "invoice_prefix", value: "FE-" },
    { key: "invoice_next_number", value: "1" },
    { key: "locale", value: "es-CO" },
    { key: "iva_general", value: "0.19" },
    { key: "iva_reducido", value: "0.05" },
    { key: "iva_excluido", value: "0" },
  ];

  await prisma.setting.createMany({
    data: settings.map((s) => ({ ...s, companyId })),
  });

  await prisma.customer.create({
    data: {
      companyId,
      name: "Consumidor Final",
      nit: "222222222",
    },
  });

  const defaultCategories = ["General", "Alimentos", "Bebidas", "Postres", "Servicios"];
  await prisma.category.createMany({
    data: defaultCategories.map((name) => ({ companyId, name })),
  });
}
