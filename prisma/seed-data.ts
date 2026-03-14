/**
 * Seed Data - Generates 6 months of transactional data for 3 existing companies.
 * Run with: npx tsx prisma/seed-data.ts
 *
 * Companies (from base seed):
 * 1. Mi Empresa (RESTAURANT, NIT: 900123456-7) - Bogotá
 * 2. FitZone Gym (GYM, NIT: 901234567-8) - Medellín
 * 3. Mi Tienda Express (STORE, NIT: 900555666-7) - Cali
 */

import { PrismaClient, PaymentMethod } from "@prisma/client";

const prisma = new PrismaClient();

// Date range: 6 months ago to today
const END_DATE = new Date();
const START_DATE = new Date();
START_DATE.setDate(START_DATE.getDate() - 180);

function randomDate(start: Date, end: Date): Date {
  const ts = start.getTime() + Math.random() * (end.getTime() - start.getTime());
  return new Date(ts);
}

function addDays(date: Date, days: number): Date {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
}

function randomInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

// Colombian names for customers
const COLOMBIAN_FIRST_NAMES = [
  "Carlos", "Juan", "Andrés", "Luis", "Diego", "Santiago", "Mateo", "Daniel",
  "María", "Ana", "Laura", "Sofía", "Valentina", "Isabella", "Camila", "Lucía",
  "Fernanda", "Carolina", "Paula", "Natalia", "Alejandra", "Diana", "Claudia",
];
const COLOMBIAN_LAST_NAMES = [
  "García", "Rodríguez", "Martínez", "López", "González", "Hernández", "Pérez",
  "Sánchez", "Ramírez", "Torres", "Flórez", "Díaz", "Moreno", "Muñoz", "Rojas",
  "Vargas", "Castro", "Romero", "Suárez", "Mendoza", "Herrera", "Medina",
];

function randomColombianName(): string {
  return `${pick(COLOMBIAN_FIRST_NAMES)} ${pick(COLOMBIAN_LAST_NAMES)}`;
}

