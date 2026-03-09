import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getUserFromHeaders, requireCompanyId } from "@/lib/auth";

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

  const { id } = await params;
  const participant = await ensureParticipant(id, userId, companyId);
  if (!participant) {
    return NextResponse.json({ error: "Conversación no encontrada" }, { status: 404 });
  }

  const conversation = await prisma.conversation.findUnique({
    where: { id },
    include: {
      participants: {
        include: {
          user: { select: { id: true, name: true, avatarUrl: true } },
        },
      },
    },
  });

  if (!conversation) {
    return NextResponse.json({ error: "Conversación no encontrada" }, { status: 404 });
  }

  const otherParticipants = conversation.participants
    .filter((p) => p.userId !== userId)
    .map((p) => ({
      id: p.user.id,
      name: p.user.name,
      avatarUrl: p.user.avatarUrl,
    }));

  const displayName = conversation.isGroup
    ? conversation.name ?? otherParticipants.map((u) => u.name).join(", ")
    : otherParticipants[0]?.name ?? "Sin nombre";

  return NextResponse.json({
    id: conversation.id,
    name: conversation.name,
    isGroup: conversation.isGroup,
    displayName,
    participants: conversation.participants.map((p) => ({
      id: p.user.id,
      name: p.user.name,
      avatarUrl: p.user.avatarUrl,
      isAdmin: p.isAdmin,
    })),
    updatedAt: conversation.updatedAt,
  });
}

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
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

  const { id } = await params;
  const participant = await ensureParticipant(id, userId, companyId);
  if (!participant) {
    return NextResponse.json({ error: "Conversación no encontrada" }, { status: 404 });
  }

  const conversation = participant.conversation;
  if (!conversation.isGroup) {
    return NextResponse.json(
      { error: "Solo se pueden editar conversaciones de grupo" },
      { status: 400 }
    );
  }

  if (!participant.isAdmin) {
    return NextResponse.json(
      { error: "Solo los administradores pueden editar el grupo" },
      { status: 403 }
    );
  }

  const body = await request.json();
  const { name, addParticipantIds, removeParticipantIds } = body as {
    name?: string;
    addParticipantIds?: string[];
    removeParticipantIds?: string[];
  };

  const updates: { name?: string } = {};
  if (typeof name === "string") updates.name = name;

  if (addParticipantIds && Array.isArray(addParticipantIds) && addParticipantIds.length > 0) {
    const companyUsers = await prisma.userCompany.findMany({
      where: {
        companyId,
        userId: { in: addParticipantIds },
      },
      select: { userId: true },
    });
    const validIds = companyUsers.map((u) => u.userId);
    const existing = await prisma.conversationParticipant.findMany({
      where: { conversationId: id },
      select: { userId: true },
    });
    const existingSet = new Set(existing.map((e) => e.userId));
    const toAdd = validIds.filter((id) => !existingSet.has(id));
    if (toAdd.length > 0) {
      await prisma.conversationParticipant.createMany({
        data: toAdd.map((uid) => ({
          conversationId: id,
          userId: uid,
        })),
      });
    }
  }

  if (removeParticipantIds && Array.isArray(removeParticipantIds) && removeParticipantIds.length > 0) {
    const toRemove = removeParticipantIds.filter((uid: string) => uid !== userId);
    if (toRemove.length > 0) {
      await prisma.conversationParticipant.deleteMany({
        where: {
          conversationId: id,
          userId: { in: toRemove },
        },
      });
    }
  }

  if (Object.keys(updates).length > 0) {
    await prisma.conversation.update({
      where: { id },
      data: updates,
    });
  }

  const updated = await prisma.conversation.findUnique({
    where: { id },
    include: {
      participants: {
        include: {
          user: { select: { id: true, name: true, avatarUrl: true } },
        },
      },
    },
  });

  const otherParticipants = (updated?.participants ?? [])
    .filter((p) => p.userId !== userId)
    .map((p) => ({
      id: p.user.id,
      name: p.user.name,
      avatarUrl: p.user.avatarUrl,
      isAdmin: p.isAdmin,
    }));

  return NextResponse.json({
    id: updated?.id,
    name: updated?.name,
    isGroup: updated?.isGroup,
    displayName: updated?.isGroup
      ? updated?.name ?? otherParticipants.map((u) => u.name).join(", ")
      : otherParticipants[0]?.name ?? "Sin nombre",
    participants: (updated?.participants ?? []).map((p) => ({
      id: p.user.id,
      name: p.user.name,
      avatarUrl: p.user.avatarUrl,
      isAdmin: p.isAdmin,
    })),
    updatedAt: updated?.updatedAt,
  });
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
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

  const { id } = await params;
  const participant = await ensureParticipant(id, userId, companyId);
  if (!participant) {
    return NextResponse.json({ error: "Conversación no encontrada" }, { status: 404 });
  }

  await prisma.conversationParticipant.delete({
    where: {
      conversationId_userId: { conversationId: id, userId },
    },
  });

  return NextResponse.json({ ok: true });
}
