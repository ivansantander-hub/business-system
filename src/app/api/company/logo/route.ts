import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getUserFromHeaders, requireCompanyId } from "@/lib/auth";
import {
  uploadToR2,
  getFromR2,
  companyLogoKey,
  isR2Configured,
} from "@/lib/r2";

const MAX_SIZE = 2 * 1024 * 1024; // 2 MB
const ALLOWED_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
]);

export async function POST(request: Request) {
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

  if (!isR2Configured()) {
    return NextResponse.json(
      { error: "Almacenamiento no configurado" },
      { status: 503 }
    );
  }

  const formData = await request.formData();
  const file = formData.get("logo") as File | null;
  if (!file) {
    return NextResponse.json(
      { error: "No se proporcionó archivo" },
      { status: 400 }
    );
  }

  if (!ALLOWED_TYPES.has(file.type)) {
    return NextResponse.json(
      {
        error:
          "Tipo de archivo no permitido. Use JPEG, PNG, WebP o GIF.",
      },
      { status: 400 }
    );
  }
  if (file.size > MAX_SIZE) {
    return NextResponse.json(
      { error: "El archivo excede el tamaño máximo de 2 MB" },
      { status: 400 }
    );
  }

  const ext =
    file.type.split("/")[1] === "jpeg" ? "jpg" : file.type.split("/")[1];
  const key = companyLogoKey(companyId, ext);

  const buffer = Buffer.from(await file.arrayBuffer());
  await uploadToR2(key, buffer, file.type);

  await prisma.company.update({
    where: { id: companyId },
    data: { logoUrl: key },
  });

  return NextResponse.json({ ok: true, logoUrl: key });
}

export async function GET(request: Request) {
  let companyId: string;
  try {
    companyId = requireCompanyId(request);
  } catch {
    return NextResponse.json(
      { error: "Se requiere contexto de empresa" },
      { status: 403 }
    );
  }

  const company = await prisma.company.findUnique({
    where: { id: companyId },
    select: { logoUrl: true },
  });

  if (!company?.logoUrl || !isR2Configured()) {
    return NextResponse.json({ error: "Logo no encontrado" }, { status: 404 });
  }

  const result = await getFromR2(company.logoUrl);
  if (!result || !result.body) {
    return NextResponse.json({ error: "Logo no encontrado" }, { status: 404 });
  }

  return new Response(result.body, {
    headers: {
      "Content-Type": result.contentType,
      "Cache-Control": "private, max-age=86400",
    },
  });
}
