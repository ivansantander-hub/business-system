import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getUserFromHeaders, requireCompanyId } from "@/lib/auth";
import { getBufferFromR2, isR2Configured } from "@/lib/r2";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { userId } = getUserFromHeaders(request);
  if (!userId) {
    return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  }

  let companyId: string;
  try {
    companyId = requireCompanyId(request);
  } catch {
    return NextResponse.json(
      { error: "Se requiere contexto de empresa" },
      { status: 403 }
    );
  }

  const { id } = await params;
  if (!id) {
    return NextResponse.json({ error: "ID de usuario requerido" }, { status: 400 });
  }

  const targetUser = await prisma.user.findUnique({
    where: { id },
    select: { avatarUrl: true },
  });

  if (!targetUser) {
    return NextResponse.json({ error: "Usuario no encontrado" }, { status: 404 });
  }

  const inSameCompany = await prisma.userCompany.findFirst({
    where: { userId: id, companyId },
  });
  if (!inSameCompany) {
    return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  }

  if (!targetUser.avatarUrl || !isR2Configured()) {
    return NextResponse.json({ error: "Sin avatar" }, { status: 404 });
  }

  const result = await getBufferFromR2(targetUser.avatarUrl);
  if (!result) {
    return NextResponse.json({ error: "Avatar no encontrado" }, { status: 404 });
  }

  return new Response(new Uint8Array(result.buffer), {
    headers: {
      "Content-Type": result.contentType,
      "Cache-Control": "private, max-age=86400",
    },
  });
}
