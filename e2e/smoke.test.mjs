// Live smoke: runs against the deployed API and is READ-ONLY on purpose — no
// valid token, no successful writes. Point it elsewhere with E2E_BASE_URL.
// The API is on a free tier and cold-starts, hence the generous timeout.
import { describe, expect, test } from "vitest";

const BASE = (process.env.E2E_BASE_URL ?? "https://music-event-blog-server.vercel.app").replace(/\/$/, "");
const get = (path, init) => fetch(BASE + path, init);

describe(`live API smoke (${BASE})`, { timeout: 30_000 }, () => {
  test("GET /health is up", async () => {
    const res = await get("/health");
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ message: "OK" });
  });

  test("GET /health/db reaches the database", async () => {
    const res = await get("/health/db");
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ message: "OK", posts: expect.any(Number) });
  });

  test("GET /posts returns a paginated page of published articles", async () => {
    const res = await get("/posts?limit=2");
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toMatchObject({
      totalPosts: expect.any(Number),
      currentPage: 1,
      limit: 2,
      posts: expect.any(Array),
    });
    expect(body.posts.length).toBeLessThanOrEqual(2);
  });

  test("an article from the list can be fetched by id", async () => {
    const { posts } = await (await get("/posts?limit=1")).json();
    if (posts.length === 0) return; // empty catalogue: nothing to open
    const res = await get(`/posts/${posts[0].id}`);
    expect(res.status).toBe(200);
    expect((await res.json()).post).toMatchObject({ id: posts[0].id, title: posts[0].title });
  });

  test("GET /categories lists categories", async () => {
    const res = await get("/categories");
    expect(res.status).toBe(200);
    expect(Array.isArray((await res.json()).categories)).toBe(true);
  });

  test("a malformed article id is a 400, an unknown route a JSON 404", async () => {
    expect((await get("/posts/not-a-number")).status).toBe(400);
    const missing = await get("/this-route-does-not-exist");
    expect(missing.status).toBe(404);
    expect(await missing.json()).toEqual({ message: "Route not found" });
  });

  test("protected endpoints reject anonymous callers without side effects", async () => {
    for (const [method, path] of [
      ["POST", "/posts"],
      ["POST", "/categories"],
      ["GET", "/notifications"],
      ["POST", "/posts/1/likes"],
      ["POST", "/avatars"],
    ]) {
      const res = await get(path, { method });
      expect(res.status, `${method} ${path}`).toBe(401);
    }
  });

  test("a disallowed browser origin is rejected", async () => {
    const res = await get("/health", { headers: { Origin: "https://example.invalid" } });
    expect(res.status).toBe(403);
  });
});
