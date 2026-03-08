import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getUserFromHeaders } from "@/lib/auth";

export async function GET(request: Request) {
  const { companyId, role } = getUserFromHeaders(request);
  if (!companyId) return NextResponse.json({ error: "Contexto de empresa requerido" }, { status: 403 });
  if (!["ADMIN", "SUPER_ADMIN"].includes(role || "")) return NextResponse.json({ error: "Sin permisos" }, { status: 403 });

  const { searchParams } = new URL(request.url);
  const q = searchParams.get("q") || "";
  const type = searchParams.get("type") || "all";

  if (q.length < 2) return NextResponse.json({ results: [] });

  const results: { type: string; id: string; label: string; subtitle?: string }[] = [];

  if (type === "all" || type === "Product") {
    const products = await prisma.product.findMany({
      where: {
        companyId,
        OR: [
          { name: { contains: q, mode: "insensitive" } },
          { barcode: { contains: q, mode: "insensitive" } },
        ],
      },
      select: { id: true, name: true, barcode: true },
      take: 10,
    });
    results.push(
      ...products.map((p) => ({
        type: "Product",
        id: p.id,
        label: p.name,
        subtitle: p.barcode || undefined,
      }))
    );
  }

  if (type === "all" || type === "Customer") {
    const customers = await prisma.customer.findMany({
      where: {
        companyId,
        OR: [
          { name: { contains: q, mode: "insensitive" } },
          { nit: { contains: q, mode: "insensitive" } },
        ],
      },
      select: { id: true, name: true, nit: true },
      take: 10,
    });
    results.push(
      ...customers.map((c) => ({
        type: "Customer",
        id: c.id,
        label: c.name,
        subtitle: c.nit || undefined,
      }))
    );
  }

  if (type === "all" || type === "Invoice") {
    const invoices = await prisma.invoice.findMany({
      where: { companyId, number: { contains: q, mode: "insensitive" } },
      select: { id: true, number: true, total: true, status: true },
      take: 10,
    });
    results.push(
      ...invoices.map((i) => ({
        type: "Invoice",
        id: i.id,
        label: `Factura ${i.number}`,
        subtitle: `$${Number(i.total).toLocaleString()} - ${i.status}`,
      }))
    );
  }

  if (type === "all" || type === "User") {
    const users = await prisma.user.findMany({
      where: {
        companies: { some: { companyId } },
        OR: [
          { name: { contains: q, mode: "insensitive" } },
          { email: { contains: q, mode: "insensitive" } },
        ],
      },
      select: { id: true, name: true, email: true },
      take: 10,
    });
    results.push(
      ...users.map((u) => ({
        type: "User",
        id: u.id,
        label: u.name,
        subtitle: u.email,
      }))
    );
  }

  if (type === "all" || type === "Purchase") {
    const purchases = await prisma.purchase.findMany({
      where: { companyId, number: { contains: q, mode: "insensitive" } },
      select: { id: true, number: true, total: true, status: true },
      take: 10,
    });
    results.push(
      ...purchases.map((p) => ({
        type: "Purchase",
        id: p.id,
        label: `Compra ${p.number}`,
        subtitle: `$${Number(p.total).toLocaleString()} - ${p.status}`,
      }))
    );
  }

  return NextResponse.json({ results });
}
