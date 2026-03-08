import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getUserFromHeaders } from "@/lib/auth";

export async function GET(request: Request) {
  const { companyId } = getUserFromHeaders(request);
  if (companyId === null) {
    return NextResponse.json({ error: "Company context required" }, { status: 403 });
  }

  const settings = await prisma.setting.findMany({
    where: { companyId },
  });
  const result: Record<string, string> = {};
  settings.forEach((s) => {
    result[s.key] = s.value;
  });
  return NextResponse.json(result);
}

export async function PUT(request: Request) {
  const { companyId } = getUserFromHeaders(request);
  if (companyId === null) {
    return NextResponse.json({ error: "Company context required" }, { status: 403 });
  }

  const body = await request.json();

  for (const [key, value] of Object.entries(body)) {
    const stringValue = typeof value === "string" ? value : JSON.stringify(value);
    await prisma.setting.upsert({
      where: { companyId_key: { companyId, key } },
      update: { value: stringValue },
      create: { companyId, key, value: stringValue },
    });
  }

  return NextResponse.json({ ok: true });
}
