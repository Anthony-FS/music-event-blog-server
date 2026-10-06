// Real router + controller + service + auth/validation middleware; only the
// post repository, db pool and Supabase are faked. (Create-post happy/error
// paths with a mocked service live in ../posts.create.integration.test.mjs.)
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
vi.mock("../../repositories/postRepository.mjs");

import { authHeader } from "../helpers/auth.mjs";
import * as repo from "../../repositories/postRepository.mjs";

let app;
const admin = authHeader("admin-token");
const member = authHeader("member-token");

const validBody = {
  title: "Gig night",
  image: "https://example.com/a.jpg",
  category_id: 1,
  description: "Short description",
  content: "Long content",
  status: "published",
};

beforeAll(async () => {
  process.env.NODE_ENV = "test";
  ({ default: app } = await import("../../app.mjs"));
});
beforeEach(() => {
  vi.resetAllMocks();
  vi.spyOn(console, "error").mockImplementation(() => {});
});

describe("GET /posts", () => {
  beforeEach(() => {
    repo.countPosts.mockResolvedValue(1);
    repo.findPosts.mockResolvedValue([{ id: 1, title: "Gig night" }]);
  });

  test("anonymous gets published posts only, with pagination metadata", async () => {
    const res = await request(app).get("/posts?page=1&limit=6");

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      totalPosts: 1,
      totalPages: 1,
      currentPage: 1,
      limit: 6,
      posts: [{ id: 1, title: "Gig night" }],
      nextPage: null,
      hasMore: false,
    });
    expect(repo.countPosts.mock.calls[0][1]).toEqual(["publish"]);
  });

  test("admin token unlocks the status filter", async () => {
    await request(app).get("/posts?status=draft").set(admin);
    expect(repo.countPosts.mock.calls[0][1]).toEqual(["draft"]);
  });

  test("a bad token degrades to anonymous instead of failing the read", async () => {
    const res = await request(app).get("/posts?status=draft").set(authHeader("garbage"));
    expect(res.status).toBe(200);
    expect(repo.countPosts.mock.calls[0][1]).toEqual(["publish"]);
  });
});

describe("GET /posts/:id", () => {
  test("200 for a published post, with likedByUser false when anonymous", async () => {
    repo.findPostById.mockResolvedValue({ id: 1, status: "publish" });

    const res = await request(app).get("/posts/1");

    expect(res.status).toBe(200);
    expect(res.body.post).toMatchObject({ id: 1, likedByUser: false });
  });

  test("likedByUser reflects the signed-in user", async () => {
    repo.findPostById.mockResolvedValue({ id: 1, status: "publish" });
    repo.hasUserLikedPost.mockResolvedValue(true);

    const res = await request(app).get("/posts/1").set(member);

    expect(res.body.post.likedByUser).toBe(true);
    expect(repo.hasUserLikedPost).toHaveBeenCalledWith(1, "member-id");
  });

  test("draft → 404 for a member, 200 for an admin", async () => {
    repo.findPostById.mockResolvedValue({ id: 1, status: "draft" });

    expect((await request(app).get("/posts/1").set(member)).status).toBe(404);
    expect((await request(app).get("/posts/1").set(admin)).status).toBe(200);
  });

  test("non-numeric id → 400", async () => {
    const res = await request(app).get("/posts/abc");
    expect(res.status).toBe(400);
    expect(res.body).toEqual({ message: "Invalid article id" });
  });
});

describe("GET /posts/:id/comments", () => {
  test("returns comments for a published post", async () => {
    repo.findPostStatus.mockResolvedValue({ status: "publish" });
    repo.findCommentsByPostId.mockResolvedValue([{ id: 3, message: "hi" }]);

    const res = await request(app).get("/posts/1/comments");

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ comments: [{ id: 3, message: "hi" }] });
  });

  test("unknown post → 404", async () => {
    repo.findPostStatus.mockResolvedValue(undefined);
    expect((await request(app).get("/posts/1/comments")).status).toBe(404);
  });
});

