import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const accounts = await prisma.account.findMany({
    orderBy: { code: "asc" },
  });
  return NextResponse.json(accounts);
}

export async function POST(request: Request) {
  const body = await request.json();
  const account = await prisma.account.create({
    data: {
      code: body.code,
      name: body.name,
      type: body.type,
      parentId: body.parentId ? Number(body.parentId) : null,
    },
  });
  return NextResponse.json(account, { status: 201 });
}