async function seedCompanyData(
  companyId: string,
  companyName: string,
  companyType: "RESTAURANT" | "GYM" | "STORE",
  invoicePrefix: string,
  purchasePrefix: string
) {
  const branches = await prisma.branch.findMany({ where: { companyId } });
  const branch = branches[0];
  if (!branch) {
    console.warn(`  No branch found for ${companyName}, skipping`);
    return;
  }

  const adminUser = await prisma.user.findFirst({
    where: {
      companies: { some: { companyId } },
      role: "ADMIN",
    },
  });
  const cashierUser = await prisma.user.findFirst({
    where: {
      companies: { some: { companyId } },
      role: { in: ["ADMIN", "CASHIER"] },
    },
  });
  const userId = adminUser?.id ?? cashierUser?.id;
  if (!userId) {
    console.warn(`  No user found for ${companyName}, skipping`);
    return;
  }

  const products = await prisma.product.findMany({
    where: { companyId },
    take: 20,
  });
  const accounts = await prisma.account.findMany({
    where: { companyId },
    take: 10,
  });

  // --- CUSTOMERS (10-15) ---
  try {
    const existingCount = await prisma.customer.count({ where: { companyId } });
    const targetCount = randomInt(10, 15);
    if (existingCount < targetCount) {
      const toCreate = targetCount - existingCount;
      for (let i = 0; i < toCreate; i++) {
        const nit = `900${100000000 + existingCount + i}-${(existingCount + i) % 10}`;
        const existingNit = await prisma.customer.findFirst({
          where: { companyId, nit },
        });
        if (!existingNit) {
          await prisma.customer.create({
            data: {
              companyId,
              name: randomColombianName(),
              nit,
              phone: `300-${randomInt(100, 999)}-${randomInt(1000, 9999)}`,
              email: `cliente${existingCount + i}@example.com`,
              address: `Calle ${randomInt(10, 150)} # ${randomInt(1, 100)}-${randomInt(10, 99)}`,
            },
          });
        }
      }
      console.log(`  Customers: created up to ${targetCount} total`);
    } else {
      console.log(`  Customers: already have ${existingCount}`);
    }
  } catch (e) {
    console.error(`  Customers error:`, e);
  }

  // --- SUPPLIERS (3-5) ---
  try {
    const supplierNames: Record<string, string[]> = {
      RESTAURANT: [
        "Distribuidora de Alimentos S.A.", "Carnes Premium Ltda", "Bebidas del Valle",
        "Insumos Gastronómicos", "Frutas y Verduras Frescas",
      ],
      GYM: [
        "BodyTech Suplementos", "Deportes & Más", "Nutrición Deportiva Pro",
        "Equipamiento Fitness Colombia", "Ropa Deportiva Nacional",
      ],
      STORE: [
        "Mayorista Papelería Nacional", "Distribuidora de Aseo", "Alimentos y Bebidas Mayorista",
        "Tecnología Express", "Insumos Generales Ltda",
      ],
    };
    const existingCount = await prisma.supplier.count({ where: { companyId } });
    const targetCount = randomInt(3, 5);
    if (existingCount < targetCount) {
      const names = supplierNames[companyType];
      for (let i = existingCount; i < targetCount; i++) {
        const name = names[i % names.length] + (i >= names.length ? ` ${i}` : "");
        const nit = `800${100000000 + i}-${i % 10}`;
        const existing = await prisma.supplier.findFirst({
          where: { companyId, name },
        });
        if (!existing) {
          await prisma.supplier.create({
            data: {
              companyId,
              name,
              nit,
              contactName: randomColombianName(),
              phone: `604-${randomInt(100, 999)}-${randomInt(1000, 9999)}`,
              email: `ventas${i}@proveedor.com`,
              address: `Carrera ${randomInt(10, 80)} # ${randomInt(20, 100)}-${randomInt(10, 99)}`,
            },
          });
        }
      }
      console.log(`  Suppliers: created up to ${targetCount} total`);
    } else {
      console.log(`  Suppliers: already have ${existingCount}`);
    }
  } catch (e) {
    console.error(`  Suppliers error:`, e);
  }

  // --- EMPLOYEES (5-8) ---
  try {
    const positions: Record<string, string[]> = {
      RESTAURANT: ["Mesero", "Cajero", "Cocinero", "Ayudante de cocina", "Supervisor", "Hostess"],
      GYM: ["Recepcionista", "Instructor", "Entrenador", "Limpieza", "Gerente", "Asistente"],
      STORE: ["Vendedor", "Cajero", "Almacenista", "Supervisor", "Auxiliar"],
    };
    const existingCount = await prisma.employee.count({ where: { companyId } });
    const targetCount = randomInt(5, 8);
    if (existingCount < targetCount) {
      const posList = positions[companyType];
      for (let i = existingCount; i < targetCount; i++) {
        const docNumber = `EMP-${String(1000 + i).padStart(4, "0")}`;
        const existing = await prisma.employee.findFirst({
          where: { companyId, docNumber },
        });
        if (!existing) {
          const startDate = randomDate(
            addDays(START_DATE, -365),
            addDays(START_DATE, -30)
          );
          await prisma.employee.create({
            data: {
              companyId,
              branchId: branch.id,
              firstName: pick(COLOMBIAN_FIRST_NAMES),
              lastName: pick(COLOMBIAN_LAST_NAMES),
              docType: "CC",
              docNumber,
              position: posList[i % posList.length],
              contractType: pick(["INDEFINITE", "FIXED"] as const),
              startDate,
              baseSalary: randomInt(1300000, 2500000),
              salaryType: "ORDINARY",
              workSchedule: "8-5",
              isActive: true,
              dependents: 0,
              voluntaryDeductions: 0,
              withholdingRate: 0,
              arlRiskLevel: 1,
              paymentMethod: "TRANSFER",
            },
          });
        }
      }
      console.log(`  Employees: created up to ${targetCount} total`);
    } else {
      console.log(`  Employees: already have ${existingCount}`);
    }
  } catch (e) {
    console.error(`  Employees error:`, e);
  }

  // --- INVOICES (150-250) - skip if already many ---
  try {
    const invoiceCount = await prisma.invoice.count({ where: { companyId } });
    if (invoiceCount >= 100) {
      console.log(`  Invoices: already have ${invoiceCount}, skipping`);
    } else {
      const targetCount = randomInt(150, 250);
      const lastInvoice = await prisma.invoice.findFirst({
        where: { companyId },
        orderBy: { number: "desc" },
      });
      let nextNum = 1;
      if (lastInvoice) {
        const match = lastInvoice.number.match(/\d+$/);
        if (match) nextNum = Number.parseInt(match[0], 10) + 1;
      }
      const paymentMethods: PaymentMethod[] = ["CASH", "CARD", "TRANSFER"];
      for (let i = 0; i < targetCount; i++) {
        const numStr = String(nextNum + i).padStart(3, "0");
        const number = `${invoicePrefix}${numStr}`;
        const date = randomDate(START_DATE, END_DATE);
        const itemCount = randomInt(1, 4);
        let subtotal = 0;
        const items: { productId: string; productName: string; quantity: number; unitPrice: number; total: number }[] = [];
        const usedProducts = new Set<string>();
        for (let j = 0; j < itemCount && products.length > 0; j++) {
          const prod = products[randomInt(0, products.length - 1)];
          if (usedProducts.has(prod.id)) continue;
          usedProducts.add(prod.id);
          const qty = randomInt(1, 5);
          const unitPrice = Number(prod.salePrice);
          const total = qty * unitPrice;
          subtotal += total;
          items.push({
            productId: prod.id,
            productName: prod.name,
            quantity: qty,
            unitPrice,
            total,
          });
        }
        if (items.length === 0 && products.length > 0) {
          const prod = products[0];
          const qty = randomInt(1, 5);
          const unitPrice = Number(prod.salePrice);
          const total = qty * unitPrice;
          subtotal = total;
          items.push({
            productId: prod.id,
            productName: prod.name,
            quantity: qty,
            unitPrice,
            total,
          });
        }
        const taxRate = 0.19;
        const tax = Math.round(subtotal * taxRate);
        const total = subtotal + tax;
        try {
          await prisma.invoice.create({
            data: {
              companyId,
              branchId: branch.id,
              userId,
              number,
              date,
              subtotal,
              taxRate,
              tax,
              discount: 0,
              total,
              paidAmount: total,
              changeAmount: 0,
              paymentMethod: pick(paymentMethods),
              status: "PAID",
              items: {
                create: items.map((it) => ({
                  productId: it.productId,
                  productName: it.productName,
                  quantity: it.quantity,
                  unitPrice: it.unitPrice,
                  total: it.total,
                })),
              },
            },
          });
        } catch (invErr: unknown) {
          if (invErr && typeof invErr === "object" && "code" in invErr && (invErr as { code: string }).code === "P2002") {
            // Unique constraint - skip
          } else {
            throw invErr;
          }
        }
      }
      console.log(`  Invoices: created ${targetCount}`);
    }
  } catch (e) {
    console.error(`  Invoices error:`, e);
  }

  // --- PURCHASES (20-40) ---
  try {
    const purchaseCount = await prisma.purchase.count({ where: { companyId } });
    if (purchaseCount >= 15) {
      console.log(`  Purchases: already have ${purchaseCount}, skipping`);
    } else {
      const suppliers = await prisma.supplier.findMany({ where: { companyId } });
      if (suppliers.length === 0) {
        console.log(`  Purchases: no suppliers, skipping`);
      } else {
        const targetCount = randomInt(20, 40);
        const lastPurchase = await prisma.purchase.findFirst({
          where: { number: { startsWith: purchasePrefix } },
          orderBy: { number: "desc" },
        });
        let nextNum = 1;
        if (lastPurchase) {
          const match = lastPurchase.number.match(/\d+$/);
          if (match) nextNum = Number.parseInt(match[0], 10) + 1;
        }
        for (let i = 0; i < targetCount; i++) {
          const number = `${purchasePrefix}${String(nextNum + i).padStart(3, "0")}`;
          const date = randomDate(START_DATE, END_DATE);
          const itemCount = randomInt(2, 5);
          let subtotal = 0;
          const itemData: { productId: string; quantity: number; unitPrice: number; total: number }[] = [];
          const usedProds = new Set<string>();
          for (let j = 0; j < itemCount && products.length > 0; j++) {
            const prod = products[randomInt(0, products.length - 1)];
            if (usedProds.has(prod.id)) continue;
            usedProds.add(prod.id);
            const qty = randomInt(5, 50);
            const unitPrice = Number(prod.costPrice) * (0.9 + Math.random() * 0.2);
            const total = Math.round(qty * unitPrice);
            subtotal += total;
            itemData.push({ productId: prod.id, quantity: qty, unitPrice, total });
          }
          if (itemData.length === 0 && products.length > 0) {
            const prod = products[0];
            const qty = randomInt(5, 50);
            const unitPrice = Number(prod.costPrice);
            const total = qty * unitPrice;
            subtotal = total;
            itemData.push({ productId: prod.id, quantity: qty, unitPrice, total });
          }
          const tax = Math.round(subtotal * 0.19);
          const total = subtotal + tax;
          try {
            await prisma.purchase.create({
              data: {
                companyId,
                branchId: branch.id,
                supplierId: pick(suppliers).id,
                userId,
                number,
                date,
                subtotal,
                tax,
                total,
                status: "RECEIVED",
                notes: `Orden de compra ${number}`,
                items: {
                  create: itemData.map((it) => ({
                    productId: it.productId,
                    quantity: it.quantity,
                    unitPrice: it.unitPrice,
                    total: it.total,
                  })),
                },
              },
            });
          } catch (purErr: unknown) {
            if (purErr && typeof purErr === "object" && "code" in purErr && (purErr as { code: string }).code === "P2002") {
              // skip duplicate number
            } else {
              throw purErr;
            }
          }
        }
        console.log(`  Purchases: created ${targetCount}`);
      }
    }
  } catch (e) {
    console.error(`  Purchases error:`, e);
  }

  // --- ORDERS (restaurant only, 100-200) ---
  if (companyType === "RESTAURANT") {
    try {
      const orderCount = await prisma.order.count({ where: { companyId } });
      if (orderCount >= 80) {
        console.log(`  Orders: already have ${orderCount}, skipping`);
      } else {
        const tables = await prisma.restaurantTable.findMany({
          where: { companyId },
          take: 12,
        });
        const customers = await prisma.customer.findMany({
          where: { companyId },
          take: 15,
        });
        const targetCount = randomInt(100, 200);
        for (let i = 0; i < targetCount; i++) {
          const createdAt = randomDate(START_DATE, END_DATE);
          const itemCount = randomInt(1, 4);
          let subtotal = 0;
          const itemData: { productId: string; quantity: number; unitPrice: number; total: number }[] = [];
          const usedProds = new Set<string>();
          for (let j = 0; j < itemCount && products.length > 0; j++) {
            const prod = products[randomInt(0, products.length - 1)];
            if (usedProds.has(prod.id)) continue;
            usedProds.add(prod.id);
            const qty = randomInt(1, 3);
            const unitPrice = Number(prod.salePrice);
            const total = qty * unitPrice;
            subtotal += total;
            itemData.push({ productId: prod.id, quantity: qty, unitPrice, total });
          }
          if (itemData.length === 0 && products.length > 0) {
            const prod = products[0];
            const qty = randomInt(1, 3);
            const unitPrice = Number(prod.salePrice);
            const total = qty * unitPrice;
            subtotal = total;
            itemData.push({ productId: prod.id, quantity: qty, unitPrice, total });
          }
          const tax = Math.round(subtotal * 0.19);
          const total = subtotal + tax;
          await prisma.order.create({
            data: {
              companyId,
              branchId: branch.id,
              tableId: tables.length > 0 ? pick(tables).id : null,
              customerId: customers.length > 0 && Math.random() > 0.5 ? pick(customers).id : null,
              userId,
              type: pick(["TABLE", "TAKEOUT"] as const),
              status: "PAID",
              subtotal,
              tax,
              discount: 0,
              total,
              createdAt,
              updatedAt: createdAt,
              items: {
                create: itemData.map((it) => ({
                  productId: it.productId,
                  quantity: it.quantity,
                  unitPrice: it.unitPrice,
                  total: it.total,
                  status: "DELIVERED" as const,
                })),
              },
            },
          });
        }
        console.log(`  Orders: created ${targetCount}`);
      }
    } catch (e) {
      console.error(`  Orders error:`, e);
    }
  }

  // --- INVENTORY MOVEMENTS (50-100) ---
  try {
    const moveCount = await prisma.inventoryMovement.count({ where: { companyId } });
    if (moveCount >= 40) {
      console.log(`  InventoryMovements: already have ${moveCount}, skipping`);
    } else {
      const targetCount = randomInt(50, 100);
      const types = ["IN", "OUT", "ADJUSTMENT"] as ("IN" | "OUT" | "ADJUSTMENT")[];
      for (let i = 0; i < targetCount && products.length > 0; i++) {
        const prod = products[randomInt(0, products.length - 1)];
        const type = pick(types);
        const qty = randomInt(1, 20);
        const prevStock = 100;
        let newStock: number;
        if (type === "IN") newStock = prevStock + qty;
        else if (type === "OUT") newStock = Math.max(0, prevStock - qty);
        else newStock = prevStock + (Math.random() > 0.5 ? qty : -qty);
        await prisma.inventoryMovement.create({
          data: {
            companyId,
            branchId: branch.id,
            productId: prod.id,
            userId,
            type,
            quantity: type === "OUT" ? -qty : qty,
            previousStock: prevStock,
            newStock: Math.max(0, newStock),
            reason: type === "IN" ? "Compra" : type === "OUT" ? "Venta" : "Ajuste de inventario",
            createdAt: randomDate(START_DATE, END_DATE),
          },
        });
      }
      console.log(`  InventoryMovements: created ${targetCount}`);
    }
  } catch (e) {
    console.error(`  InventoryMovements error:`, e);
  }

  // --- CASH SESSIONS (30-60) ---
  try {
    const sessionCount = await prisma.cashSession.count({ where: { companyId } });
    if (sessionCount >= 25) {
      console.log(`  CashSessions: already have ${sessionCount}, skipping`);
    } else {
      const targetCount = randomInt(30, 60);
      const dayMs = 24 * 60 * 60 * 1000;
      for (let i = 0; i < targetCount; i++) {
        const dayOffset = Math.floor((i / targetCount) * 180);
        const openedAt = new Date(START_DATE.getTime() + dayOffset * dayMs);
        openedAt.setHours(8, 0, 0, 0);
        const closedAt = new Date(openedAt);
        closedAt.setHours(20, 0, 0, 0);
        const openingAmount = randomInt(200000, 500000);
        const salesTotal = randomInt(50000, 500000);
        const closingAmount = openingAmount + salesTotal;
        await prisma.cashSession.create({
          data: {
            companyId,
            branchId: branch.id,
            userId,
            openingAmount,
            closingAmount,
            salesTotal,
            openedAt,
            closedAt,
            status: "CLOSED",
          },
        });
      }
      console.log(`  CashSessions: created ${targetCount}`);
    }
  } catch (e) {
    console.error(`  CashSessions error:`, e);
  }

  // --- EXPENSES (40-80) ---
  try {
    const expenseCount = await prisma.expense.count({ where: { companyId } });
    if (expenseCount >= 30) {
      console.log(`  Expenses: already have ${expenseCount}, skipping`);
    } else {
      const categories = ["Servicios", "Arriendos", "Mantenimiento", "Insumos", "Transporte"];
      const targetCount = randomInt(40, 80);
      for (let i = 0; i < targetCount; i++) {
        const category = categories[i % categories.length];
        const amount = randomInt(50000, 2000000);
        await prisma.expense.create({
          data: {
            companyId,
            branchId: branch.id,
            category,
            description: `Gasto de ${category} - ${category.toLowerCase()}`,
            amount,
            date: randomDate(START_DATE, END_DATE),
            paymentMethod: pick(["TRANSFER", "CASH"] as const),
            userId,
          },
        });
      }
      console.log(`  Expenses: created ${targetCount}`);
    }
  } catch (e) {
    console.error(`  Expenses error:`, e);
  }

  // --- PAYROLL RUNS (6 per company - monthly) ---
  try {
    const payrollCount = await prisma.payrollRun.count({ where: { companyId } });
    if (payrollCount >= 6) {
      console.log(`  PayrollRuns: already have ${payrollCount}, skipping`);
    } else {
      const employees = await prisma.employee.findMany({ where: { companyId } });
      if (employees.length === 0) {
        console.log(`  PayrollRuns: no employees, skipping`);
      } else {
        for (let m = 0; m < 6; m++) {
          const period = new Date(END_DATE);
          period.setMonth(period.getMonth() - (5 - m));
          period.setDate(1);
          period.setHours(0, 0, 0, 0);
          const periodStart = new Date(period);
          const periodEnd = new Date(period);
          periodEnd.setMonth(periodEnd.getMonth() + 1);
          periodEnd.setDate(0);
          let totalEarnings = 0;
          let totalDeductions = 0;
          let netPay = 0;
          const itemData: { employeeId: string; baseSalary: number; totalEarnings: number; totalDeductions: number; netPay: number }[] = [];
          for (const emp of employees) {
            const base = Number(emp.baseSalary);
            const deductions = base * 0.08;
            const net = base - deductions;
            totalEarnings += base;
            totalDeductions += deductions;
            netPay += net;
            itemData.push({
              employeeId: emp.id,
              baseSalary: base,
              totalEarnings: base,
              totalDeductions: deductions,
              netPay,
            });
          }
          const paidAt = new Date(period);
          paidAt.setDate(5);
          try {
            await prisma.payrollRun.create({
              data: {
                companyId,
                branchId: branch.id,
                period,
                periodStart,
                periodEnd,
                frequency: "MONTHLY",
                status: "PAID",
                totalEarnings,
                totalDeductions,
                totalEmployerCosts: 0,
                netPay,
                paidAt,
                items: {
                  create: itemData.map((it) => ({
                    employeeId: it.employeeId,
                    baseSalary: it.baseSalary,
                    daysWorked: 30,
                    totalEarnings: it.totalEarnings,
                    totalDeductions: it.totalDeductions,
                    employerCosts: 0,
                    netPay: it.netPay,
                  })),
                },
              },
            });
          } catch (prErr: unknown) {
            if (prErr && typeof prErr === "object" && "code" in prErr && (prErr as { code: string }).code === "P2002") {
              // duplicate period maybe
            } else {
              throw prErr;
            }
          }
        }
        console.log(`  PayrollRuns: created 6`);
      }
    }
  } catch (e) {
    console.error(`  PayrollRuns error:`, e);
  }

  // --- MEMBERSHIPS (gym only, 20-30) ---
  if (companyType === "GYM") {
    try {
      const membershipCount = await prisma.membership.count({ where: { companyId } });
      if (membershipCount >= 15) {
        console.log(`  Memberships: already have ${membershipCount}, skipping`);
      } else {
        const plans = await prisma.membershipPlan.findMany({ where: { companyId } });
        const customers = await prisma.customer.findMany({
          where: { companyId },
          take: 30,
        });
        if (plans.length === 0 || customers.length === 0) {
          console.log(`  Memberships: no plans or customers, skipping`);
        } else {
          const plan = plans.find((p) => p.durationDays >= 30) ?? plans[0];
          const targetCount = randomInt(20, 30);
          for (let i = 0; i < targetCount; i++) {
            const customer = customers[i % customers.length];
            let gymMember = await prisma.gymMember.findFirst({
              where: { companyId, customerId: customer.id },
            });
            if (!gymMember) {
              gymMember = await prisma.gymMember.create({
                data: {
                  companyId,
                  customerId: customer.id,
                  status: "ACTIVE",
                },
              });
            }
            const startDate = randomDate(START_DATE, END_DATE);
            const endDate = addDays(startDate, plan.durationDays);
            const status = endDate < END_DATE ? "EXPIRED" : "ACTIVE";
            try {
              await prisma.membership.create({
                data: {
                  companyId,
                  memberId: gymMember.id,
                  planId: plan.id,
                  startDate,
                  endDate,
                  status,
                  paymentStatus: "PAID",
                },
              });
            } catch (memErr: unknown) {
              if (memErr && typeof memErr === "object" && "code" in memErr && (memErr as { code: string }).code === "P2002") {
                // skip duplicate
              } else {
                throw memErr;
              }
            }
          }
          console.log(`  Memberships: created ${targetCount}`);
        }
      }
    } catch (e) {
      console.error(`  Memberships error:`, e);
    }

    // --- CHECK-INS (gym only) ---
    try {
      const checkInCount = await prisma.checkIn.count({ where: { companyId } });
      if (checkInCount >= 50) {
        console.log(`  CheckIns: already have ${checkInCount}, skipping`);
      } else {
        const gymMembers = await prisma.gymMember.findMany({
          where: { companyId },
          take: 25,
        });
        if (gymMembers.length > 0) {
          const targetCount = randomInt(80, 150);
          for (let i = 0; i < targetCount; i++) {
            const member = pick(gymMembers);
            const timestamp = randomDate(START_DATE, END_DATE);
            await prisma.checkIn.create({
              data: {
                companyId,
                memberId: member.id,
                timestamp,
                type: "ENTRY",
                method: "MEMBERSHIP",
              },
            });
          }
          console.log(`  CheckIns: created ${targetCount}`);
        }
      }
    } catch (e) {
      console.error(`  CheckIns error:`, e);
    }
  }

  // --- JOURNAL ENTRIES (20-40) ---
  try {
    const journalCount = await prisma.journalEntry.count({ where: { companyId } });
    if (journalCount >= 15) {
      console.log(`  JournalEntries: already have ${journalCount}, skipping`);
    } else if (accounts.length < 2) {
      console.log(`  JournalEntries: need at least 2 accounts, skipping`);
    } else {
      const targetCount = randomInt(20, 40);
      for (let i = 0; i < targetCount; i++) {
        const date = randomDate(START_DATE, END_DATE);
        const amount = randomInt(100000, 2000000);
        const acc1 = accounts[randomInt(0, accounts.length - 1)];
        let acc2 = accounts[randomInt(0, accounts.length - 1)];
        while (acc2.id === acc1.id) {
          acc2 = accounts[randomInt(0, accounts.length - 1)];
        }
        await prisma.journalEntry.create({
          data: {
            companyId,
            branchId: branch.id,
            date,
            description: `Asiento contable ${i + 1}`,
            reference: `REF-${String(i + 1).padStart(4, "0")}`,
            lines: {
              create: [
                { accountId: acc1.id, debit: amount, credit: 0, description: "Débito" },
                { accountId: acc2.id, debit: 0, credit: amount, description: "Crédito" },
              ],
            },
          },
        });
      }
      console.log(`  JournalEntries: created ${targetCount}`);
    }
  } catch (e) {
    console.error(`  JournalEntries error:`, e);
  }
}

