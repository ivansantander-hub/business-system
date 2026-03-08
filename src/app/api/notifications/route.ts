import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireCompanyId } from "@/lib/auth";
import { EMAIL_EVENTS, EVENT_LABELS, type EmailEvent } from "@/lib/email";

export async function GET(request: Request) {
  let companyId: string;
  try {
    companyId = requireCompanyId(request);
  } catch {
    return NextResponse.json({ error: "Company context required" }, { status: 403 });
  }

  const templates = await prisma.notificationTemplate.findMany({
    where: { companyId },
  });

  const templateMap = new Map(templates.map((t) => [t.eventType, t.enabled]));

  const result = Object.values(EMAIL_EVENTS).map((eventType) => ({
    eventType,
    label: EVENT_LABELS[eventType as EmailEvent],
    enabled: templateMap.get(eventType) ?? true,
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
  const { eventType, enabled } = body as { eventType: string; enabled: boolean };

  if (!eventType || typeof enabled !== "boolean") {
    return NextResponse.json({ error: "eventType and enabled are required" }, { status: 400 });
  }

  if (!Object.values(EMAIL_EVENTS).includes(eventType as EmailEvent)) {
    return NextResponse.json({ error: "Invalid eventType" }, { status: 400 });
  }

  await prisma.notificationTemplate.upsert({
    where: {
      companyId_eventType: { companyId, eventType },
    },
    update: { enabled },
    create: { companyId, eventType, enabled },
  });

  return NextResponse.json({ ok: true });
}
