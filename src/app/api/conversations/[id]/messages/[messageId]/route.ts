import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getUserFromHeaders, requireCompanyId } from "@/lib/auth";

const MAX_CONTENT_LENGTH = 5000;

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

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string; messageId: string }> }
) {
  const { userId, role } = getUserFromHeaders(request);
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

  const { id: conversationId, messageId } = await params;
  const participant = await ensureParticipant(conversationId, userId, companyId);
  if (!participant) {
    return NextResponse.json({ error: "Conversación no encontrada" }, { status: 404 });
  }

  const message = await prisma.message.findUnique({
    where: { id: messageId, conversationId },
  });

  if (!message) {
    return NextResponse.json({ error: "Mensaje no encontrado" }, { status: 404 });
  }

  if (message.senderId !== userId) {
    return NextResponse.json(
      { error: "Solo el autor puede editar el mensaje" },
      { status: 403 }
    );
  }

  const body = await request.json();
  const content = typeof body.content === "string" ? body.content.trim() : "";
  if (!content) {
    return NextResponse.json(
      { error: "El contenido del mensaje es requerido" },
      { status: 400 }
    );
  }
  if (content.length > MAX_CONTENT_LENGTH) {
    return NextResponse.json(
      { error: `El mensaje no puede exceder ${MAX_CONTENT_LENGTH} caracteres` },
      { status: 400 }
    );
  }

  const updated = await prisma.message.update({
    where: { id: messageId },
    data: { content, editedAt: new Date() },
    include: {
      sender: { select: { id: true, name: true, avatarUrl: true } },
      attachments: true,
    },
  });

  return NextResponse.json({
    id: updated.id,
    content: updated.content,
    createdAt: updated.createdAt,
    editedAt: updated.editedAt,
    sender: {
      id: updated.sender.id,
      name: updated.sender.name,
      avatarUrl: updated.sender.avatarUrl,
    },
    attachments: updated.attachments.map((a) => ({
      id: a.id,
      fileName: a.fileName,
      fileSize: a.fileSize,
      mimeType: a.mimeType,
      url: `/api/conversations/${conversationId}/attachments/${a.id}`,
    })),
  });
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string; messageId: string }> }
) {
  const { userId, role } = getUserFromHeaders(request);
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

  const { id: conversationId, messageId } = await params;
  const participant = await ensureParticipant(conversationId, userId, companyId);
  if (!participant) {
    return NextResponse.json({ error: "Conversación no encontrada" }, { status: 404 });
  }

  const message = await prisma.message.findUnique({
    where: { id: messageId, conversationId },
  });

  if (!message) {
    return NextResponse.json({ error: "Mensaje no encontrado" }, { status: 404 });
  }

  const isSender = message.senderId === userId;
  const isAdmin = role === "ADMIN" || role === "SUPER_ADMIN";

  if (!isSender && !isAdmin) {
    return NextResponse.json(
      { error: "Solo el autor o un administrador pueden eliminar el mensaje" },
      { status: 403 }
    );
  }

  await prisma.message.delete({
    where: { id: messageId },
  });

  return NextResponse.json({ ok: true });
}
