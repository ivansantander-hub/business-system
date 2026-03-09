import { describe, it, expect, beforeAll } from "vitest";
import { prisma } from "@/lib/prisma";
import { signToken } from "@/lib/auth";
import {
  getOrCreateTestCompany,
  getOrCreateTestUser,
} from "./helpers";

const BASE_URL = process.env.TEST_BASE_URL || "http://localhost:3000";
let serverAvailable = false;

let token: string;
let companyId: string;
let userId: string;

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
    console.warn(`Server not available at ${BASE_URL} - notification tests will be skipped`);
  }
});

describe("Notifications Inbox API", () => {
  let notificationId: string;

  beforeAll(async () => {
    if (!companyId || !userId) return;
    const notification = await prisma.notification.create({
      data: {
        companyId,
        type: "system",
        subject: "Test Notification",
        bodyHtml: "<p>Test body</p>",
      },
    });
    notificationId = notification.id;

    await prisma.userNotification.create({
      data: {
        userId,
        notificationId: notification.id,
      },
    });
  });

  it("GET /api/notifications/inbox should return notifications with pagination", async (ctx) => {
    requireServer(ctx);
    const res = await apiRequest("/api/notifications/inbox?companyId=" + companyId);
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data).toHaveProperty("notifications");
    expect(data).toHaveProperty("total");
    expect(data).toHaveProperty("unreadCount");
    expect(Array.isArray(data.notifications)).toBe(true);
  });

  it("GET /api/notifications/inbox/unread-count should return unread count", async (ctx) => {
    requireServer(ctx);
    const res = await apiRequest("/api/notifications/inbox/unread-count");
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data).toHaveProperty("count");
    expect(typeof data.count).toBe("number");
    expect(data.count).toBeGreaterThanOrEqual(0);
  });

  it("PUT /api/notifications/inbox/[id]/read should mark notification as read", async (ctx) => {
    requireServer(ctx);
    if (!notificationId) return;
    const res = await apiRequest(`/api/notifications/inbox/${notificationId}/read`, {
      method: "PUT",
    });
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.ok).toBe(true);

    const inboxRes = await apiRequest("/api/notifications/inbox?companyId=" + companyId);
    const inboxData = await inboxRes.json();
    const readNotif = inboxData.notifications.find((n: { id: string }) => n.id === notificationId);
    if (readNotif) {
      expect(readNotif.readAt).toBeTruthy();
    }
  });

  it("PUT /api/notifications/inbox/read-all should mark all as read", async (ctx) => {
    requireServer(ctx);
    const res = await apiRequest("/api/notifications/inbox/read-all", {
      method: "PUT",
    });
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data).toHaveProperty("ok", true);
    expect(data).toHaveProperty("count");
  });

  it("GET /api/notifications/inbox with unreadOnly=true filters unread", async (ctx) => {
    requireServer(ctx);
    const res = await apiRequest("/api/notifications/inbox?companyId=" + companyId + "&unreadOnly=true");
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(Array.isArray(data.notifications)).toBe(true);
  });
});
