import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getUserFromHeaders, requireCompanyId } from "@/lib/auth";

export async function GET(request: Request) {
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

  const conversations = await prisma.conversation.findMany({
    where: {
      companyId,
      participants: { some: { userId } },
    },
    include: {
      participants: {
        include: {
          user: { select: { id: true, name: true, avatarUrl: true, isBot: true } },
        },
      },
      messages: {
        orderBy: { createdAt: "desc" },
        take: 1,
        include: {
          sender: { select: { id: true, name: true } },
        },
      },
    },
    orderBy: { updatedAt: "desc" },
  });

  await ensureAgentConversation(userId, companyId);

  if (!conversations.some((c) => c.participants.some((p) => p.user.isBot))) {
    const agentConv = await prisma.conversation.findFirst({
      where: { companyId, participants: { some: { userId }, }, AND: { participants: { some: { user: { isBot: true } } } } },
      include: {
        participants: { include: { user: { select: { id: true, name: true, avatarUrl: true, isBot: true } } } },
        messages: { orderBy: { createdAt: "desc" }, take: 1, include: { sender: { select: { id: true, name: true } } } },
      },
    });
    if (agentConv) conversations.push(agentConv);
  }

  const result = await Promise.all(
    conversations.map(async (conv) => {
      const myParticipant = conv.participants.find((p) => p.userId === userId);
      const hasBot = conv.participants.some((p) => p.user.isBot);
      const otherParticipants = conv.participants
        .filter((p) => p.userId !== userId)
        .map((p) => ({
          id: p.user.id,
          name: p.user.name,
          avatarUrl: p.user.avatarUrl,
          isBot: p.user.isBot,
        }));

      const unreadCount = await prisma.message.count({
        where: {
          conversationId: conv.id,
          senderId: { not: userId },
          createdAt: {
            gt: myParticipant?.lastReadAt ?? new Date(0),
          },
        },
      });

      const lastMessage = conv.messages[0];
      const displayName = hasBot
        ? "Aria"
        : conv.isGroup
          ? conv.name ?? otherParticipants.map((u) => u.name).join(", ")
          : otherParticipants[0]?.name ?? "Sin nombre";

      return {
        id: conv.id,
        name: conv.name,
        isGroup: conv.isGroup,
        isAgent: hasBot,
        displayName,
        lastMessage: lastMessage
          ? {
              id: lastMessage.id,
              content: lastMessage.content.slice(0, 100),
              createdAt: lastMessage.createdAt,
              senderName: lastMessage.sender.name,
            }
          : null,
        otherParticipants,
        unreadCount,
        updatedAt: conv.updatedAt,
      };
    })
  );

  result.sort((a, b) => {
    if (a.isAgent && !b.isAgent) return -1;
    if (!a.isAgent && b.isAgent) return 1;
    return 0;
  });

  return NextResponse.json(result);
}

export async function POST(request: Request) {
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

  const body = await request.json();
  const { participantIds, name, isGroup } = body as {
    participantIds: string[];
    name?: string;
    isGroup?: boolean;
  };

  if (!Array.isArray(participantIds) || participantIds.length === 0) {
    return NextResponse.json(
      { error: "participantIds es requerido y debe tener al menos un usuario" },
      { status: 400 }
    );
  }

  const allUserIds = [...new Set([userId, ...participantIds])];
  if (isGroup && allUserIds.length < 2) {
    return NextResponse.json(
      { error: "Un grupo debe tener al menos 2 participantes" },
      { status: 400 }
    );
  }

  const companyUsers = await prisma.userCompany.findMany({
    where: {
      companyId,
      userId: { in: allUserIds },
    },
    select: { userId: true },
  });
  const validUserIds = new Set(companyUsers.map((u) => u.userId));
  const invalid = allUserIds.filter((id) => !validUserIds.has(id));
  if (invalid.length > 0) {
    return NextResponse.json(
      { error: "Algunos usuarios no pertenecen a la empresa" },
      { status: 400 }
    );
  }

  if (!isGroup && allUserIds.length === 2) {
    const [otherId] = participantIds;
    const existing = await prisma.conversation.findFirst({
      where: {
        companyId,
        isGroup: false,
        AND: [
          { participants: { some: { userId } } },
          { participants: { some: { userId: otherId } } },
          { participants: { every: { userId: { in: [userId, otherId] } } } },
        ],
      },
      include: {
        participants: {
          include: {
            user: { select: { id: true, name: true, avatarUrl: true } },
          },
        },
      },
    });

    if (existing) {
      const otherParticipants = existing.participants
        .filter((p) => p.userId !== userId)
        .map((p) => ({
          id: p.user.id,
          name: p.user.name,
          avatarUrl: p.user.avatarUrl,
        }));
      return NextResponse.json(
        {
          id: existing.id,
          name: existing.name,
          isGroup: existing.isGroup,
          displayName: otherParticipants[0]?.name ?? "Sin nombre",
          lastMessage: null,
          otherParticipants,
          unreadCount: 0,
          updatedAt: existing.updatedAt,
        },
        { status: 200 }
      );
    }
  }

  const conversation = await prisma.conversation.create({
    data: {
      companyId,
      name: isGroup ? (name || "Grupo") : null,
      isGroup: isGroup ?? false,
      participants: {
        create: allUserIds.map((uid) => ({
          userId: uid,
          isAdmin: uid === userId && isGroup,
        })),
      },
    },
    include: {
      participants: {
        include: {
          user: { select: { id: true, name: true, avatarUrl: true } },
        },
      },
    },
  });

  const otherParticipants = conversation.participants
    .filter((p) => p.userId !== userId)
    .map((p) => ({
      id: p.user.id,
      name: p.user.name,
      avatarUrl: p.user.avatarUrl,
    }));

  return NextResponse.json(
    {
      id: conversation.id,
      name: conversation.name,
      isGroup: conversation.isGroup,
      displayName: conversation.isGroup
        ? conversation.name ?? otherParticipants.map((u) => u.name).join(", ")
        : otherParticipants[0]?.name ?? "Sin nombre",
      lastMessage: null,
      otherParticipants,
      unreadCount: 0,
      updatedAt: conversation.updatedAt,
    },
    { status: 201 }
  );
}

async function ensureAgentConversation(userId: string, companyId: string) {
  const agentConfig = await prisma.agentConfig.findUnique({ where: { companyId } });
  if (!agentConfig?.enabled) return;

  const botUser = await prisma.user.findFirst({
    where: { isBot: true, companies: { some: { companyId } } },
  });
  if (!botUser) return;

  const existing = await prisma.conversation.findFirst({
    where: {
      companyId,
      isGroup: false,
      AND: [
        { participants: { some: { userId } } },
        { participants: { some: { userId: botUser.id } } },
      ],
    },
  });
  if (existing) return;

  await prisma.conversation.create({
    data: {
      companyId,
      isGroup: false,
      participants: {
        create: [
          { userId, isAdmin: false },
          { userId: botUser.id, isAdmin: false },
        ],
      },
    },
  });
}
