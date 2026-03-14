import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getUserFromHeaders, requireCompanyId } from "@/lib/auth";
import { hasPermission } from "@/lib/rbac";

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

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { userId, role } = getUserFromHeaders(request);
  if (!userId) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  if (role !== "SUPER_ADMIN" && !hasPermission(role, "messaging")) {
    return NextResponse.json({ error: "No tienes acceso a mensajería" }, { status: 403 });
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

  const { id: conversationId } = await params;
  const participant = await ensureParticipant(conversationId, userId, companyId);
  if (!participant) {
    return NextResponse.json({ error: "Conversación no encontrada" }, { status: 404 });
  }

  const { searchParams } = new URL(request.url);
  const cursor = searchParams.get("cursor");
  const limit = Math.min(parseInt(searchParams.get("limit") ?? "50", 10) || 50, 100);

  const messages = await prisma.message.findMany({
    where: { conversationId },
    orderBy: { createdAt: "desc" },
    take: limit + 1,
    ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
    include: {
      sender: { select: { id: true, name: true, avatarUrl: true } },
      attachments: true,
    },
  });

  const hasMore = messages.length > limit;
  const items = hasMore ? messages.slice(0, limit) : messages;
  const nextCursor = hasMore ? items[items.length - 1]?.id : null;

  const result = items.map((m) => ({
    id: m.id,
    content: m.content,
    createdAt: m.createdAt,
    editedAt: m.editedAt,
    sender: {
      id: m.sender.id,
      name: m.sender.name,
      avatarUrl: m.sender.avatarUrl,
    },
    attachments: m.attachments.map((a) => ({
      id: a.id,
      fileName: a.fileName,
      fileSize: a.fileSize,
      mimeType: a.mimeType,
      url: `/api/conversations/${conversationId}/attachments/${a.id}`,
    })),
  }));

  await prisma.conversationParticipant.update({
    where: {
      conversationId_userId: { conversationId, userId },
    },
    data: { lastReadAt: new Date() },
  });

  return NextResponse.json({
    messages: result,
    nextCursor,
    hasMore,
  });
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { userId, role } = getUserFromHeaders(request);
  if (!userId) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  if (role !== "SUPER_ADMIN" && !hasPermission(role, "messaging")) {
    return NextResponse.json({ error: "No tienes acceso a mensajería" }, { status: 403 });
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

  const { id: conversationId } = await params;
  const participant = await ensureParticipant(conversationId, userId, companyId);
  if (!participant) {
    return NextResponse.json({ error: "Conversación no encontrada" }, { status: 404 });
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

  const message = await prisma.message.create({
    data: {
      conversationId,
      senderId: userId,
      content,
    },
    include: {
      sender: { select: { id: true, name: true, avatarUrl: true } },
      attachments: true,
    },
  });

  return NextResponse.json(
    {
      id: message.id,
      content: message.content,
      createdAt: message.createdAt,
      editedAt: message.editedAt,
      sender: {
        id: message.sender.id,
        name: message.sender.name,
        avatarUrl: message.sender.avatarUrl,
      },
      attachments: message.attachments.map((a) => ({
        id: a.id,
        fileName: a.fileName,
        fileSize: a.fileSize,
        mimeType: a.mimeType,
        url: `/api/conversations/${conversationId}/attachments/${a.id}`,
      })),
    },
    { status: 201 }
  );
}
