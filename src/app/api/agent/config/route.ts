import { NextResponse } from "next/server";
import { getUserFromHeaders } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { auditApiRequest, serializeEntity } from "@/lib/api-audit";
import { CAPABILITIES } from "@/lib/agent/capabilities";

export async function GET(request: Request) {
  const { userId, role, companyId } = getUserFromHeaders(request);
  if (!userId || !companyId) {
    return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  }
  if (role !== "ADMIN" && role !== "SUPER_ADMIN") {
    return NextResponse.json({ error: "Acceso denegado" }, { status: 403 });
  }

  const config = await prisma.agentConfig.findUnique({ where: { companyId } });

  return NextResponse.json({
    enabled: config?.enabled ?? false,
    modelProvider: config?.modelProvider ?? "openai",
    modelName: config?.modelName ?? "gpt-4o-mini",
    capabilities: config?.capabilities ?? {},
    customPrompt: config?.customPrompt ?? null,
    maxTokens: config?.maxTokens ?? 4096,
    hasOpenaiKey: !!config?.openaiApiKey,
    hasAnthropicKey: !!config?.anthropicApiKey,
    hasGlobalOpenaiKey: !!process.env.OPENAI_API_KEY,
    hasGlobalAnthropicKey: !!(process.env.ANTHROPIC_API_KEY || process.env.CLAUDE_API_KEY),
    availableCapabilities: CAPABILITIES.map((c) => ({ id: c.id, label: c.label, description: c.description })),
  });
}

export async function PUT(request: Request) {
  const startTime = Date.now();
  const { userId, role, companyId } = getUserFromHeaders(request);
  if (!userId || !companyId) {
    return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  }
  if (role !== "ADMIN" && role !== "SUPER_ADMIN") {
    return NextResponse.json({ error: "Acceso denegado" }, { status: 403 });
  }

  try {
    const body = await request.json();
    const { enabled, modelProvider, modelName, capabilities, customPrompt, maxTokens, openaiApiKey, anthropicApiKey } = body;

    const existing = await prisma.agentConfig.findUnique({ where: { companyId } });
    const beforeState = serializeEntity(existing as unknown as Record<string, unknown>);

    const data: Record<string, unknown> = {};
    if (typeof enabled === "boolean") data.enabled = enabled;
    if (modelProvider) data.modelProvider = modelProvider;
    if (modelName) data.modelName = modelName;
    if (capabilities) data.capabilities = capabilities;
    if (customPrompt !== undefined) data.customPrompt = customPrompt || null;
    if (maxTokens) data.maxTokens = maxTokens;
    if (openaiApiKey !== undefined) data.openaiApiKey = openaiApiKey || null;
    if (anthropicApiKey !== undefined) data.anthropicApiKey = anthropicApiKey || null;

    const config = await prisma.agentConfig.upsert({
      where: { companyId },
      create: { companyId, ...data },
      update: data,
    });

    if (enabled && !existing?.enabled) {
      await ensureAuraUser(companyId);
    }

    auditApiRequest(request, "agent.config.update", {
      entity: "AgentConfig",
      entityId: config.id,
      statusCode: 200,
      beforeState,
      afterState: serializeEntity({
        ...config,
        openaiApiKey: config.openaiApiKey ? "***" : null,
        anthropicApiKey: config.anthropicApiKey ? "***" : null,
      } as unknown as Record<string, unknown>),
      startTime,
    });

    return NextResponse.json({
      success: true,
      enabled: config.enabled,
      modelProvider: config.modelProvider,
      modelName: config.modelName,
      capabilities: config.capabilities,
      customPrompt: config.customPrompt,
      maxTokens: config.maxTokens,
      hasOpenaiKey: !!config.openaiApiKey,
      hasAnthropicKey: !!config.anthropicApiKey,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Error interno";
    auditApiRequest(request, "agent.config.update.error", { statusCode: 500, details: { error: message }, startTime });
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

async function ensureAuraUser(companyId: string) {
  const existing = await prisma.user.findFirst({
    where: { isBot: true, companies: { some: { companyId } } },
  });
  if (existing) {
    if (existing.name !== "AURA") {
      await prisma.user.update({ where: { id: existing.id }, data: { name: "AURA", email: "aura@sgc.bot" } });
    }
    return existing;
  }

  let botUser = await prisma.user.findFirst({ where: { isBot: true, email: "aura@sgc.bot" } });
  if (!botUser) {
    botUser = await prisma.user.findFirst({ where: { isBot: true, email: "aria@sgc.bot" } });
    if (botUser) {
      await prisma.user.update({ where: { id: botUser.id }, data: { name: "AURA", email: "aura@sgc.bot" } });
    }
  }
  if (!botUser) {
    botUser = await prisma.user.create({
      data: {
        name: "AURA",
        email: "aura@sgc.bot",
        password: "BOT_NO_LOGIN",
        role: "ADMIN",
        isBot: true,
      },
    });
  }

  await prisma.userCompany.create({
    data: { userId: botUser.id, companyId, role: "ADMIN" },
  });

  return botUser;
}
