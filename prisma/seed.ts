import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  await prisma.$executeRawUnsafe(`CREATE SCHEMA IF NOT EXISTS tenant`);

  // ===== SUPER_ADMIN (master user, no company) =====
  const masterPassword = await bcrypt.hash("master123", 10);
  await prisma.user.upsert({
    where: { email: "master@sistema.com" },
    update: {},
    create: {
      name: "Super Administrador",
      email: "master@sistema.com",
      password: masterPassword,
      role: "SUPER_ADMIN",
    },
  });

  // ===== Default company =====
  let company = await prisma.company.findFirst({ where: { nit: "900123456-7" } });
  if (!company) {
    company = await prisma.company.create({
      data: {
        name: "Mi Empresa",
        legalName: "Mi Empresa S.A.S.",
        nit: "900123456-7",
        address: "Calle 100 # 15-20",
        city: "Bogotá",
        department: "Bogotá D.C.",
        phone: "601-555-1234",
        email: "info@miempresa.com",
        taxRegime: "Responsable de IVA",
      },
    });
  }

  const companyId = company.id;

  // ===== Company users with UserCompany assignments =====
  const userDefs = [
    { name: "Administrador", email: "admin@miempresa.com", password: "admin123", role: "ADMIN" as const },
    { name: "Cajero Principal", email: "cajero@miempresa.com", password: "cajero123", role: "CASHIER" as const },
    { name: "Mesero 1", email: "mesero@miempresa.com", password: "mesero123", role: "WAITER" as const },
    { name: "Contador", email: "contador@miempresa.com", password: "contador123", role: "ACCOUNTANT" as const },
  ];

  for (const def of userDefs) {
    const hashed = await bcrypt.hash(def.password, 10);
    const user = await prisma.user.upsert({
      where: { email: def.email },
      update: {},
      create: {
        name: def.name,
        email: def.email,
        password: hashed,
        role: def.role,
      },
    });

    const existing = await prisma.userCompany.findUnique({
      where: { userId_companyId: { userId: user.id, companyId } },
    });
    if (!existing) {
      await prisma.userCompany.create({
        data: { userId: user.id, companyId, role: def.role },
      });
    }
  }

  // ===== Categories =====
  const categories = ["General", "Alimentos", "Bebidas", "Postres", "Servicios"];
  for (const name of categories) {
    const existing = await prisma.category.findFirst({ where: { companyId, name } });
    if (!existing) {
      await prisma.category.create({ data: { companyId, name } });
    }
  }

  // ===== Sample products (prices in COP) =====
  const products = [
    { name: "Hamburguesa Clásica", costPrice: 8000, salePrice: 22000, stock: 50, unit: "unidad", taxRate: 0.08 },
    { name: "Pizza Mediana", costPrice: 12000, salePrice: 35000, stock: 30, unit: "unidad", taxRate: 0.08 },
    { name: "Ensalada César", costPrice: 6000, salePrice: 18000, stock: 40, unit: "unidad", taxRate: 0.08 },
    { name: "Coca Cola 400ml", costPrice: 1500, salePrice: 4000, stock: 100, unit: "unidad", taxRate: 0.19 },
    { name: "Agua Cristal 600ml", costPrice: 800, salePrice: 2500, stock: 150, unit: "unidad", taxRate: 0.19 },
    { name: "Jugo Natural", costPrice: 3000, salePrice: 8000, stock: 60, unit: "unidad", taxRate: 0.19 },
    { name: "Torta de Chocolate", costPrice: 5000, salePrice: 12000, stock: 20, unit: "unidad", taxRate: 0.08 },
    { name: "Flan de Caramelo", costPrice: 3000, salePrice: 8000, stock: 25, unit: "unidad", taxRate: 0.08 },
    { name: "Servicio de Domicilio", costPrice: 0, salePrice: 5000, stock: 9999, unit: "servicio", taxRate: 0.19 },
  ];

  const catAlimentos = await prisma.category.findFirst({ where: { companyId, name: "Alimentos" } });
  const catBebidas = await prisma.category.findFirst({ where: { companyId, name: "Bebidas" } });
  const catPostres = await prisma.category.findFirst({ where: { companyId, name: "Postres" } });
  const catServicios = await prisma.category.findFirst({ where: { companyId, name: "Servicios" } });

  const catMap: Record<string, number | null> = {
    "Hamburguesa Clásica": catAlimentos?.id ?? null,
    "Pizza Mediana": catAlimentos?.id ?? null,
    "Ensalada César": catAlimentos?.id ?? null,
    "Coca Cola 400ml": catBebidas?.id ?? null,
    "Agua Cristal 600ml": catBebidas?.id ?? null,
    "Jugo Natural": catBebidas?.id ?? null,
    "Torta de Chocolate": catPostres?.id ?? null,
    "Flan de Caramelo": catPostres?.id ?? null,
    "Servicio de Domicilio": catServicios?.id ?? null,
  };

  for (const p of products) {
    const existing = await prisma.product.findFirst({ where: { companyId, name: p.name } });
    if (!existing) {
      await prisma.product.create({
        data: {
          companyId,
          name: p.name,
          categoryId: catMap[p.name] ?? null,
          costPrice: p.costPrice,
          salePrice: p.salePrice,
          stock: p.stock,
          unit: p.unit,
          taxRate: p.taxRate,
        },
      });
    }
  }

  // ===== Restaurant tables =====
  for (let i = 1; i <= 12; i++) {
    const existing = await prisma.restaurantTable.findFirst({
      where: { companyId, number: String(i) },
    });
    if (!existing) {
      await prisma.restaurantTable.create({
        data: {
          companyId,
          number: String(i),
          capacity: i <= 4 ? 2 : i <= 8 ? 4 : 6,
          section: i <= 4 ? "Interior" : i <= 8 ? "Terraza" : "VIP",
        },
      });
    }
  }

  // ===== PUC - Plan Único de Cuentas (Colombia) =====
  const accounts = [
    { code: "1", name: "ACTIVO", type: "ASSET" as const },
    { code: "11", name: "Disponible", type: "ASSET" as const },
    { code: "1105", name: "Caja", type: "ASSET" as const },
    { code: "110505", name: "Caja General", type: "ASSET" as const },
    { code: "110510", name: "Cajas Menores", type: "ASSET" as const },
    { code: "1110", name: "Bancos", type: "ASSET" as const },
    { code: "111005", name: "Moneda Nacional", type: "ASSET" as const },
    { code: "1120", name: "Cuentas de Ahorro", type: "ASSET" as const },
    { code: "12", name: "Inversiones", type: "ASSET" as const },
    { code: "13", name: "Deudores", type: "ASSET" as const },
    { code: "1305", name: "Clientes", type: "ASSET" as const },
    { code: "130505", name: "Clientes Nacionales", type: "ASSET" as const },
    { code: "1355", name: "Anticipo de Impuestos y Contribuciones", type: "ASSET" as const },
    { code: "135515", name: "Retención en la Fuente", type: "ASSET" as const },
    { code: "135517", name: "Impuesto a las Ventas Retenido (ReteIVA)", type: "ASSET" as const },
    { code: "135518", name: "Impuesto de Industria y Comercio Retenido (ReteICA)", type: "ASSET" as const },
    { code: "14", name: "Inventarios", type: "ASSET" as const },
    { code: "1435", name: "Mercancías no Fabricadas por la Empresa", type: "ASSET" as const },
    { code: "15", name: "Propiedad, Planta y Equipo", type: "ASSET" as const },
    { code: "1524", name: "Equipo de Oficina", type: "ASSET" as const },
    { code: "1528", name: "Equipo de Computación y Comunicación", type: "ASSET" as const },
    { code: "2", name: "PASIVO", type: "LIABILITY" as const },
    { code: "21", name: "Obligaciones Financieras", type: "LIABILITY" as const },
    { code: "2105", name: "Bancos Nacionales", type: "LIABILITY" as const },
    { code: "22", name: "Proveedores", type: "LIABILITY" as const },
    { code: "2205", name: "Proveedores Nacionales", type: "LIABILITY" as const },
    { code: "23", name: "Cuentas por Pagar", type: "LIABILITY" as const },
    { code: "2335", name: "Costos y Gastos por Pagar", type: "LIABILITY" as const },
    { code: "2365", name: "Retención en la Fuente", type: "LIABILITY" as const },
    { code: "236505", name: "Salarios y Pagos Laborales", type: "LIABILITY" as const },
    { code: "236515", name: "Honorarios", type: "LIABILITY" as const },
    { code: "236525", name: "Servicios", type: "LIABILITY" as const },
    { code: "236540", name: "Compras", type: "LIABILITY" as const },
    { code: "2367", name: "Impuesto de Industria y Comercio Retenido (ReteICA)", type: "LIABILITY" as const },
    { code: "2368", name: "Impuesto a las Ventas Retenido (ReteIVA)", type: "LIABILITY" as const },
    { code: "24", name: "Impuestos, Gravámenes y Tasas", type: "LIABILITY" as const },
    { code: "2404", name: "IVA por Pagar", type: "LIABILITY" as const },
    { code: "240801", name: "IVA Generado 19%", type: "LIABILITY" as const },
    { code: "240802", name: "IVA Generado 5%", type: "LIABILITY" as const },
    { code: "240803", name: "IVA Descontable", type: "LIABILITY" as const },
    { code: "2408", name: "Impuesto de Industria y Comercio (ICA)", type: "LIABILITY" as const },
    { code: "25", name: "Obligaciones Laborales", type: "LIABILITY" as const },
    { code: "2505", name: "Salarios por Pagar", type: "LIABILITY" as const },
    { code: "2510", name: "Cesantías Consolidadas", type: "LIABILITY" as const },
    { code: "2515", name: "Intereses sobre Cesantías", type: "LIABILITY" as const },
    { code: "2520", name: "Prima de Servicios", type: "LIABILITY" as const },
    { code: "2525", name: "Vacaciones Consolidadas", type: "LIABILITY" as const },
    { code: "3", name: "PATRIMONIO", type: "EQUITY" as const },
    { code: "31", name: "Capital Social", type: "EQUITY" as const },
    { code: "3105", name: "Capital Suscrito y Pagado", type: "EQUITY" as const },
    { code: "3115", name: "Aportes Sociales", type: "EQUITY" as const },
    { code: "33", name: "Reservas", type: "EQUITY" as const },
    { code: "3305", name: "Reservas Obligatorias", type: "EQUITY" as const },
    { code: "36", name: "Resultados del Ejercicio", type: "EQUITY" as const },
    { code: "3605", name: "Utilidad del Ejercicio", type: "EQUITY" as const },
    { code: "3610", name: "Pérdida del Ejercicio", type: "EQUITY" as const },
    { code: "37", name: "Resultados de Ejercicios Anteriores", type: "EQUITY" as const },
    { code: "3705", name: "Utilidades Acumuladas", type: "EQUITY" as const },
    { code: "3710", name: "Pérdidas Acumuladas", type: "EQUITY" as const },
    { code: "4", name: "INGRESOS", type: "INCOME" as const },
    { code: "41", name: "Operacionales", type: "INCOME" as const },
    { code: "4135", name: "Comercio al por Mayor y al por Menor", type: "INCOME" as const },
    { code: "4175", name: "Servicios de Restaurante y Hotel", type: "INCOME" as const },
    { code: "42", name: "No Operacionales", type: "INCOME" as const },
    { code: "4210", name: "Financieros", type: "INCOME" as const },
    { code: "4250", name: "Recuperaciones", type: "INCOME" as const },
    { code: "5", name: "GASTOS", type: "EXPENSE" as const },
    { code: "51", name: "Operacionales de Administración", type: "EXPENSE" as const },
    { code: "5105", name: "Gastos de Personal", type: "EXPENSE" as const },
    { code: "5110", name: "Honorarios", type: "EXPENSE" as const },
    { code: "5115", name: "Impuestos", type: "EXPENSE" as const },
    { code: "5120", name: "Arrendamientos", type: "EXPENSE" as const },
    { code: "5130", name: "Seguros", type: "EXPENSE" as const },
    { code: "5135", name: "Servicios", type: "EXPENSE" as const },
    { code: "513505", name: "Aseo y Vigilancia", type: "EXPENSE" as const },
    { code: "513510", name: "Acueducto y Alcantarillado", type: "EXPENSE" as const },
    { code: "513515", name: "Energía Eléctrica", type: "EXPENSE" as const },
    { code: "513520", name: "Teléfono e Internet", type: "EXPENSE" as const },
    { code: "5140", name: "Gastos Legales", type: "EXPENSE" as const },
    { code: "5145", name: "Mantenimiento y Reparaciones", type: "EXPENSE" as const },
    { code: "5155", name: "Gastos de Viaje", type: "EXPENSE" as const },
    { code: "5160", name: "Depreciaciones", type: "EXPENSE" as const },
    { code: "5195", name: "Diversos", type: "EXPENSE" as const },
    { code: "52", name: "Operacionales de Ventas", type: "EXPENSE" as const },
    { code: "5205", name: "Gastos de Personal (Ventas)", type: "EXPENSE" as const },
    { code: "5235", name: "Servicios (Ventas)", type: "EXPENSE" as const },
    { code: "53", name: "No Operacionales", type: "EXPENSE" as const },
    { code: "5305", name: "Financieros", type: "EXPENSE" as const },
    { code: "530505", name: "Gastos Bancarios", type: "EXPENSE" as const },
    { code: "530515", name: "Comisiones", type: "EXPENSE" as const },
    { code: "6", name: "COSTOS DE VENTAS", type: "COST" as const },
    { code: "61", name: "Costo de Ventas y de Prestación de Servicios", type: "COST" as const },
    { code: "6135", name: "Comercio al por Mayor y al por Menor", type: "COST" as const },
    { code: "6170", name: "Actividades de Servicios", type: "COST" as const },
  ];

  for (const acc of accounts) {
    const existing = await prisma.account.findFirst({
      where: { companyId, code: acc.code },
    });
    if (!existing) {
      await prisma.account.create({ data: { companyId, ...acc } });
    }
  }

  // ===== Company settings (Colombian defaults) =====
  const settings = [
    { key: "business_name", value: company.name },
    { key: "business_nit", value: company.nit },
    { key: "business_address", value: company.address || "" },
    { key: "business_city", value: company.city || "" },
    { key: "business_department", value: company.department || "" },
    { key: "business_phone", value: company.phone || "" },
    { key: "tax_rate", value: "0.19" },
    { key: "tax_rate_reduced", value: "0.05" },
    { key: "tax_rate_exempt", value: "0" },
    { key: "currency", value: "COP" },
    { key: "locale", value: "es-CO" },
    { key: "invoice_prefix", value: "FE-" },
    { key: "invoice_next_number", value: "1" },
    { key: "iva_general", value: "0.19" },
    { key: "iva_reducido", value: "0.05" },
    { key: "iva_excluido", value: "0" },
    { key: "retefuente_rate", value: "0.025" },
    { key: "reteica_rate", value: "0.00414" },
    { key: "reteiva_rate", value: "0.15" },
  ];

  for (const s of settings) {
    const existing = await prisma.setting.findFirst({
      where: { companyId, key: s.key },
    });
    if (!existing) {
      await prisma.setting.create({ data: { companyId, ...s } });
    }
  }

  // ===== Default customer =====
  const defaultCustomer = await prisma.customer.findFirst({
    where: { companyId, nit: "222222222" },
  });
  if (!defaultCustomer) {
    await prisma.customer.create({
      data: {
        companyId,
        name: "Consumidor Final",
        nit: "222222222",
      },
    });
  }

  console.log("Base de datos inicializada correctamente");
  console.log("");
  console.log("Credenciales de acceso:");
  console.log("  Super Admin: master@sistema.com / master123");
  console.log("  Admin:       admin@miempresa.com / admin123");
  console.log("  Cajero:      cajero@miempresa.com / cajero123");
  console.log("  Mesero:      mesero@miempresa.com / mesero123");
  console.log("  Contador:    contador@miempresa.com / contador123");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
