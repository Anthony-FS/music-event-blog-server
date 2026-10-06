// Hermetic e2e: the real Express app on a real port, driven with fetch.
// Supabase, Postgres and the repositories are stubbed (see fakes.mjs), so this
// is safe on every push and is where write flows belong.
import { afterAll, beforeAll, beforeEach, describe, expect, test, vi } from "vitest";

vi.mock("../../utils/supabase.mjs", async () => ({
  default: { auth: { getUser: (await import("../../test/helpers/auth.mjs")).getUser } },
}));
vi.mock("../../repositories/userRepository.mjs", async () => ({
  findProfileRole: (await import("../../test/helpers/auth.mjs")).findProfileRole,
}));
vi.mock("../../utils/db.mjs", async () => ({
  default: (await import("../../test/helpers/auth.mjs")).makePool(),
}));
vi.mock("../../repositories/categoryRepository.mjs", async () => (await import("./fakes.mjs")).categoryRepository);
vi.mock("../../repositories/notificationRepository.mjs", async () => (await import("./fakes.mjs")).notificationRepository);
vi.mock("../../repositories/postRepository.mjs", async () => (await import("./fakes.mjs")).postRepository);

import { resetStore } from "./fakes.mjs";

let server;
let base;

const call = async (method, path, { token, body } = {}) => {
  const res = await fetch(base + path, {
    method,
    headers: {
      ...(token && { Authorization: `Bearer ${token}` }),
      ...(body && { "Content-Type": "application/json" }),
    },
    body: body && JSON.stringify(body),
  });
  const text = await res.text();
  return { status: res.status, body: text ? JSON.parse(text) : null };
};

const article = (categoryId, overrides = {}) => ({
  title: "Live at the park",
  image: "https://example.com/a.jpg",
  categoryId,
  description: "A great night",
  content: "Full review",
  status: "published",
  ...overrides,
});

beforeAll(async () => {
  process.env.NODE_ENV = "test";
  const { default: app } = await import("../../app.mjs");
  await new Promise((resolve) => {
    server = app.listen(0, resolve);
  });
  base = `http://127.0.0.1:${server.address().port}`;
});
afterAll(() => new Promise((resolve) => server.close(resolve)));
beforeEach(() => resetStore());

describe("health and routing", () => {
  test("GET /health is up and unknown routes are JSON 404", async () => {
    expect(await call("GET", "/health")).toEqual({ status: 200, body: { message: "OK" } });
    expect(await call("GET", "/nope")).toEqual({
      status: 404,
      body: { message: "Route not found" },
    });
  });
});

