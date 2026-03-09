import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getUserFromHeaders } from "@/lib/auth";

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { userId } = getUserFromHeaders(request);
  if (!userId) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const { id } = await params;

  await prisma.userNotification.updateMany({
    where: { userId, notificationId: id },
    data: { readAt: new Date() },
  });

  return NextResponse.json({ ok: true });
}
