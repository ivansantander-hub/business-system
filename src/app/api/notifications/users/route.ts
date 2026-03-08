import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireCompanyId } from "@/lib/auth";
import { EMAIL_EVENTS, type EmailEvent } from "@/lib/email";

export async function GET(request: Request) {
  let companyId: string;
  try {
    companyId = requireCompanyId(request);
  } catch {
    return NextResponse.json({ error: "Company context required" }, { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  const userId = searchParams.get("userId");

  const userAssignments = await prisma.userCompany.findMany({
    where: userId ? { companyId, userId } : { companyId },
    include: { user: { select: { id: true, name: true } } },
  });

  const [templates, userPrefs] = await Promise.all([
    prisma.notificationTemplate.findMany({
      where: { companyId },
    }),
    prisma.userNotificationPreference.findMany({
      where: {
        companyId,
        userId: userId ? userId : { in: userAssignments.map((a) => a.userId) },
      },
    }),
  ]);

  const templateMap = new Map(templates.map((t) => [t.eventType, t.enabled]));
  const userPrefMap = new Map(
    userPrefs.map((p) => [`${p.userId}:${p.eventType}`, p.enabled])
  );

  const result: { userId: string; userName: string; eventType: string; enabled: boolean }[] = [];

  for (const { user } of userAssignments) {
    const companyEnabled = (et: string) => templateMap.get(et) ?? true;
    const userEnabled = (et: string) => userPrefMap.get(`${user.id}:${et}`) ?? true;

    for (const eventType of Object.values(EMAIL_EVENTS)) {
      const enabled = companyEnabled(eventType) && userEnabled(eventType);
      result.push({
        userId: user.id,
        userName: user.name,
        eventType,
        enabled,
      });
    }
  }

  return NextResponse.json(result);
}

export async function PUT(request: Request) {
  let companyId: string;
  try {
    companyId = requireCompanyId(request);
  } catch {
    return NextResponse.json({ error: "Company context required" }, { status: 403 });
  }

  const body = await request.json();
  const { userId, eventType, enabled } = body as {
    userId: string;
    eventType: string;
    enabled: boolean;
  };

  if (!userId || !eventType || typeof enabled !== "boolean") {
    return NextResponse.json(
      { error: "userId, eventType and enabled are required" },
      { status: 400 }
    );
  }

  if (!Object.values(EMAIL_EVENTS).includes(eventType as (typeof EMAIL_EVENTS)[keyof typeof EMAIL_EVENTS])) {
    return NextResponse.json({ error: "Invalid eventType" }, { status: 400 });
  }

  const assignment = await prisma.userCompany.findFirst({
    where: { userId, companyId },
  });

  if (!assignment) {
    return NextResponse.json(
      { error: "User is not assigned to this company" },
      { status: 404 }
    );
  }

  await prisma.userNotificationPreference.upsert({
    where: {
      userId_companyId_eventType: { userId, companyId, eventType },
    },
    update: { enabled },
    create: { userId, companyId, eventType, enabled },
  });

  return NextResponse.json({ ok: true });
}
