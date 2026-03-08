import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireCompanyId } from "@/lib/auth";
import { EMAIL_EVENTS, EVENT_LABELS, type EmailEvent } from "@/lib/email";
import { Role } from "@prisma/client";

const VALID_ROLES: Role[] = [
  "ADMIN",
  "CASHIER",
  "WAITER",
  "ACCOUNTANT",
  "TRAINER",
];

export async function GET(request: Request) {
  let companyId: string;
  try {
    companyId = requireCompanyId(request);
  } catch {
    return NextResponse.json({ error: "Company context required" }, { status: 403 });
  }

  const assignments = await prisma.userCompany.findMany({
    where: { companyId, role: { in: VALID_ROLES } },
    include: { user: { select: { id: true, name: true } } },
    orderBy: [{ role: "asc" }, { user: { name: "asc" } }],
  });

  const [templates, userPrefs] = await Promise.all([
    prisma.notificationTemplate.findMany({
      where: { companyId },
    }),
    prisma.userNotificationPreference.findMany({
      where: {
        companyId,
        userId: { in: assignments.map((a) => a.userId) },
      },
    }),
  ]);

  const templateMap = new Map(templates.map((t) => [t.eventType, t.enabled]));
  const userPrefMap = new Map(
    userPrefs.map((p) => [`${p.userId}:${p.eventType}`, p.enabled])
  );

  const companyEnabled = (et: string) => templateMap.get(et) ?? true;
  const userEnabled = (userId: string, et: string) =>
    userPrefMap.get(`${userId}:${et}`) ?? true;

  const byRole = new Map<
    Role,
    { userId: string; userName: string; preferences: { eventType: string; label: string; enabled: boolean }[] }[]
  >();

  for (const { role, user } of assignments) {
    const prefs = Object.values(EMAIL_EVENTS).map((eventType) => ({
      eventType,
      label: EVENT_LABELS[eventType as EmailEvent],
      enabled: companyEnabled(eventType) && userEnabled(user.id, eventType),
    }));

    const list = byRole.get(role) ?? [];
    if (list.length === 0) byRole.set(role, list);
    list.push({
      userId: user.id,
      userName: user.name,
      preferences: prefs,
    });
  }

  const result = Array.from(byRole.entries()).map(([role, users]) => ({
    role,
    users,
  }));

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
  const { role, eventType, enabled } = body as {
    role: string;
    eventType: string;
    enabled: boolean;
  };

  if (!role || !eventType || typeof enabled !== "boolean") {
    return NextResponse.json(
      { error: "role, eventType and enabled are required" },
      { status: 400 }
    );
  }

  if (!VALID_ROLES.includes(role as Role)) {
    return NextResponse.json({ error: "Invalid role" }, { status: 400 });
  }

  if (!Object.values(EMAIL_EVENTS).includes(eventType as EmailEvent)) {
    return NextResponse.json({ error: "Invalid eventType" }, { status: 400 });
  }

  const assignments = await prisma.userCompany.findMany({
    where: { companyId, role: role as Role },
    select: { userId: true },
  });

  const userIds = assignments.map((a) => a.userId);

  if (userIds.length === 0) {
    return NextResponse.json({ ok: true, updated: 0 });
  }

  await prisma.$transaction(
    userIds.map((userId) =>
      prisma.userNotificationPreference.upsert({
        where: {
          userId_companyId_eventType: { userId, companyId, eventType },
        },
        update: { enabled },
        create: { userId, companyId, eventType, enabled },
      })
    )
  );

  return NextResponse.json({ ok: true, updated: userIds.length });
}
