import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  // Admin user
  const hashedPassword = await bcrypt.hash("admin123", 10);
  await prisma.user.upsert({
    where: { email: "admin@sistema.com" },
    update: {},
    create: {
      name: "Administrador",
      email: "admin@sistema.com",
      password: hashedPassword,
      role: "ADMIN",
    },
  });

  // Cashier user
  const cashierPassword = await bcrypt.hash("cajero123", 10);
  await prisma.user.upsert({
    where: { email: "cajero@sistema.com" },
    update: {},
    create: {
      name: "Cajero Principal",
      email: "cajero@sistema.com",
      password: cashierPassword,
      role: "CASHIER",
    },
  });

  // Waiter user
  const waiterPassword = await bcrypt.hash("mesero123", 10);
  await prisma.user.upsert({
    where: { email: "mesero@sistema.com" },
    update: {},
    create: {
      name: "Mesero 1",
      email: "mesero@sistema.com",
      password: waiterPassword,
      role: "WAITER",
    },
  });

  // Categories
  const categories = ["General", "Alimentos", "Bebidas", "Postres", "Servicios"];
  for (const name of categories) {
    await prisma.category.upsert({
      where: { id: categories.indexOf(name) + 1 },
      update: {},
      create: { name },
    });
  }

  // Sample products
  const products = [
    { name: "Hamburguesa Clasica", categoryId: 2, costPrice: 15, salePrice: 35, stock: 50, unit: "unidad" },
    { name: "Pizza Mediana", categoryId: 2, costPrice: 20, salePrice: 55, stock: 30, unit: "unidad" },
    { name: "Ensalada Caesar", categoryId: 2, costPrice: 10, salePrice: 28, stock: 40, unit: "unidad" },
    { name: "Coca Cola 500ml", categoryId: 3, costPrice: 5, salePrice: 12, stock: 100, unit: "unidad" },
    { name: "Agua Pura 500ml", categoryId: 3, costPrice: 3, salePrice: 8, stock: 150, unit: "unidad" },
    { name: "Jugo Natural", categoryId: 3, costPrice: 8, salePrice: 18, stock: 60, unit: "unidad" },
    { name: "Pastel de Chocolate", categoryId: 4, costPrice: 12, salePrice: 25, stock: 20, unit: "unidad" },
    { name: "Flan", categoryId: 4, costPrice: 8, salePrice: 15, stock: 25, unit: "unidad" },
    { name: "Servicio de Delivery", categoryId: 5, costPrice: 0, salePrice: 15, stock: 9999, unit: "servicio" },
  ];

  for (const p of products) {
    const existing = await prisma.product.findFirst({ where: { name: p.name } });
    if (!existing) {
      await prisma.product.create({ data: p });
    }
  }

  // Restaurant tables
  for (let i = 1; i <= 12; i++) {
    await prisma.restaurantTable.upsert({
      where: { number: String(i) },
      update: {},
      create: {
        number: String(i),
        capacity: i <= 4 ? 2 : i <= 8 ? 4 : 6,
        section: i <= 4 ? "Interior" : i <= 8 ? "Terraza" : "VIP",
      },
    });
  }

  // Chart of accounts
  const accounts = [
    { code: "1", name: "ACTIVOS", type: "ASSET" as const },
    { code: "1.1", name: "Activos Corrientes", type: "ASSET" as const },
    { code: "1.1.1", name: "Caja", type: "ASSET" as const },
    { code: "1.1.2", name: "Banco", type: "ASSET" as const },
    { code: "1.1.3", name: "Cuentas por Cobrar", type: "ASSET" as const },
    { code: "1.1.4", name: "Inventario", type: "ASSET" as const },
    { code: "2", name: "PASIVOS", type: "LIABILITY" as const },
    { code: "2.1", name: "Pasivos Corrientes", type: "LIABILITY" as const },
    { code: "2.1.1", name: "Cuentas por Pagar", type: "LIABILITY" as const },
    { code: "2.1.2", name: "IVA por Pagar", type: "LIABILITY" as const },
    { code: "3", name: "PATRIMONIO", type: "EQUITY" as const },
    { code: "3.1", name: "Capital", type: "EQUITY" as const },
    { code: "4", name: "INGRESOS", type: "INCOME" as const },
    { code: "4.1", name: "Ventas", type: "INCOME" as const },
    { code: "4.2", name: "Otros Ingresos", type: "INCOME" as const },
    { code: "5", name: "GASTOS", type: "EXPENSE" as const },
    { code: "5.1", name: "Costo de Ventas", type: "EXPENSE" as const },
    { code: "5.2", name: "Gastos Operativos", type: "EXPENSE" as const },
    { code: "5.3", name: "Gastos Administrativos", type: "EXPENSE" as const },
  ];

  for (const acc of accounts) {
    await prisma.account.upsert({
      where: { code: acc.code },
      update: {},
      create: acc,
    });
  }

  // Default settings
  const settings = [
    { key: "business_name", value: "Mi Negocio" },
    { key: "business_nit", value: "12345678-9" },
    { key: "business_address", value: "Ciudad, Zona 1" },
    { key: "business_phone", value: "555-1234" },
    { key: "tax_rate", value: "0.12" },
    { key: "currency", value: "Q" },
    { key: "invoice_prefix", value: "FAC-" },
    { key: "invoice_next_number", value: "1" },
  ];

  for (const s of settings) {
    await prisma.setting.upsert({
      where: { key: s.key },
      update: {},
      create: s,
    });
  }

  // Default customer
  await prisma.customer.upsert({
    where: { id: 1 },
    update: {},
    create: {
      name: "Consumidor Final",
      nit: "CF",
    },
  });

  console.log("Base de datos inicializada correctamente");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