async function main() {
  console.log("Creating tenant schema if not exists...");
  await prisma.$executeRawUnsafe("CREATE SCHEMA IF NOT EXISTS tenant");

  const restaurant = await prisma.company.findFirst({ where: { nit: "900123456-7" } });
  const gym = await prisma.company.findFirst({ where: { nit: "901234567-8" } });
  const store = await prisma.company.findFirst({ where: { nit: "900555666-7" } });

  if (!restaurant) {
    console.error("Company Mi Empresa (900123456-7) not found. Run base seed first: pnpm db:seed");
    process.exit(1);
  }
  if (!gym) {
    console.error("Company FitZone Gym (901234567-8) not found. Run base seed first: pnpm db:seed");
    process.exit(1);
  }
  if (!store) {
    console.error("Company Mi Tienda Express (900555666-7) not found. Run base seed first: pnpm db:seed");
    process.exit(1);
  }

  console.log(`\nDate range: ${START_DATE.toISOString().split("T")[0]} to ${END_DATE.toISOString().split("T")[0]}\n`);

  // Purchase numbers must be globally unique - use distinct prefixes
  console.log("=== Mi Empresa (Restaurant) ===");
  await seedCompanyData(
    restaurant.id,
    "Mi Empresa",
    "RESTAURANT",
    "FE-",
    "OC-ME-"
  );

  console.log("\n=== FitZone Gym ===");
  await seedCompanyData(
    gym.id,
    "FitZone Gym",
    "GYM",
    "FZ-",
    "OC-FZ-"
  );

  console.log("\n=== Mi Tienda Express ===");
  await seedCompanyData(
    store.id,
    "Mi Tienda Express",
    "STORE",
    "MT-",
    "OC-MT-"
  );

  console.log("\n✓ Seed data generation complete.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
