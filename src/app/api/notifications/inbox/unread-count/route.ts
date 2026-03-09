import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getUserFromHeaders } from "@/lib/auth";

export async function GET(request: Request) {
  const { userId, companyId } = getUserFromHeaders(request);
  if (!userId) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  if (!companyId) {
    return NextResponse.json({ count: 0 });
  }

  const count = await prisma.userNotification.count({
    where: {
      userId,
      readAt: null,
      notification: { companyId },
    },
  });

  return NextResponse.json({ count });
}
