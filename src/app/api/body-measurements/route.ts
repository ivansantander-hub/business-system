import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getUserFromHeaders } from "@/lib/auth";

export async function GET(request: Request) {
  const { companyId } = getUserFromHeaders(request);
  if (!companyId) return NextResponse.json({ error: "Contexto de empresa requerido" }, { status: 403 });

  const { searchParams } = new URL(request.url);
  const memberId = searchParams.get("memberId");

  const where: { companyId: string; memberId?: string } = { companyId };
  if (memberId) where.memberId = memberId;

  const measurements = await prisma.bodyMeasurement.findMany({
    where,
    include: { member: { include: { customer: true } } },
    orderBy: { date: "desc" },
  });

  return NextResponse.json(measurements);
}

export async function POST(request: Request) {
  const { companyId, userId } = getUserFromHeaders(request);
  if (!companyId) return NextResponse.json({ error: "Contexto de empresa requerido" }, { status: 403 });

  const body = await request.json();
  const {
    memberId,
    weight,
    height,
    bodyFat,
    chest,
    waist,
    hips,
    leftArm,
    rightArm,
    leftThigh,
    rightThigh,
    notes,
  } = body;

  if (!memberId) return NextResponse.json({ error: "memberId requerido" }, { status: 400 });

  const measurement = await prisma.bodyMeasurement.create({
    data: {
      companyId,
      memberId,
      measuredById: userId,
      weight: weight != null ? Number(weight) : undefined,
      height: height != null ? Number(height) : undefined,
      bodyFat: bodyFat != null ? Number(bodyFat) : undefined,
      chest: chest != null ? Number(chest) : undefined,
      waist: waist != null ? Number(waist) : undefined,
      hips: hips != null ? Number(hips) : undefined,
      leftArm: leftArm != null ? Number(leftArm) : undefined,
      rightArm: rightArm != null ? Number(rightArm) : undefined,
      leftThigh: leftThigh != null ? Number(leftThigh) : undefined,
      rightThigh: rightThigh != null ? Number(rightThigh) : undefined,
      notes: notes || undefined,
    },
    include: { member: { include: { customer: true } } },
  });

  return NextResponse.json(measurement, { status: 201 });
}
