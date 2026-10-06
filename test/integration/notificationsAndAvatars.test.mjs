import { beforeAll, beforeEach, describe, expect, test, vi } from "vitest";
import request from "supertest";

vi.mock("../../utils/supabase.mjs", async () => ({
  default: { auth: { getUser: (await import("../helpers/auth.mjs")).getUser } },
}));
vi.mock("../../repositories/userRepository.mjs", async () => ({
  findProfileRole: (await import("../helpers/auth.mjs")).findProfileRole,
}));
vi.mock("../../utils/db.mjs", async () => ({
  default: (await import("../helpers/auth.mjs")).makePool(),
}));
vi.mock("../../repositories/notificationRepository.mjs", () => ({
  findNotificationsByRecipient: vi.fn(),
  countUnreadNotifications: vi.fn(),
  markAllAsRead: vi.fn(),
}));
vi.mock("../../services/avatarService.mjs", () => ({
  uploadAvatar: vi.fn(),
  deleteAvatar: vi.fn(),
}));

import { authHeader } from "../helpers/auth.mjs";
import * as notifications from "../../repositories/notificationRepository.mjs";
import * as avatarService from "../../services/avatarService.mjs";

let app;
const member = authHeader("member-token");

beforeAll(async () => {
  process.env.NODE_ENV = "test";
  ({ default: app } = await import("../../app.mjs"));
});
beforeEach(() => vi.resetAllMocks());

describe("notifications", () => {
  test("GET /notifications is scoped to the signed-in user", async () => {
    notifications.findNotificationsByRecipient.mockResolvedValue([{ id: 1 }]);
    notifications.countUnreadNotifications.mockResolvedValue(1);

    const res = await request(app).get("/notifications").set(member);

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ notifications: [{ id: 1 }], unreadCount: 1 });
    expect(notifications.findNotificationsByRecipient).toHaveBeenCalledWith("member-id");
  });

  test("PATCH /notifications/read → unreadCount 0", async () => {
    const res = await request(app).patch("/notifications/read").set(member);

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ unreadCount: 0 });
    expect(notifications.markAllAsRead).toHaveBeenCalledWith("member-id");
  });

  test("invalid token → 401", async () => {
    const res = await request(app).get("/notifications").set(authHeader("garbage"));
    expect(res.status).toBe(401);
  });
});

describe("avatars", () => {
  const png = Buffer.from("fake-png");

  test("POST /avatars uploads the file for the signed-in user → 201", async () => {
    avatarService.uploadAvatar.mockResolvedValue({ avatarUrl: "https://cdn/a.png", path: "p" });

    const res = await request(app)
      .post("/avatars")
      .set(member)
      .attach("avatar", png, { filename: "a.png", contentType: "image/png" });

    expect(res.status).toBe(201);
    expect(res.body).toEqual({ avatarUrl: "https://cdn/a.png", path: "p" });
    const [userId, file, token] = avatarService.uploadAvatar.mock.calls[0];
    expect(userId).toBe("member-id");
    expect(file).toMatchObject({ originalname: "a.png", mimetype: "image/png" });
    expect(token).toBe("member-token");
  });

  test("non-image upload → 400 before reaching the service", async () => {
    const res = await request(app)
      .post("/avatars")
      .set(member)
      .attach("avatar", Buffer.from("hi"), { filename: "a.txt", contentType: "text/plain" });

    expect(res.status).toBe(400);
    expect(res.body).toEqual({ message: "Use a JPG, PNG, WebP, or GIF image." });
    expect(avatarService.uploadAvatar).not.toHaveBeenCalled();
  });

  test("file over 2 MB → 400", async () => {
    const res = await request(app)
      .post("/avatars")
      .set(member)
      .attach("avatar", Buffer.alloc(2 * 1024 * 1024 + 1), {
        filename: "big.png",
        contentType: "image/png",
      });

    expect(res.status).toBe(400);
    expect(res.body).toEqual({ message: "The avatar must be 2 MB or smaller." });
  });

  test("DELETE /avatars → 204 and forwards the url", async () => {
    const res = await request(app)
      .delete("/avatars")
      .set(member)
      .send({ avatarUrl: "https://cdn/a.png" });

    expect(res.status).toBe(204);
    expect(avatarService.deleteAvatar).toHaveBeenCalledWith("https://cdn/a.png", "member-token");
  });
});

describe("app-level behaviour", () => {
  test("allowed origins get CORS headers; unknown routes are JSON 404", async () => {
    const ok = await request(app).get("/health").set("Origin", "http://localhost:5173");
    expect(ok.status).toBe(200);
    expect(ok.headers["access-control-allow-origin"]).toBe("http://localhost:5173");

    const missing = await request(app).get("/nope");
    expect(missing.status).toBe(404);
    expect(missing.body).toEqual({ message: "Route not found" });
  });

  test("malformed JSON body → 500 from the catch-all handler", async () => {
    const res = await request(app)
      .post("/categories")
      .set("Content-Type", "application/json")
      .send("{not json");
    expect(res.status).toBe(500);
    expect(res.body).toEqual({ message: "Internal server error" });
  });
});
