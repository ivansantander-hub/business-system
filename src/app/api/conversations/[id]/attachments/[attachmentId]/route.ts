import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getUserFromHeaders, requireCompanyId } from "@/lib/auth";
import { getFromR2, isR2Configured } from "@/lib/r2";

async function ensureParticipant(
  conversationId: string,
  userId: string,
  companyId: string
) {
  const participant = await prisma.conversationParticipant.findUnique({
    where: {
      conversationId_userId: { conversationId, userId },
    },
    include: {
      conversation: true,
    },
  });

  if (!participant || participant.conversation.companyId !== companyId) {
    return null;
  }
  return participant;
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string; attachmentId: string }> }
) {
  const { userId } = getUserFromHeaders(request);
  if (!userId) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
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

  const { id: conversationId, attachmentId } = await params;
  const participant = await ensureParticipant(conversationId, userId, companyId);
  if (!participant) {
    return NextResponse.json({ error: "Conversación no encontrada" }, { status: 404 });
  }

  const attachment = await prisma.messageAttachment.findFirst({
    where: {
      id: attachmentId,
      message: { conversationId },
    },
  });

  if (!attachment || !isR2Configured()) {
    return NextResponse.json({ error: "Archivo no encontrado" }, { status: 404 });
  }

  const result = await getFromR2(attachment.r2Key);
  if (!result || !result.body) {
    return NextResponse.json({ error: "Archivo no encontrado" }, { status: 404 });
  }

  return new Response(result.body, {
    headers: {
      "Content-Type": attachment.mimeType,
      "Content-Disposition": `inline; filename="${attachment.fileName}"`,
      "Cache-Control": "private, max-age=86400",
    },
  });
}
