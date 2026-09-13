/**
 * Integration Test — POST /posts
 *
 * Happy:
 * - admin + valid body → 201 + { post }
 *
 * Error (จากห้อง):
 * - missing title → 400 validation (service ไม่ถูกเรียก)
 *
 * Error (ออกแบบเอง):
 * - no auth token → 401 (reject ก่อนถึง validation/service)
 */

import {
  afterAll,
  beforeAll,
  beforeEach,
  describe,
  expect,
  test,
  vi,
} from "vitest";
import request from "supertest";

const createPostMock = vi.hoisted(() => vi.fn());

vi.mock("../middlewares/protectAdmin.mjs", () => ({
  default: (req, res, next) => {
    const token = req.headers.authorization?.split(" ")[1];

    if (!token) {
      return res.status(401).json({ message: "Authentication is required" });
    }

    req.user = { id: "admin-user-id", role: "admin" };
    return next();
  },
}));

vi.mock("../services/postService.mjs", async (importOriginal) => {
  const actual = await importOriginal();

  return {
    ...actual,
    createPost: createPostMock,
  };
});

const validBody = {
  title: "Integration Test Post",
  image: "https://example.com/image.jpg",
  category_id: 1,
  description: "A valid short description",
  content: "Full article content for integration testing",
  status: "published",
};

const adminAuth = { Authorization: "Bearer test-admin-token" };

let app;
let connectionPool;

beforeAll(async () => {
  process.env.NODE_ENV = "test";
  ({ default: app } = await import("../app.mjs"));
  ({ default: connectionPool } = await import("../utils/db.mjs"));
});

afterAll(async () => {
  await connectionPool.end();
});

beforeEach(() => {
  createPostMock.mockReset();
});

describe("POST /posts (integration)", () => {
  test("Happy Path: admin creates post with valid body → 201", async () => {
    const mockPost = {
      id: 1,
      title: validBody.title,
      image: validBody.image,
      categoryId: 1,
      category: "Music",
      description: validBody.description,
      content: validBody.content,
      status: "published",
      likes: 0,
      author: "Admin",
    };

    createPostMock.mockResolvedValue({ post: mockPost });

    const res = await request(app)
      .post("/posts")
      .set(adminAuth)
      .send(validBody);

    // Level 1 — Status
    expect(res.status).toBe(201);

    // Level 2 — Body / Schema
    expect(res.body).toHaveProperty("post");
    expect(res.body.post).toMatchObject({
      id: expect.any(Number),
      title: validBody.title,
      image: validBody.image,
      categoryId: 1,
      description: validBody.description,
      content: validBody.content,
      status: "published",
    });

    // Level 3 — side effects / no error path
    expect(createPostMock).toHaveBeenCalledOnce();
    expect(createPostMock).toHaveBeenCalledWith(
      expect.objectContaining({
        title: validBody.title,
        categoryId: 1,
        status: "publish",
      }),
      "admin-user-id",
    );
    expect(res.body).not.toHaveProperty("message", "Unable to create the article");
  });

  test("Error: missing title → 400 validation", async () => {
    const { title: _title, ...bodyWithoutTitle } = validBody;

    const res = await request(app)
      .post("/posts")
      .set(adminAuth)
      .send(bodyWithoutTitle);

    // Level 1 — Status
    expect(res.status).toBe(400);

    // Level 2 — Body / Schema
    expect(res.body).toEqual({ message: "Title is required" });

    // Level 3 — service must not run on validation failure
    expect(createPostMock).not.toHaveBeenCalled();
  });

  test("Error: no auth token → 401", async () => {
    const res = await request(app).post("/posts").send(validBody);

    // Level 1 — Status
    expect(res.status).toBe(401);

    // Level 2 — Body / Schema
    expect(res.body).toEqual({ message: "Authentication is required" });

    // Level 3 — blocked before validation/service
    expect(createPostMock).not.toHaveBeenCalled();
  });
});
