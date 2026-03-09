import { describe, it, expect, beforeAll } from "vitest";
import { prisma } from "@/lib/prisma";
import { signToken } from "@/lib/auth";
import {
  getOrCreateTestCompany,
  getOrCreateTestUser,
  getOrCreateSecondTestUser,
} from "./helpers";

const BASE_URL = process.env.TEST_BASE_URL || "http://localhost:3000";
let serverAvailable = false;

let token: string;
let companyId: string;
let userId: string;
let otherUserId: string;

async function apiRequest(path: string, options: RequestInit = {}) {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    Cookie: `token=${token}`,
    ...(options.headers as Record<string, string> || {}),
  };
  return fetch(`${BASE_URL}${path}`, { ...options, headers });
}

function requireServer(ctx: { skip: () => void }) {
  if (!serverAvailable) ctx.skip();
}

beforeAll(async () => {
  const company = await getOrCreateTestCompany();
  companyId = company.id;
  const user = await getOrCreateTestUser(companyId);
  userId = user.id;
  const otherUser = await getOrCreateSecondTestUser(companyId);
  otherUserId = otherUser.id;

  token = await signToken({
    userId: user.id,
    role: "ADMIN",
    name: user.name,
    companyId: company.id,
    branchId: null,
  });

  try {
    await fetch(`${BASE_URL}/api/auth/me`, { signal: AbortSignal.timeout(3000) });
    serverAvailable = true;
  } catch {
    serverAvailable = false;
    console.warn(`Server not available at ${BASE_URL} - messaging tests will be skipped`);
  }
});

describe("Conversations API", () => {
  let conversationId: string;

  it("GET /api/conversations should return conversations list", async (ctx) => {
    requireServer(ctx);
    const res = await apiRequest("/api/conversations");
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(Array.isArray(data)).toBe(true);
  });

  it("POST /api/conversations should create a conversation", async (ctx) => {
    requireServer(ctx);
    const res = await apiRequest("/api/conversations", {
      method: "POST",
      body: JSON.stringify({
        participantIds: [otherUserId],
      }),
    });
    expect([200, 201]).toContain(res.status);
    const data = await res.json();
    expect(data.id).toBeDefined();
    expect(data.displayName).toBeTruthy();
    expect(data).toHaveProperty("otherParticipants");
    conversationId = data.id;
  });

  it("POST /api/conversations with same participant should return existing conversation", async (ctx) => {
    requireServer(ctx);
    const res = await apiRequest("/api/conversations", {
      method: "POST",
      body: JSON.stringify({
        participantIds: [otherUserId],
      }),
    });
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.id).toBe(conversationId);
  });

  it("GET /api/conversations/[id] should return conversation details", async (ctx) => {
    requireServer(ctx);
    if (!conversationId) return;
    const res = await apiRequest(`/api/conversations/${conversationId}`);
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.id).toBe(conversationId);
    expect(data).toHaveProperty("participants");
    expect(Array.isArray(data.participants)).toBe(true);
  });

  it("GET /api/conversations/[id]/messages should return messages", async (ctx) => {
    requireServer(ctx);
    if (!conversationId) return;
    const res = await apiRequest(`/api/conversations/${conversationId}/messages`);
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data).toHaveProperty("messages");
    expect(data).toHaveProperty("nextCursor");
    expect(data).toHaveProperty("hasMore");
    expect(Array.isArray(data.messages)).toBe(true);
  });
});

describe("Messages API", () => {
  let conversationId: string;
  let messageId: string;

  beforeAll(async () => {
    if (!companyId || !userId || !otherUserId) return;
    let existing = await prisma.conversation.findFirst({
      where: {
        companyId,
        isGroup: false,
        AND: [
          { participants: { some: { userId } } },
          { participants: { some: { userId: otherUserId } } },
        ],
      },
    });
    if (!existing) {
      existing = await prisma.conversation.create({
        data: {
          companyId,
          isGroup: false,
          participants: {
            create: [
              { userId, isAdmin: false },
              { userId: otherUserId, isAdmin: false },
            ],
          },
        },
      });
    }
    conversationId = existing.id;
  });

  it("POST /api/conversations/[id]/messages should send a message", async (ctx) => {
    requireServer(ctx);
    if (!conversationId) return;
    const res = await apiRequest(`/api/conversations/${conversationId}/messages`, {
      method: "POST",
      body: JSON.stringify({ content: "Hello from test!" }),
    });
    expect(res.status).toBe(201);
    const data = await res.json();
    expect(data.id).toBeDefined();
    expect(data.content).toBe("Hello from test!");
    expect(data).toHaveProperty("sender");
    expect(data.sender.id).toBe(userId);
    messageId = data.id;
  });

  it("POST /api/conversations/[id]/messages should reject empty content", async (ctx) => {
    requireServer(ctx);
    if (!conversationId) return;
    const res = await apiRequest(`/api/conversations/${conversationId}/messages`, {
      method: "POST",
      body: JSON.stringify({ content: "" }),
    });
    expect(res.status).toBe(400);
  });

  it("GET /api/conversations/[id]/messages should include sent message", async (ctx) => {
    requireServer(ctx);
    if (!conversationId || !messageId) return;
    const res = await apiRequest(`/api/conversations/${conversationId}/messages`);
    expect(res.status).toBe(200);
    const data = await res.json();
    const msg = data.messages.find((m: { id: string }) => m.id === messageId);
    expect(msg).toBeDefined();
    expect(msg.content).toBe("Hello from test!");
  });

  it("GET /api/conversations/[id] for non-existent should return 404", async (ctx) => {
    requireServer(ctx);
    const res = await apiRequest("/api/conversations/00000000-0000-0000-0000-000000000000");
    expect(res.status).toBe(404);
  });
});
