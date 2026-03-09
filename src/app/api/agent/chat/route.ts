import { NextResponse } from "next/server";
import { getUserFromHeaders } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { processMessage } from "@/lib/agent";
import { auditApiRequest } from "@/lib/api-audit";

const rateLimitMap = new Map<string, number>();
const RATE_LIMIT_MS = 5000;

export async function POST(request: Request) {
  const startTime = Date.now();
  const { userId, companyId } = getUserFromHeaders(request);

  if (!userId || !companyId) {
    return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  }

  const lastRequest = rateLimitMap.get(userId);
  if (lastRequest && Date.now() - lastRequest < RATE_LIMIT_MS) {
    return NextResponse.json({ error: "Espera unos segundos antes de enviar otro mensaje" }, { status: 429 });
  }
  rateLimitMap.set(userId, Date.now());

  try {
    const { conversationId, modelProvider, modelName } = await request.json();
    if (!conversationId) {
      return NextResponse.json({ error: "conversationId requerido" }, { status: 400 });
    }

    const participant = await prisma.conversationParticipant.findFirst({
      where: { conversationId, userId },
    });
    if (!participant) {
      return NextResponse.json({ error: "No eres participante de esta conversación" }, { status: 403 });
    }

    const overrideModel = modelProvider && modelName ? { provider: modelProvider, model: modelName } : undefined;

    const result = await processMessage(companyId, conversationId, overrideModel);

    const botUser = await prisma.user.findFirst({
      where: { isBot: true, companies: { some: { companyId } } },
    });

    if (botUser) {
      await prisma.message.create({
        data: {
          conversationId,
          senderId: botUser.id,
          content: result.response,
        },
      });

      await prisma.conversation.update({
        where: { id: conversationId },
        data: { updatedAt: new Date() },
      });
    }

    auditApiRequest(request, "agent.chat", {
      entity: "AgentConversation",
      entityId: conversationId,
      statusCode: 200,
      details: {
        model: result.model,
        provider: result.provider,
        toolsUsed: result.toolsUsed,
        promptTokens: result.usage?.promptTokens,
        completionTokens: result.usage?.completionTokens,
      },
      startTime,
    });

    return NextResponse.json({
      response: result.response,
      model: result.model,
      provider: result.provider,
      toolsUsed: result.toolsUsed,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Error interno";
    auditApiRequest(request, "agent.chat.error", { statusCode: 500, details: { error: message }, startTime });
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
