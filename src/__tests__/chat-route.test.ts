import { describe, it, expect, vi, beforeEach } from "vitest";

// The chat route trusts the authenticated user (getToken) but takes the target
// organizationId from the request body. These tests pin the membership gate:
// a caller may only reach a tool if they actually belong to the org they name.

// vi.mock factories are hoisted above module scope, so the shared mock refs
// they close over must be created with vi.hoisted.
const { token, anthropicCreate, prismaMock } = vi.hoisted(() => ({
  token: { email: "user@a.edu", name: "User A" },
  anthropicCreate: vi.fn(),
  prismaMock: {
    organization: { findUnique: vi.fn() },
    user: { findUnique: vi.fn() },
    organizationMember: { findFirst: vi.fn() },
    event: { create: vi.fn() },
    eventActivity: { create: vi.fn() },
  },
}));

vi.mock("next-auth/jwt", () => ({
  getToken: vi.fn(async () => token),
}));

// Avoid the SDK's constructor-time API-key requirement and any real network.
vi.mock("@anthropic-ai/sdk", () => ({
  default: class {
    messages = { create: anthropicCreate };
  },
}));

// Prisma surface used before/at the membership gate.
vi.mock("@/lib/prisma", () => ({ prisma: prismaMock }));

// Reached only after the gate passes; keep it inert.
vi.mock("@/lib/orgtime", () => ({
  wallTimeToUtc: vi.fn(),
  utcToWallTime: vi.fn(() => "2026-08-31T09:00:00"),
}));
vi.mock("@/lib/conflict-detection", () => ({ detectConflicts: vi.fn() }));

// The route builds an Anthropic client at import time; give it a key.
process.env.ANTHROPIC_API_KEY = "test-key";

import { POST } from "@/app/api/chat/route";

function req(body: unknown) {
  return { json: async () => body } as unknown as Parameters<typeof POST>[0];
}

const orgB = {
  id: "org-b",
  name: "Org B",
  timezone: "America/New_York",
  appDisplayName: "Org B",
  roomTerm: "room",
  eventPluralTerm: "events",
  requiresApproval: false,
  roomOpeningTime: "08:00",
  roomClosingTime: "20:00",
};

beforeEach(() => {
  vi.clearAllMocks();
  prismaMock.organization.findUnique.mockResolvedValue(orgB);
  prismaMock.user.findUnique.mockResolvedValue({
    id: "user-a",
    email: "user@a.edu",
    active: true,
    isSystemAdmin: false,
  });
});

describe("POST /api/chat — organization membership gate", () => {
  it("rejects a caller who is not a member of the named org (404, no data touched)", async () => {
    // User A belongs to org A; they name org B in the body.
    prismaMock.organizationMember.findFirst.mockResolvedValue(null);

    const res = await POST(req({ messages: [], organizationId: "org-b" }));

    expect(res.status).toBe(404);
    // 404, not 403 — a non-member must not be able to confirm org B exists.
    expect(await res.json()).toEqual({ error: "Organization not found" });
    // The agentic loop is never reached, so no org-B data is exposed or written.
    expect(anthropicCreate).not.toHaveBeenCalled();
    expect(prismaMock.event.create).not.toHaveBeenCalled();
  });

  it("rejects an inactive user even with a membership row", async () => {
    prismaMock.user.findUnique.mockResolvedValue({
      id: "user-a",
      email: "user@a.edu",
      active: false,
      isSystemAdmin: false,
    });
    prismaMock.organizationMember.findFirst.mockResolvedValue({ role: "MEMBER" });

    const res = await POST(req({ messages: [], organizationId: "org-b" }));

    expect(res.status).toBe(404);
    expect(anthropicCreate).not.toHaveBeenCalled();
  });

  it("allows a member through to the assistant", async () => {
    prismaMock.organizationMember.findFirst.mockResolvedValue({ role: "MEMBER" });
    anthropicCreate.mockResolvedValue({
      stop_reason: "end_turn",
      content: [{ type: "text", text: "Hello!" }],
    });

    const res = await POST(req({ messages: [{ role: "user", content: "hi" }], organizationId: "org-b" }));

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ role: "assistant", content: "Hello!" });
    expect(anthropicCreate).toHaveBeenCalledTimes(1);
  });

  it("allows a system admin through even without an explicit membership row", async () => {
    prismaMock.user.findUnique.mockResolvedValue({
      id: "root",
      email: "user@a.edu",
      active: true,
      isSystemAdmin: true,
    });
    prismaMock.organizationMember.findFirst.mockResolvedValue(null);
    anthropicCreate.mockResolvedValue({
      stop_reason: "end_turn",
      content: [{ type: "text", text: "ok" }],
    });

    const res = await POST(req({ messages: [{ role: "user", content: "hi" }], organizationId: "org-b" }));

    expect(res.status).toBe(200);
    expect(anthropicCreate).toHaveBeenCalledTimes(1);
  });
});
