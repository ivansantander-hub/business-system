import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getUserFromHeaders } from "@/lib/auth";
import { uploadToR2, deleteFromR2, avatarKey, isR2Configured } from "@/lib/r2";

const MAX_SIZE = 5 * 1024 * 1024; // 5 MB
const ALLOWED_TYPES = new Set(["image/jpeg", "image/png", "image/webp", "image/gif"]);

export async function POST(request: Request) {
  const { userId } = getUserFromHeaders(request);
  if (!userId) return NextResponse.json({ error: "No autenticado" }, { status: 401 });

  if (!isR2Configured()) {
    return NextResponse.json({ error: "Almacenamiento no configurado" }, { status: 503 });
  }

  const formData = await request.formData();
  const file = formData.get("avatar") as File | null;
  if (!file) return NextResponse.json({ error: "No se proporcionó archivo" }, { status: 400 });

  if (!ALLOWED_TYPES.has(file.type)) {
    return NextResponse.json({ error: "Tipo de archivo no permitido. Use JPEG, PNG, WebP o GIF." }, { status: 400 });
  }
  if (file.size > MAX_SIZE) {
    return NextResponse.json({ error: "El archivo excede el tamaño máximo de 5 MB" }, { status: 400 });
  }

  const ext = file.type.split("/")[1] === "jpeg" ? "jpg" : file.type.split("/")[1];
  const key = avatarKey(userId, ext);

  const buffer = Buffer.from(await file.arrayBuffer());
  await uploadToR2(key, buffer, file.type);

  const avatarUrl = `/api/profile/avatar?t=${Date.now()}`;

  await prisma.user.update({
    where: { id: userId },
    data: { avatarUrl: key },
  });

  return NextResponse.json({ avatarUrl, key });
}

export async function GET(request: Request) {
  const { userId } = getUserFromHeaders(request);
  if (!userId) return NextResponse.json({ error: "No autenticado" }, { status: 401 });

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { avatarUrl: true },
  });

  if (!user?.avatarUrl || !isR2Configured()) {
    return NextResponse.json({ error: "Sin avatar" }, { status: 404 });
  }

  const { getBufferFromR2 } = await import("@/lib/r2");
  const result = await getBufferFromR2(user.avatarUrl);
  if (!result) return NextResponse.json({ error: "Avatar no encontrado" }, { status: 404 });

  return new Response(result.buffer, {
    headers: {
      "Content-Type": result.contentType,
      "Cache-Control": "private, max-age=86400",
    },
  });
}

export async function DELETE(request: Request) {
  const { userId } = getUserFromHeaders(request);
  if (!userId) return NextResponse.json({ error: "No autenticado" }, { status: 401 });

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { avatarUrl: true },
  });

  if (user?.avatarUrl && isR2Configured()) {
    deleteFromR2(user.avatarUrl).catch(() => {});
  }

  await prisma.user.update({
    where: { id: userId },
    data: { avatarUrl: null },
  });

  return NextResponse.json({ ok: true });
}
