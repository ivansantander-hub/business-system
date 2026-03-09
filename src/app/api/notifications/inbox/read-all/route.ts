import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getUserFromHeaders } from "@/lib/auth";

export async function PUT(request: Request) {
  const { userId, companyId } = getUserFromHeaders(request);
  if (!userId) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }
  if (!companyId) {
    return NextResponse.json({ error: "Contexto de empresa requerido" }, { status: 403 });
  }

  const result = await prisma.userNotification.updateMany({
    where: {
      userId,
      readAt: null,
      notification: { companyId },
    },
    data: { readAt: new Date() },
  });

  return NextResponse.json({ ok: true, count: result.count });
}
