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
        type: "RESTAURANT",
      },
    });
  }

  const companyId = company.id;

  // ===== Branches =====
  const branch1 = await prisma.branch.upsert({
    where: { id: "00000000-0000-4000-8000-000000000001" },
    update: {},
    create: {
      id: "00000000-0000-4000-8000-000000000001",
      companyId,
      name: "Sede Principal",
      address: "Calle 100 # 15-20",
      city: "Bogotá",
      phone: "601-555-1234",
    },
  });

  const branch2 = await prisma.branch.upsert({
    where: { id: "00000000-0000-4000-8000-000000000002" },
    update: {},
    create: {
      id: "00000000-0000-4000-8000-000000000002",
      companyId,
      name: "Sede Norte",
      address: "Calle 170 # 30-40",
      city: "Bogotá",
      phone: "601-555-5678",
    },
  });

  // ===== Company users with UserCompany assignments =====
  const userDefs = [
    { name: "Administrador", email: "admin@miempresa.com", password: "admin123", role: "ADMIN" as const },
    { name: "Cajero Principal", email: "cajero@miempresa.com", password: "cajero123", role: "CASHIER" as const },
    { name: "Mesero 1", email: "mesero@miempresa.com", password: "mesero123", role: "WAITER" as const },
    { name: "Contador", email: "contador@miempresa.com", password: "contador123", role: "ACCOUNTANT" as const },
  ];

  const adminUser = await prisma.user.upsert({
    where: { email: "admin@miempresa.com" },
    update: {},
    create: {
      name: "Administrador",
      email: "admin@miempresa.com",
      password: await bcrypt.hash("admin123", 10),
      role: "ADMIN",
    },
  });
  const cajeroUser = await prisma.user.upsert({
    where: { email: "cajero@miempresa.com" },
    update: {},
    create: {
      name: "Cajero Principal",
      email: "cajero@miempresa.com",
      password: await bcrypt.hash("cajero123", 10),
      role: "CASHIER",
    },
  });
  const meseroUser = await prisma.user.upsert({
    where: { email: "mesero@miempresa.com" },
    update: {},
    create: {
      name: "Mesero 1",
      email: "mesero@miempresa.com",
      password: await bcrypt.hash("mesero123", 10),
      role: "WAITER",
    },
  });
  const contadorUser = await prisma.user.upsert({
    where: { email: "contador@miempresa.com" },
    update: {},
    create: {
      name: "Contador",
      email: "contador@miempresa.com",
      password: await bcrypt.hash("contador123", 10),
      role: "ACCOUNTANT",
    },
  });

  for (const [user, def] of [
    [adminUser, userDefs[0]],
    [cajeroUser, userDefs[1]],
    [meseroUser, userDefs[2]],
    [contadorUser, userDefs[3]],
  ] as const) {
    const existing = await prisma.userCompany.findUnique({
      where: { userId_companyId: { userId: user.id, companyId } },
    });
    if (!existing) {
      await prisma.userCompany.create({
        data: { userId: user.id, companyId, role: def.role },
      });
    }
  }

  // Assign users to branches
  for (const ub of [
    { userId: adminUser.id, branchId: branch1.id },
    { userId: adminUser.id, branchId: branch2.id },
    { userId: cajeroUser.id, branchId: branch1.id },
    { userId: cajeroUser.id, branchId: branch2.id },
    { userId: meseroUser.id, branchId: branch1.id },
  ]) {
    await prisma.userBranch.upsert({
      where: { userId_branchId: { userId: ub.userId, branchId: ub.branchId } },
      update: {},
      create: ub,
    });
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

  const catMap: Record<string, string | null> = {
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
          branchId: branch1.id,
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

  // ===== Restaurant tables (assigned to branch1) =====
  for (let i = 1; i <= 12; i++) {
    const existing = await prisma.restaurantTable.findFirst({
      where: { companyId, number: String(i) },
    });
    if (!existing) {
      await prisma.restaurantTable.create({
        data: {
          companyId,
          branchId: branch1.id,
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

  // ===== GYM company =====
  let gymCompany = await prisma.company.findFirst({ where: { nit: "901234567-8" } });
  if (!gymCompany) {
    gymCompany = await prisma.company.create({
      data: {
        name: "FitZone Gym",
        legalName: "FitZone Gym S.A.S.",
        nit: "901234567-8",
        address: "Carrera 50 # 72-35",
        city: "Medellín",
        department: "Antioquia",
        phone: "604-444-5678",
        email: "info@fitzonegym.com",
        taxRegime: "Responsable de IVA",
        type: "GYM",
      },
    });
  }
  const gymCompanyId = gymCompany.id;

  // Gym default branch
  const gymBranch = await prisma.branch.upsert({
    where: { id: "00000000-0000-4000-8000-000000000010" },
    update: {},
    create: {
      id: "00000000-0000-4000-8000-000000000010",
      companyId: gymCompanyId,
      name: "Sede Principal",
      address: "Carrera 50 # 72-35",
      city: "Medellín",
      phone: "604-444-5678",
    },
  });

  // Gym admin user
  const gymAdmin = await prisma.user.upsert({
    where: { email: "admin@fitzonegym.com" },
    update: {},
    create: {
      name: "Admin Gym",
      email: "admin@fitzonegym.com",
      password: await bcrypt.hash("admin123", 10),
      role: "ADMIN",
    },
  });
  const gymCajero = await prisma.user.upsert({
    where: { email: "cajero@fitzonegym.com" },
    update: {},
    create: {
      name: "Cajero Gym",
      email: "cajero@fitzonegym.com",
      password: await bcrypt.hash("cajero123", 10),
      role: "CASHIER",
    },
  });
  const gymInstructor = await prisma.user.upsert({
    where: { email: "instructor@fitzonegym.com" },
    update: {},
    create: {
      name: "Carlos Instructor",
      email: "instructor@fitzonegym.com",
      password: await bcrypt.hash("instructor123", 10),
      role: "WAITER",
    },
  });

  // Assign gym users to company
  for (const [user, role] of [[gymAdmin, "ADMIN"], [gymCajero, "CASHIER"], [gymInstructor, "WAITER"]] as const) {
    const existing = await prisma.userCompany.findUnique({
      where: { userId_companyId: { userId: user.id, companyId: gymCompanyId } },
    });
    if (!existing) {
      await prisma.userCompany.create({
        data: { userId: user.id, companyId: gymCompanyId, role },
      });
    }
  }

  // Assign gym users to branch
  for (const userId of [gymAdmin.id, gymCajero.id, gymInstructor.id]) {
    await prisma.userBranch.upsert({
      where: { userId_branchId: { userId, branchId: gymBranch.id } },
      update: {},
      create: { userId, branchId: gymBranch.id },
    });
  }

  // Gym categories
  const gymCategories = ["General", "Suplementos", "Accesorios", "Ropa Deportiva", "Equipamiento"];
  for (const name of gymCategories) {
    const existing = await prisma.category.findFirst({ where: { companyId: gymCompanyId, name } });
    if (!existing) {
      await prisma.category.create({ data: { companyId: gymCompanyId, name } });
    }
  }

  // Gym products
  const gymCatSupl = await prisma.category.findFirst({ where: { companyId: gymCompanyId, name: "Suplementos" } });
  const gymCatAcc = await prisma.category.findFirst({ where: { companyId: gymCompanyId, name: "Accesorios" } });
  const gymCatRopa = await prisma.category.findFirst({ where: { companyId: gymCompanyId, name: "Ropa Deportiva" } });
  const gymCatEquip = await prisma.category.findFirst({ where: { companyId: gymCompanyId, name: "Equipamiento" } });

  const gymProducts = [
    { name: "Proteína Whey 2lb", costPrice: 85000, salePrice: 130000, stock: 40, unit: "unidad", taxRate: 0.19, catId: gymCatSupl?.id },
    { name: "Creatina 300g", costPrice: 45000, salePrice: 75000, stock: 30, unit: "unidad", taxRate: 0.19, catId: gymCatSupl?.id },
    { name: "BCAA 60 caps", costPrice: 35000, salePrice: 55000, stock: 25, unit: "unidad", taxRate: 0.19, catId: gymCatSupl?.id },
    { name: "Pre-entreno 30 serv", costPrice: 55000, salePrice: 90000, stock: 20, unit: "unidad", taxRate: 0.19, catId: gymCatSupl?.id },
    { name: "Guantes de Entrenamiento", costPrice: 18000, salePrice: 35000, stock: 15, unit: "par", taxRate: 0.19, catId: gymCatAcc?.id },
    { name: "Correa para Pesas", costPrice: 12000, salePrice: 25000, stock: 20, unit: "unidad", taxRate: 0.19, catId: gymCatAcc?.id },
    { name: "Shaker Botella 700ml", costPrice: 8000, salePrice: 18000, stock: 35, unit: "unidad", taxRate: 0.19, catId: gymCatAcc?.id },
    { name: "Camiseta Gym FitZone", costPrice: 20000, salePrice: 45000, stock: 50, unit: "unidad", taxRate: 0.19, catId: gymCatRopa?.id },
    { name: "Pantaloneta Deportiva", costPrice: 15000, salePrice: 35000, stock: 40, unit: "unidad", taxRate: 0.19, catId: gymCatRopa?.id },
    { name: "Banda Elástica Set x3", costPrice: 10000, salePrice: 22000, stock: 30, unit: "set", taxRate: 0.19, catId: gymCatEquip?.id },
    { name: "Agua 600ml", costPrice: 800, salePrice: 2500, stock: 200, unit: "unidad", taxRate: 0.19, catId: null },
    { name: "Bebida Isotónica", costPrice: 2500, salePrice: 5000, stock: 80, unit: "unidad", taxRate: 0.19, catId: null },
  ];

  for (const p of gymProducts) {
    const existing = await prisma.product.findFirst({ where: { companyId: gymCompanyId, name: p.name } });
    if (!existing) {
      await prisma.product.create({
        data: {
          companyId: gymCompanyId,
          branchId: gymBranch.id,
          name: p.name,
          categoryId: p.catId ?? null,
          costPrice: p.costPrice,
          salePrice: p.salePrice,
          stock: p.stock,
          unit: p.unit,
          taxRate: p.taxRate,
        },
      });
    }
  }

  // Gym membership plans
  const gymPlans = [
    { name: "Pase Diario", durationDays: 1, price: 15000, description: "Acceso por un día" },
    { name: "Quincenal", durationDays: 15, price: 50000, description: "Acceso por 15 días" },
    { name: "Mensual", durationDays: 30, price: 80000, description: "Acceso ilimitado por 30 días" },
    { name: "Trimestral", durationDays: 90, price: 200000, description: "Acceso ilimitado por 3 meses" },
    { name: "Semestral", durationDays: 180, price: 350000, description: "Acceso ilimitado por 6 meses" },
    { name: "Anual", durationDays: 365, price: 600000, description: "Acceso ilimitado por 1 año" },
  ];

  for (const plan of gymPlans) {
    const existing = await prisma.membershipPlan.findFirst({ where: { companyId: gymCompanyId, name: plan.name } });
    if (!existing) {
      await prisma.membershipPlan.create({ data: { companyId: gymCompanyId, ...plan } });
    }
  }

  // Gym customers (members)
  const gymCustomers = [
    { name: "María García", nit: "1098765432", phone: "300-123-4567", email: "maria@email.com" },
    { name: "Juan Pérez", nit: "1087654321", phone: "301-234-5678", email: "juan@email.com" },
    { name: "Laura Martínez", nit: "1076543210", phone: "302-345-6789", email: "laura@email.com" },
    { name: "Consumidor Final", nit: "222222222", phone: null, email: null },
  ];

  for (const c of gymCustomers) {
    const existing = await prisma.customer.findFirst({ where: { companyId: gymCompanyId, nit: c.nit! } });
    if (!existing) {
      await prisma.customer.create({ data: { companyId: gymCompanyId, ...c } });
    }
  }

  // Gym suppliers
  const gymSuppliers = [
    { name: "BodyTech Suplementos", nit: "800111222-3", phone: "604-111-2222", email: "ventas@bodytech.co" },
    { name: "Deportes & Más", nit: "800333444-5", phone: "604-333-4444", email: "ventas@deportesmas.co" },
  ];

  for (const s of gymSuppliers) {
    const existing = await prisma.supplier.findFirst({ where: { companyId: gymCompanyId, nit: s.nit } });
    if (!existing) {
      await prisma.supplier.create({ data: { companyId: gymCompanyId, ...s } });
    }
  }

  // Gym PUC accounts (same structure as restaurant)
  const gymAccounts = [
    { code: "1", name: "ACTIVO", type: "ASSET" as const },
    { code: "11", name: "Disponible", type: "ASSET" as const },
    { code: "1105", name: "Caja", type: "ASSET" as const },
    { code: "110505", name: "Caja General", type: "ASSET" as const },
    { code: "1110", name: "Bancos", type: "ASSET" as const },
    { code: "111005", name: "Moneda Nacional", type: "ASSET" as const },
    { code: "13", name: "Deudores", type: "ASSET" as const },
    { code: "1305", name: "Clientes", type: "ASSET" as const },
    { code: "130505", name: "Clientes Nacionales", type: "ASSET" as const },
    { code: "14", name: "Inventarios", type: "ASSET" as const },
    { code: "1435", name: "Mercancías no Fabricadas por la Empresa", type: "ASSET" as const },
    { code: "2", name: "PASIVO", type: "LIABILITY" as const },
    { code: "22", name: "Proveedores", type: "LIABILITY" as const },
    { code: "2205", name: "Proveedores Nacionales", type: "LIABILITY" as const },
    { code: "24", name: "Impuestos, Gravámenes y Tasas", type: "LIABILITY" as const },
    { code: "240801", name: "IVA Generado 19%", type: "LIABILITY" as const },
    { code: "3", name: "PATRIMONIO", type: "EQUITY" as const },
    { code: "31", name: "Capital Social", type: "EQUITY" as const },
    { code: "3105", name: "Capital Suscrito y Pagado", type: "EQUITY" as const },
    { code: "36", name: "Resultados del Ejercicio", type: "EQUITY" as const },
    { code: "3605", name: "Utilidad del Ejercicio", type: "EQUITY" as const },
    { code: "4", name: "INGRESOS", type: "INCOME" as const },
    { code: "41", name: "Operacionales", type: "INCOME" as const },
    { code: "4135", name: "Comercio al por Mayor y al por Menor", type: "INCOME" as const },
    { code: "42", name: "No Operacionales", type: "INCOME" as const },
    { code: "4250", name: "Recuperaciones", type: "INCOME" as const },
    { code: "5", name: "GASTOS", type: "EXPENSE" as const },
    { code: "51", name: "Operacionales de Administración", type: "EXPENSE" as const },
    { code: "5105", name: "Gastos de Personal", type: "EXPENSE" as const },
    { code: "5135", name: "Servicios", type: "EXPENSE" as const },
    { code: "5195", name: "Diversos", type: "EXPENSE" as const },
    { code: "6", name: "COSTOS DE VENTAS", type: "COST" as const },
    { code: "61", name: "Costo de Ventas y de Prestación de Servicios", type: "COST" as const },
    { code: "6135", name: "Comercio al por Mayor y al por Menor", type: "COST" as const },
  ];

  for (const acc of gymAccounts) {
    const existing = await prisma.account.findFirst({ where: { companyId: gymCompanyId, code: acc.code } });
    if (!existing) {
      await prisma.account.create({ data: { companyId: gymCompanyId, ...acc } });
    }
  }

  // Gym settings
  const gymSettings = [
    { key: "business_name", value: gymCompany.name },
    { key: "business_nit", value: gymCompany.nit },
    { key: "tax_rate", value: "0.19" },
    { key: "currency", value: "COP" },
    { key: "locale", value: "es-CO" },
    { key: "invoice_prefix", value: "FZ-" },
    { key: "invoice_next_number", value: "1" },
  ];

  for (const s of gymSettings) {
    const existing = await prisma.setting.findFirst({ where: { companyId: gymCompanyId, key: s.key } });
    if (!existing) {
      await prisma.setting.create({ data: { companyId: gymCompanyId, ...s } });
    }
  }

  // ===== STORE company (Mi Tienda Express) =====
  let storeCompany = await prisma.company.findFirst({ where: { nit: "900555666-7" } });
  if (!storeCompany) {
    storeCompany = await prisma.company.create({
      data: {
        name: "Mi Tienda Express",
        legalName: "Mi Tienda Express S.A.S.",
        nit: "900555666-7",
        address: "Calle 45 # 23-10",
        city: "Cali",
        department: "Valle del Cauca",
        phone: "602-555-9012",
        email: "info@mitienda.com",
        taxRegime: "Responsable de IVA",
        type: "STORE",
        economicActivity: "4711 - Comercio al por menor",
      },
    });
  }
  const storeCompanyId = storeCompany.id;

  // Store default branch
  const storeBranch = await prisma.branch.upsert({
    where: { id: "00000000-0000-4000-8000-000000000020" },
    update: {},
    create: {
      id: "00000000-0000-4000-8000-000000000020",
      companyId: storeCompanyId,
      name: "Sede Principal",
      address: "Calle 45 # 23-10",
      city: "Cali",
      phone: "602-555-9012",
    },
  });

  // Store admin user (password: Admin123!, same hash pattern as other admins)
  const storeAdmin = await prisma.user.upsert({
    where: { email: "admin@mitienda.com" },
    update: {},
    create: {
      name: "Admin Tienda",
      email: "admin@mitienda.com",
      password: await bcrypt.hash("Admin123!", 10),
      role: "ADMIN",
    },
  });

  // UserCompany linking
  const storeUserCompanyExisting = await prisma.userCompany.findUnique({
    where: { userId_companyId: { userId: storeAdmin.id, companyId: storeCompanyId } },
  });
  if (!storeUserCompanyExisting) {
    await prisma.userCompany.create({
      data: { userId: storeAdmin.id, companyId: storeCompanyId, role: "ADMIN" },
    });
  }

  // UserBranch linking
  await prisma.userBranch.upsert({
    where: { userId_branchId: { userId: storeAdmin.id, branchId: storeBranch.id } },
    update: {},
    create: { userId: storeAdmin.id, branchId: storeBranch.id },
  });

  // Store categories
  const storeCategories = ["Papelería", "Aseo", "Alimentos", "Bebidas", "Tecnología"];
  for (const name of storeCategories) {
    const existing = await prisma.category.findFirst({ where: { companyId: storeCompanyId, name } });
    if (!existing) {
      await prisma.category.create({ data: { companyId: storeCompanyId, name } });
    }
  }

  // Store products
  const storeCatPapeleria = await prisma.category.findFirst({ where: { companyId: storeCompanyId, name: "Papelería" } });
  const storeCatAseo = await prisma.category.findFirst({ where: { companyId: storeCompanyId, name: "Aseo" } });
  const storeCatAlimentos = await prisma.category.findFirst({ where: { companyId: storeCompanyId, name: "Alimentos" } });
  const storeCatBebidas = await prisma.category.findFirst({ where: { companyId: storeCompanyId, name: "Bebidas" } });
  const storeCatTecno = await prisma.category.findFirst({ where: { companyId: storeCompanyId, name: "Tecnología" } });

  const storeProducts = [
    { name: "Cuaderno Argollado", costPrice: 5000, salePrice: 8500, stock: 80, unit: "unidad", taxRate: 0.19, catId: storeCatPapeleria?.id },
    { name: "Lapicero BIC", costPrice: 700, salePrice: 1200, stock: 150, unit: "unidad", taxRate: 0.19, catId: storeCatPapeleria?.id },
    { name: "Detergente 500g", costPrice: 4000, salePrice: 6800, stock: 60, unit: "unidad", taxRate: 0.19, catId: storeCatAseo?.id },
    { name: "Jabón de Manos", costPrice: 2500, salePrice: 4500, stock: 70, unit: "unidad", taxRate: 0.19, catId: storeCatAseo?.id },
    { name: "Galletas Festival", costPrice: 1200, salePrice: 2000, stock: 100, unit: "unidad", taxRate: 0.19, catId: storeCatAlimentos?.id },
    { name: "Gaseosa 350ml", costPrice: 1500, salePrice: 2500, stock: 120, unit: "unidad", taxRate: 0.19, catId: storeCatBebidas?.id },
    { name: "Cargador USB", costPrice: 9000, salePrice: 15000, stock: 25, unit: "unidad", taxRate: 0.19, catId: storeCatTecno?.id },
    { name: "Pilas AA x2", costPrice: 3000, salePrice: 5000, stock: 90, unit: "unidad", taxRate: 0.19, catId: storeCatTecno?.id },
  ];

  for (const p of storeProducts) {
    const existing = await prisma.product.findFirst({ where: { companyId: storeCompanyId, name: p.name } });
    if (!existing) {
      await prisma.product.create({
        data: {
          companyId: storeCompanyId,
          branchId: storeBranch.id,
          name: p.name,
          categoryId: p.catId ?? null,
          costPrice: p.costPrice,
          salePrice: p.salePrice,
          stock: p.stock,
          unit: p.unit,
          taxRate: p.taxRate,
        },
      });
    }
  }

  // Store PUC accounts (1105, 1305, 2205, 2365, 2404, 4135, 5105, 5195, 5305, 2505, 2510 + parents)
  const storeAccounts = [
    { code: "1", name: "ACTIVO", type: "ASSET" as const },
    { code: "11", name: "Disponible", type: "ASSET" as const },
    { code: "1105", name: "Caja", type: "ASSET" as const },
    { code: "13", name: "Deudores", type: "ASSET" as const },
    { code: "1305", name: "Clientes", type: "ASSET" as const },
    { code: "2", name: "PASIVO", type: "LIABILITY" as const },
    { code: "22", name: "Proveedores", type: "LIABILITY" as const },
    { code: "2205", name: "Proveedores Nacionales", type: "LIABILITY" as const },
    { code: "23", name: "Cuentas por Pagar", type: "LIABILITY" as const },
    { code: "2365", name: "Retención en la Fuente", type: "LIABILITY" as const },
    { code: "24", name: "Impuestos, Gravámenes y Tasas", type: "LIABILITY" as const },
    { code: "2404", name: "IVA por Pagar", type: "LIABILITY" as const },
    { code: "25", name: "Obligaciones Laborales", type: "LIABILITY" as const },
    { code: "2505", name: "Salarios por Pagar", type: "LIABILITY" as const },
    { code: "2510", name: "Cesantías Consolidadas", type: "LIABILITY" as const },
    { code: "4", name: "INGRESOS", type: "INCOME" as const },
    { code: "41", name: "Operacionales", type: "INCOME" as const },
    { code: "4135", name: "Comercio al por Mayor y al por Menor", type: "INCOME" as const },
    { code: "5", name: "GASTOS", type: "EXPENSE" as const },
    { code: "51", name: "Operacionales de Administración", type: "EXPENSE" as const },
    { code: "5105", name: "Gastos de Personal", type: "EXPENSE" as const },
    { code: "5195", name: "Diversos", type: "EXPENSE" as const },
    { code: "53", name: "No Operacionales", type: "EXPENSE" as const },
    { code: "5305", name: "Financieros", type: "EXPENSE" as const },
  ];

  for (const acc of storeAccounts) {
    const existing = await prisma.account.findFirst({ where: { companyId: storeCompanyId, code: acc.code } });
    if (!existing) {
      await prisma.account.create({ data: { companyId: storeCompanyId, ...acc } });
    }
  }

  // Store settings
  const storeSettings = [
    { key: "business_name", value: storeCompany.name },
    { key: "business_nit", value: storeCompany.nit },
    { key: "business_address", value: storeCompany.address || "" },
    { key: "business_city", value: storeCompany.city || "" },
    { key: "business_department", value: storeCompany.department || "" },
    { key: "business_phone", value: storeCompany.phone || "" },
    { key: "tax_rate", value: "0.19" },
    { key: "currency", value: "COP" },
    { key: "locale", value: "es-CO" },
    { key: "invoice_prefix", value: "MT-" },
    { key: "invoice_next_number", value: "1" },
  ];

  for (const s of storeSettings) {
    const existing = await prisma.setting.findFirst({ where: { companyId: storeCompanyId, key: s.key } });
    if (!existing) {
      await prisma.setting.create({ data: { companyId: storeCompanyId, ...s } });
    }
  }

  console.log("Base de datos inicializada correctamente");
  console.log("");
  console.log("Credenciales de acceso:");
  console.log("  Super Admin: master@sistema.com / master123");
  console.log("  Admin:       admin@miempresa.com / admin123");
  console.log("  Cajero:      cajero@miempresa.com / cajero123");
  console.log("  Mesero:      mesero@miempresa.com / mesero123");
  console.log("  Contador:    contador@miempresa.com / contador123");
  console.log("  --- FitZone Gym ---");
  console.log("  Admin Gym:      admin@fitzonegym.com / admin123");
  console.log("  Cajero Gym:     cajero@fitzonegym.com / cajero123");
  console.log("  Instructor:     instructor@fitzonegym.com / instructor123");
  console.log("  --- Mi Tienda Express ---");
  console.log("  Admin Tienda:   admin@mitienda.com / Admin123!");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