describe("admin publishes, a member reacts", () => {
  test("category → article → read → like → comment → notifications → cleanup", async () => {
    // Admin sets up the catalogue.
    const created = await call("POST", "/categories", {
      token: "admin-token",
      body: { name: "Festivals" },
    });
    expect(created.status).toBe(201);
    const categoryId = created.body.category.id;

    const post = await call("POST", "/posts", {
      token: "admin-token",
      body: article(categoryId),
    });
    expect(post.status).toBe(201);
    const postId = post.body.post.id;

    // Anyone can read it.
    const list = await call("GET", "/posts");
    expect(list.body).toMatchObject({ totalPosts: 1, posts: [{ id: postId, category: "Festivals" }] });
    const detail = await call("GET", `/posts/${postId}`);
    expect(detail.body.post).toMatchObject({ title: "Live at the park", likedByUser: false });

    // A member likes (idempotently) and comments.
    const like = await call("POST", `/posts/${postId}/likes`, { token: "member-token" });
    expect(like.body).toEqual({ likes: 1, likedByUser: true, alreadyLiked: false });
    const again = await call("POST", `/posts/${postId}/likes`, { token: "member-token" });
    expect(again.body).toMatchObject({ likes: 1, alreadyLiked: true });

    const comment = await call("POST", `/posts/${postId}/comments`, {
      token: "member-token",
      body: { message: "Wish I was there" },
    });
    expect(comment.status).toBe(201);
    const comments = await call("GET", `/posts/${postId}/comments`);
    expect(comments.body.comments).toHaveLength(1);

    const asMember = await call("GET", `/posts/${postId}`, { token: "member-token" });
    expect(asMember.body.post.likedByUser).toBe(true);

    // The author (admin) is notified exactly once per action, then clears them.
    const inbox = await call("GET", "/notifications", { token: "admin-token" });
    expect(inbox.body.unreadCount).toBe(2);
    expect(inbox.body.notifications.map((n) => n.type).sort()).toEqual(["comment", "like"]);
    const read = await call("PATCH", "/notifications/read", { token: "admin-token" });
    expect(read.body).toEqual({ unreadCount: 0 });
    expect((await call("GET", "/notifications", { token: "admin-token" })).body.unreadCount).toBe(0);

    // Unliking removes the like (and its notification).
    const unlike = await call("DELETE", `/posts/${postId}/likes`, { token: "member-token" });
    expect(unlike.body).toEqual({ likes: 0, likedByUser: false, alreadyUnliked: false });

    // A category in use cannot be removed until its article is gone.
    expect((await call("DELETE", `/categories/${categoryId}`, { token: "admin-token" })).status).toBe(409);
    expect((await call("DELETE", `/posts/${postId}`, { token: "admin-token" })).status).toBe(204);
    expect((await call("GET", `/posts/${postId}`)).status).toBe(404);
    expect((await call("DELETE", `/categories/${categoryId}`, { token: "admin-token" })).status).toBe(204);
    expect((await call("GET", "/categories")).body.categories).toEqual([]);
  });
});

describe("drafts and permissions", () => {
  test("a draft is invisible to the public and members, visible to admins", async () => {
    const { body } = await call("POST", "/categories", { token: "admin-token", body: { name: "Gigs" } });
    const draft = await call("POST", "/posts", {
      token: "admin-token",
      body: article(body.category.id, { status: "draft" }),
    });
    const id = draft.body.post.id;

    expect((await call("GET", "/posts")).body.totalPosts).toBe(0);
    expect((await call("GET", `/posts/${id}`)).status).toBe(404);
    expect((await call("GET", `/posts/${id}`, { token: "member-token" })).status).toBe(404);
    expect((await call("GET", `/posts/${id}`, { token: "admin-token" })).status).toBe(200);
    expect((await call("GET", "/posts?status=draft", { token: "admin-token" })).body.totalPosts).toBe(1);

    // Nobody can comment on or like-notify an unpublished article.
    expect(
      (await call("POST", `/posts/${id}/comments`, { token: "member-token", body: { message: "hi" } })).status,
    ).toBe(404);
  });

  test("members cannot write catalogue content; anonymous callers cannot do anything", async () => {
    expect((await call("POST", "/categories", { token: "member-token", body: { name: "x" } })).status).toBe(403);
    expect((await call("POST", "/posts", { token: "member-token", body: article(1) })).status).toBe(403);
    expect((await call("POST", "/categories", { body: { name: "x" } })).status).toBe(401);
    expect((await call("GET", "/notifications")).status).toBe(401);
    expect((await call("POST", "/posts/1/likes", { token: "garbage" })).status).toBe(401);
  });

  test("duplicate category names (case-insensitive) conflict", async () => {
    await call("POST", "/categories", { token: "admin-token", body: { name: "Jazz" } });
    const dup = await call("POST", "/categories", { token: "admin-token", body: { name: "jazz" } });
    expect(dup).toEqual({ status: 409, body: { message: "Category already exists" } });
  });

  test("validation errors are reported before anything is stored", async () => {
    const res = await call("POST", "/posts", {
      token: "admin-token",
      body: article(1, { description: "x".repeat(121) }),
    });
    expect(res).toEqual({
      status: 400,
      body: { message: "Description must not exceed 120 characters" },
    });
    expect((await call("GET", "/posts")).body.totalPosts).toBe(0);
  });
});
