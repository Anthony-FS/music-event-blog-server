// Real router + controller + service + auth middleware; only the repositories
// and Supabase are faked.
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
vi.mock("../../repositories/categoryRepository.mjs", () => ({
  findAllCategories: vi.fn(),
  findDuplicateCategory: vi.fn(),
  createCategory: vi.fn(),
  updateCategory: vi.fn(),
  countPostsUsingCategory: vi.fn(),
  deleteCategory: vi.fn(),
}));

import { authHeader } from "../helpers/auth.mjs";
import * as repo from "../../repositories/categoryRepository.mjs";

let app;
const admin = authHeader("admin-token");
const member = authHeader("member-token");

beforeAll(async () => {
  process.env.NODE_ENV = "test";
  ({ default: app } = await import("../../app.mjs"));
});
beforeEach(() => vi.resetAllMocks());

describe("GET /categories (public)", () => {
  test("200 + { categories }", async () => {
    repo.findAllCategories.mockResolvedValue([{ id: 1, name: "Jazz" }]);

    const res = await request(app).get("/categories");

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ categories: [{ id: 1, name: "Jazz" }] });
  });

  test("repository failure → 500 with a stable message", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    repo.findAllCategories.mockRejectedValue(new Error("db down"));

    const res = await request(app).get("/categories");

    expect(res.status).toBe(500);
    expect(res.body).toEqual({ message: "Unable to load categories" });
  });
});

describe("POST /categories", () => {
  test("no token → 401", async () => {
    const res = await request(app).post("/categories").send({ name: "Jazz" });
    expect(res.status).toBe(401);
    expect(repo.createCategory).not.toHaveBeenCalled();
  });

  test("invalid token → 401", async () => {
    const res = await request(app)
      .post("/categories")
      .set(authHeader("garbage"))
      .send({ name: "Jazz" });
    expect(res.status).toBe(401);
    expect(res.body).toEqual({ message: "Invalid or expired token" });
  });

  test("member → 403", async () => {
    const res = await request(app).post("/categories").set(member).send({ name: "Jazz" });
    expect(res.status).toBe(403);
    expect(res.body).toEqual({ message: "Admin access is required" });
    expect(repo.createCategory).not.toHaveBeenCalled();
  });

  test("admin creates → 201", async () => {
    repo.findDuplicateCategory.mockResolvedValue(false);
    repo.createCategory.mockResolvedValue({ id: 5, name: "Jazz" });

    const res = await request(app).post("/categories").set(admin).send({ name: " Jazz " });

    expect(res.status).toBe(201);
    expect(res.body).toEqual({ category: { id: 5, name: "Jazz" } });
    expect(repo.createCategory).toHaveBeenCalledWith("Jazz");
  });

  test("blank name → 400, duplicate → 409", async () => {
    const blank = await request(app).post("/categories").set(admin).send({ name: " " });
    expect(blank.status).toBe(400);

    repo.findDuplicateCategory.mockResolvedValue(true);
    const dup = await request(app).post("/categories").set(admin).send({ name: "Jazz" });
    expect(dup.status).toBe(409);
    expect(dup.body).toEqual({ message: "Category already exists" });
  });
});

describe("PATCH /categories/:id", () => {
  test("admin renames → 200", async () => {
    repo.findDuplicateCategory.mockResolvedValue(false);
    repo.updateCategory.mockResolvedValue({ id: 2, name: "Blues" });

    const res = await request(app).patch("/categories/2").set(admin).send({ name: "Blues" });

    expect(res.status).toBe(200);
    expect(res.body.category).toEqual({ id: 2, name: "Blues" });
  });

  test("bad id → 400, unknown id → 404", async () => {
    const bad = await request(app).patch("/categories/abc").set(admin).send({ name: "x" });
    expect(bad.status).toBe(400);

    repo.findDuplicateCategory.mockResolvedValue(false);
    repo.updateCategory.mockResolvedValue(undefined);
    const missing = await request(app).patch("/categories/99").set(admin).send({ name: "x" });
    expect(missing.status).toBe(404);
  });
});

describe("DELETE /categories/:id", () => {
  test("member → 403", async () => {
    const res = await request(app).delete("/categories/1").set(member);
    expect(res.status).toBe(403);
  });

  test("in use → 409, unused → 204 with empty body", async () => {
    repo.countPostsUsingCategory.mockResolvedValue(1);
    const inUse = await request(app).delete("/categories/1").set(admin);
    expect(inUse.status).toBe(409);

    repo.countPostsUsingCategory.mockResolvedValue(0);
    repo.deleteCategory.mockResolvedValue(true);
    const ok = await request(app).delete("/categories/1").set(admin);
    expect(ok.status).toBe(204);
    expect(ok.text).toBe("");
  });
});
