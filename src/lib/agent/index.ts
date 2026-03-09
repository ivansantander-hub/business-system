import { prisma } from "@/lib/prisma";
import { type ChatMessage, createProvider, resolveApiKey } from "./providers";
import { getToolIdsForCapabilities } from "./capabilities";
import { getToolsByNames } from "./tools";
import { QUERY_HANDLERS } from "./queries";
import { buildSystemPrompt } from "./prompts";

const MAX_TOOL_ROUNDS = 8;

export interface ProcessMessageResult {
  response: string;
  model: string;
  provider: string;
  toolsUsed: string[];
  usage?: { promptTokens: number; completionTokens: number };
}

export async function processMessage(
  companyId: string,
  conversationId: string,
  overrideModel?: { provider: string; model: string },
): Promise<ProcessMessageResult> {
  const config = await prisma.agentConfig.findUnique({ where: { companyId } });
  if (!config?.enabled) {
    return { response: "El agente no está habilitado para esta empresa. Contacta a un administrador.", model: "", provider: "", toolsUsed: [] };
  }

  const company = await prisma.company.findUnique({ where: { id: companyId }, select: { name: true } });
  const companyName = company?.name || "Empresa";

  const provider = overrideModel?.provider || config.modelProvider;
  const model = overrideModel?.model || config.modelName;

  const apiKey = resolveApiKey(provider, config);
  const llmProvider = createProvider(provider, apiKey);

  const capabilities = (config.capabilities as Record<string, boolean>) || {};
  const enabledToolIds = getToolIdsForCapabilities(capabilities);
  const tools = getToolsByNames(enabledToolIds);

  const systemPrompt = buildSystemPrompt(companyName, capabilities, config.customPrompt);

  const recentMessages = await prisma.message.findMany({
    where: { conversationId },
    orderBy: { createdAt: "desc" },
    take: 30,
    include: { sender: { select: { isBot: true } } },
  });

  const chatHistory: ChatMessage[] = recentMessages
    .reverse()
    .map((m) => ({
      role: (m.sender.isBot ? "assistant" : "user") as "user" | "assistant",
      content: m.content,
    }));

  const toolsUsed: string[] = [];
  let messages = [...chatHistory];

  for (let round = 0; round < MAX_TOOL_ROUNDS; round++) {
    const result = await llmProvider.chat({
      model,
      systemPrompt,
      messages,
      tools,
      maxTokens: config.maxTokens,
    });

    if (result.finishReason !== "tool_calls" || result.toolCalls.length === 0) {
      return {
        response: result.content || "No pude generar una respuesta. Intenta reformular tu pregunta.",
        model,
        provider,
        toolsUsed,
        usage: result.usage,
      };
    }

    messages.push({
      role: "assistant",
      content: result.content ?? "",
      tool_calls: result.toolCalls,
    });

    for (const tc of result.toolCalls) {
      toolsUsed.push(tc.function.name);
      let toolResult: unknown;

      try {
        const handler = QUERY_HANDLERS[tc.function.name];
        if (!handler) {
          toolResult = { error: `Herramienta desconocida: ${tc.function.name}` };
        } else {
          const args = JSON.parse(tc.function.arguments);
          toolResult = await handler(companyId, args);
        }
      } catch (err) {
        toolResult = { error: `Error ejecutando herramienta: ${err instanceof Error ? err.message : "desconocido"}` };
      }

      messages.push({
        role: "tool",
        content: JSON.stringify(toolResult),
        tool_call_id: tc.id,
      });
    }
  }

  return {
    response: "He alcanzado el límite de consultas para esta pregunta. Por favor, intenta con una pregunta más específica.",
    model,
    provider,
    toolsUsed,
  };
}
