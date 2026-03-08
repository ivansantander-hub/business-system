import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getUserFromHeaders } from "@/lib/auth";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { companyId } = getUserFromHeaders(request);
  if (!companyId) return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  const { id } = await params;

  const invoice = await prisma.invoice.findFirst({
    where: { id, companyId },
    select: {
      id: true,
      number: true,
      cufe: true,
      qrCode: true,
      dianStatus: true,
      dianResponseDate: true,
      dianResponseMessage: true,
      xmlPath: true,
    },
  });
  if (!invoice)
    return NextResponse.json({ error: "Factura no encontrada" }, { status: 404 });
  return NextResponse.json(invoice);
}

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { companyId, role } = getUserFromHeaders(request);
  if (!companyId || !["ADMIN", "SUPER_ADMIN"].includes(role || ""))
    return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  const { id } = await params;
  const body = await request.json();

  const existing = await prisma.invoice.findFirst({
    where: { id, companyId },
    select: { id: true },
  });
  if (!existing)
    return NextResponse.json({ error: "Factura no encontrada" }, { status: 404 });

  const invoice = await prisma.invoice.update({
    where: { id },
    data: {
      dianStatus: body.dianStatus ?? undefined,
      dianResponseDate:
        body.dianStatus === "ACCEPTED" || body.dianStatus === "REJECTED"
          ? new Date()
          : undefined,
      dianResponseMessage: body.dianResponseMessage ?? undefined,
    },
  });
  return NextResponse.json(invoice);
}
