import OpenAI from "openai";
import Anthropic from "@anthropic-ai/sdk";

export interface ChatMessage {
  role: "system" | "user" | "assistant" | "tool";
  content: string;
  tool_call_id?: string;
  tool_calls?: ToolCall[];
}

export interface ToolCall {
  id: string;
  function: {
    name: string;
    arguments: string;
  };
}

export interface ToolDefinition {
  name: string;
  description: string;
  parameters: Record<string, unknown>;
}

export interface AgentResponse {
  content: string | null;
  toolCalls: ToolCall[];
  finishReason: "stop" | "tool_calls" | "length" | "error";
  usage?: { promptTokens: number; completionTokens: number };
}

export interface AgentProvider {
  chat(params: {
    model: string;
    systemPrompt: string;
    messages: ChatMessage[];
    tools: ToolDefinition[];
    maxTokens: number;
  }): Promise<AgentResponse>;
}

export class OpenAIProvider implements AgentProvider {
  private client: OpenAI;

  constructor(apiKey: string) {
    this.client = new OpenAI({ apiKey });
  }

  async chat(params: {
    model: string;
    systemPrompt: string;
    messages: ChatMessage[];
    tools: ToolDefinition[];
    maxTokens: number;
  }): Promise<AgentResponse> {
    const messages: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = [
      { role: "system", content: params.systemPrompt },
      ...params.messages.map((m) => this.toOpenAIMessage(m)),
    ];

    const tools: OpenAI.Chat.Completions.ChatCompletionTool[] | undefined =
      params.tools.length > 0
        ? params.tools.map((t) => ({
            type: "function" as const,
            function: {
              name: t.name,
              description: t.description,
              parameters: t.parameters as OpenAI.FunctionParameters,
            },
          }))
        : undefined;

    const response = await this.client.chat.completions.create({
      model: params.model,
      messages,
      tools,
      max_tokens: params.maxTokens,
    });

    const choice = response.choices[0];
    const toolCalls: ToolCall[] = (choice.message.tool_calls ?? [])
      .filter((tc): tc is OpenAI.Chat.Completions.ChatCompletionMessageFunctionToolCall => tc.type === "function")
      .map((tc) => ({
        id: tc.id,
        function: { name: tc.function.name, arguments: tc.function.arguments },
      }));

    return {
      content: choice.message.content,
      toolCalls,
      finishReason: choice.finish_reason === "tool_calls" ? "tool_calls" : choice.finish_reason === "length" ? "length" : "stop",
      usage: response.usage
        ? { promptTokens: response.usage.prompt_tokens, completionTokens: response.usage.completion_tokens }
        : undefined,
    };
  }

  private toOpenAIMessage(m: ChatMessage): OpenAI.Chat.Completions.ChatCompletionMessageParam {
    if (m.role === "tool") {
      return { role: "tool", content: m.content, tool_call_id: m.tool_call_id! };
    }
    if (m.role === "assistant" && m.tool_calls?.length) {
      return {
        role: "assistant",
        content: m.content ?? null,
        tool_calls: m.tool_calls.map((tc) => ({
          id: tc.id,
          type: "function" as const,
          function: { name: tc.function.name, arguments: tc.function.arguments },
        })),
      };
    }
    return { role: m.role as "user" | "assistant", content: m.content };
  }
}

export class AnthropicProvider implements AgentProvider {
  private client: Anthropic;

  constructor(apiKey: string) {
    this.client = new Anthropic({ apiKey });
  }

  async chat(params: {
    model: string;
    systemPrompt: string;
    messages: ChatMessage[];
    tools: ToolDefinition[];
    maxTokens: number;
  }): Promise<AgentResponse> {
    const anthropicMessages = this.buildMessages(params.messages);
    const tools: Anthropic.Messages.Tool[] = params.tools.map((t) => ({
      name: t.name,
      description: t.description,
      input_schema: t.parameters as Anthropic.Messages.Tool.InputSchema,
    }));

    const response = await this.client.messages.create({
      model: params.model,
      system: params.systemPrompt,
      messages: anthropicMessages,
      tools: tools.length > 0 ? tools : undefined,
      max_tokens: params.maxTokens,
    });

    let content: string | null = null;
    const toolCalls: ToolCall[] = [];

    for (const block of response.content) {
      if (block.type === "text") {
        content = (content ?? "") + block.text;
      } else if (block.type === "tool_use") {
        toolCalls.push({
          id: block.id,
          function: { name: block.name, arguments: JSON.stringify(block.input) },
        });
      }
    }

    return {
      content,
      toolCalls,
      finishReason: response.stop_reason === "tool_use" ? "tool_calls" : response.stop_reason === "max_tokens" ? "length" : "stop",
      usage: { promptTokens: response.usage.input_tokens, completionTokens: response.usage.output_tokens },
    };
  }

  private buildMessages(messages: ChatMessage[]): Anthropic.Messages.MessageParam[] {
    const result: Anthropic.Messages.MessageParam[] = [];

    for (const m of messages) {
      if (m.role === "user") {
        result.push({ role: "user", content: m.content });
      } else if (m.role === "assistant" && m.tool_calls?.length) {
        const blocks: Anthropic.Messages.ContentBlockParam[] = [];
        if (m.content) blocks.push({ type: "text", text: m.content });
        for (const tc of m.tool_calls) {
          blocks.push({
            type: "tool_use",
            id: tc.id,
            name: tc.function.name,
            input: JSON.parse(tc.function.arguments),
          });
        }
        result.push({ role: "assistant", content: blocks });
      } else if (m.role === "assistant") {
        result.push({ role: "assistant", content: m.content });
      } else if (m.role === "tool") {
        result.push({
          role: "user",
          content: [{ type: "tool_result", tool_use_id: m.tool_call_id!, content: m.content }],
        });
      }
    }

    return result;
  }
}

export function createProvider(provider: string, apiKey: string): AgentProvider {
  switch (provider) {
    case "openai":
      return new OpenAIProvider(apiKey);
    case "anthropic":
      return new AnthropicProvider(apiKey);
    default:
      throw new Error(`Unsupported provider: ${provider}`);
  }
}

export function resolveApiKey(
  provider: string,
  config: { openaiApiKey?: string | null; anthropicApiKey?: string | null },
): string {
  const companyKey = provider === "openai" ? config.openaiApiKey : config.anthropicApiKey;
  if (companyKey) return companyKey;

  const envKey = provider === "openai"
    ? process.env.OPENAI_API_KEY
    : (process.env.ANTHROPIC_API_KEY || process.env.CLAUDE_API_KEY);
  if (envKey) return envKey;

  throw new Error(`No API key configured for provider "${provider}". Set a per-company key or a global fallback in environment variables.`);
}

export const AVAILABLE_MODELS = [
  { provider: "openai", id: "gpt-4o", label: "GPT-4o", description: "Most capable OpenAI model" },
  { provider: "openai", id: "gpt-4o-mini", label: "GPT-4o Mini", description: "Fast and cost-effective" },
  { provider: "openai", id: "gpt-4.1-mini", label: "GPT-4.1 Mini", description: "Latest mini model" },
  { provider: "openai", id: "gpt-4.1-nano", label: "GPT-4.1 Nano", description: "Ultra-fast nano model" },
  { provider: "anthropic", id: "claude-sonnet-4-20250514", label: "Claude Sonnet 4", description: "Balanced Anthropic model" },
  { provider: "anthropic", id: "claude-haiku-4-20250514", label: "Claude Haiku 4", description: "Fast and economical" },
];