describe("PATCH /posts/:id and DELETE /posts/:id", () => {
  test("PATCH needs admin, validates, then updates", async () => {
    expect((await request(app).patch("/posts/1").send(validBody)).status).toBe(401);
    expect((await request(app).patch("/posts/1").set(member).send(validBody)).status).toBe(403);
    expect(
      (await request(app).patch("/posts/1").set(admin).send({ ...validBody, title: "" })).status,
    ).toBe(400);

    repo.findCategoryById.mockResolvedValue(true);
    repo.findStatusByName.mockResolvedValue({ id: 2 });
    repo.updatePost.mockResolvedValue(true);
    repo.findPostById.mockResolvedValue({ id: 1, title: "Gig night" });

    const ok = await request(app).patch("/posts/1").set(admin).send(validBody);
    expect(ok.status).toBe(200);
    expect(ok.body.post).toEqual({ id: 1, title: "Gig night" });
  });

  test("DELETE needs admin; 404 when missing, 204 when deleted", async () => {
    expect((await request(app).delete("/posts/1").set(member)).status).toBe(403);

    repo.deletePost.mockResolvedValue(false);
    expect((await request(app).delete("/posts/1").set(admin)).status).toBe(404);

    repo.deletePost.mockResolvedValue(true);
    expect((await request(app).delete("/posts/1").set(admin)).status).toBe(204);
  });
});

describe("POST /posts (create, service un-mocked)", () => {
  test("admin + valid body → 201 and the author is the admin", async () => {
    repo.findCategoryById.mockResolvedValue(true);
    repo.findStatusByName.mockResolvedValue({ id: 2 });
    repo.insertPost.mockResolvedValue(10);
    repo.findPostById.mockResolvedValue({ id: 10 });

    const res = await request(app).post("/posts").set(admin).send(validBody);

    expect(res.status).toBe(201);
    expect(res.body).toEqual({ post: { id: 10 } });
    expect(repo.insertPost).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ authorId: "admin-id", statusId: 2, categoryId: 1 }),
    );
  });

  test("unknown category surfaces as 400 from the service", async () => {
    repo.findCategoryById.mockResolvedValue(false);
    repo.findStatusByName.mockResolvedValue({ id: 2 });

    const res = await request(app).post("/posts").set(admin).send(validBody);

    expect(res.status).toBe(400);
    expect(res.body).toEqual({ message: "Category does not exist" });
  });
});

describe("likes", () => {
  test("POST /posts/:id/likes → 200 and notifies the author", async () => {
    repo.findPostForLike.mockResolvedValue({ author_id: "author-id" });
    repo.insertLike.mockResolvedValue(true);
    repo.getLikesCount.mockResolvedValue(4);

    const res = await request(app).post("/posts/1/likes").set(member);

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ likes: 4, likedByUser: true, alreadyLiked: false });
    expect(repo.insertLikeNotification).toHaveBeenCalledOnce();
  });

  test("DELETE /posts/:id/likes → 200", async () => {
    repo.findPostAuthorForUnlike.mockResolvedValue({ author_id: "author-id" });
    repo.deleteLike.mockResolvedValue(true);
    repo.getLikesCount.mockResolvedValue(3);

    const res = await request(app).delete("/posts/1/likes").set(member);

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ likes: 3, likedByUser: false, alreadyUnliked: false });
  });

  test("liking a missing post → 404", async () => {
    repo.findPostForLike.mockResolvedValue(undefined);
    expect((await request(app).post("/posts/1/likes").set(member)).status).toBe(404);
  });
});

describe("POST /posts/:id/comments", () => {
  beforeEach(() => {
    repo.findPublishedPostForComment.mockResolvedValue({ author_id: "author-id" });
    repo.insertComment.mockResolvedValue(7);
    repo.findCommentById.mockResolvedValue({ id: 7, message: "great" });
  });

  test("member comments → 201", async () => {
    const res = await request(app)
      .post("/posts/1/comments")
      .set(member)
      .send({ message: "great" });

    expect(res.status).toBe(201);
    expect(res.body).toEqual({ comment: { id: 7, message: "great" } });
  });

  test("empty and oversized comments → 400", async () => {
    const empty = await request(app).post("/posts/1/comments").set(member).send({});
    expect(empty.status).toBe(400);
    expect(empty.body).toEqual({ message: "Comment is required" });

    const long = await request(app)
      .post("/posts/1/comments")
      .set(member)
      .send({ message: "a".repeat(1001) });
    expect(long.status).toBe(400);
  });

  test("unexpected database error → 500 with a stable message", async () => {
    repo.insertComment.mockRejectedValue(new Error("boom"));

    const res = await request(app).post("/posts/1/comments").set(member).send({ message: "x" });

    expect(res.status).toBe(500);
    expect(res.body).toEqual({ message: "Unable to add the comment" });
  });
});
