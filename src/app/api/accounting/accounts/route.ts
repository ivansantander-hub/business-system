import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getUserFromHeaders } from "@/lib/auth";

export async function GET(request: Request) {
  const { companyId } = getUserFromHeaders(request);
  if (companyId === null) {
    return NextResponse.json({ error: "Company context required" }, { status: 403 });
  }

  const accounts = await prisma.account.findMany({
    where: { companyId },
    orderBy: { code: "asc" },
  });
  return NextResponse.json(accounts);
}

export async function POST(request: Request) {
  const { companyId } = getUserFromHeaders(request);
  if (companyId === null) {
    return NextResponse.json({ error: "Company context required" }, { status: 403 });
  }

  const body = await request.json();
  const account = await prisma.account.create({
    data: {
      companyId,
      code: body.code,
      name: body.name,
      type: body.type,
      parentId: body.parentId ? Number(body.parentId) : null,
    },
  });
  return NextResponse.json(account, { status: 201 });
}
