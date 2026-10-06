import { beforeEach, describe, expect, test, vi } from "vitest";

const client = vi.hoisted(() => ({ query: vi.fn(), release: vi.fn() }));

vi.mock("../../utils/db.mjs", () => ({
  default: { connect: vi.fn(async () => client), query: vi.fn() },
}));
vi.mock("../../repositories/postRepository.mjs");

import * as repo from "../../repositories/postRepository.mjs";
import * as service from "../../services/postService.mjs";

const admin = { id: "admin-id", role: "admin" };
const member = { id: "member-id", role: "member" };
const rejectsWith = (promise, status, message) =>
  expect(promise).rejects.toMatchObject({ status, message });
const sql = () => client.query.mock.calls.map(([text]) => text);

beforeEach(() => {
  vi.resetAllMocks();
  client.query.mockResolvedValue({ rows: [] });
});

describe("listPosts", () => {
  beforeEach(() => {
    repo.countPosts.mockResolvedValue(13);
    repo.findPosts.mockResolvedValue([{ id: 1 }]);
  });

  test("visitors only see published posts and get pagination metadata", async () => {
    const result = await service.listPosts({ page: "2", limit: "6" }, undefined);

    expect(repo.countPosts).toHaveBeenCalledWith("where statuses.status = $1", ["publish"]);
    expect(repo.findPosts).toHaveBeenCalledWith(expect.any(String), ["publish"], 6, 6);
    expect(result).toMatchObject({
      totalPosts: 13,
      totalPages: 3,
      currentPage: 2,
      limit: 6,
      nextPage: 3,
      hasMore: true,
    });
  });

  test("a member cannot widen visibility with ?status=draft", async () => {
    await service.listPosts({ status: "draft" }, member);
    expect(repo.countPosts.mock.calls[0][1]).toEqual(["publish"]);
  });

  test("admins can filter by status, with 'published' mapped to 'publish'", async () => {
    await service.listPosts({ status: "published" }, admin);
    expect(repo.countPosts.mock.calls[0][1]).toEqual(["publish"]);

    await service.listPosts({ status: "draft" }, admin);
    expect(repo.countPosts.mock.calls[1][1]).toEqual(["draft"]);
  });

  test("admins without a status filter see everything", async () => {
    await service.listPosts({}, admin);
    expect(repo.countPosts).toHaveBeenCalledWith("", []);
  });

  test("limit is capped at 100 and bad paging falls back to defaults", async () => {
    const result = await service.listPosts({ page: "-1", limit: "5000" }, undefined);
    expect(result).toMatchObject({ currentPage: 1, limit: 100 });
  });

  test("category id wins over category name; search matches three columns", async () => {
    await service.listPosts({ categoryId: "4", category: "Jazz", search: "live" }, undefined);
    const [where, values] = repo.countPosts.mock.calls[0];

    expect(values).toEqual(["publish", 4, "%live%"]);
    expect(where).toContain("posts.category_id = $2");
    expect(where).not.toContain("categories.name");
    expect(where).toContain("posts.content ilike $3");
  });

  test("last page has no next page", async () => {
    const result = await service.listPosts({ page: "3", limit: "6" }, undefined);
    expect(result).toMatchObject({ nextPage: null, hasMore: false });
  });
});

describe("getPost", () => {
  test("invalid id → 400", async () => {
    await rejectsWith(service.getPost("abc"), 400, "Invalid article id");
  });

  test("missing post → 404", async () => {
    repo.findPostById.mockResolvedValue(undefined);
    await rejectsWith(service.getPost("1"), 404, "Article not found");
  });

  test("drafts are hidden from visitors and members, visible to admins", async () => {
    repo.findPostById.mockResolvedValue({ id: 1, status: "draft" });
    repo.hasUserLikedPost.mockResolvedValue(false);

    await rejectsWith(service.getPost("1", undefined), 404, "Article not found");
    await rejectsWith(service.getPost("1", member), 404, "Article not found");
    await expect(service.getPost("1", admin)).resolves.toMatchObject({
      post: { id: 1 },
    });
  });

  test("likedByUser is false for visitors and looked up for users", async () => {
    repo.findPostById.mockResolvedValue({ id: 1, status: "publish" });
    repo.hasUserLikedPost.mockResolvedValue(true);

    const anon = await service.getPost("1");
    expect(anon.post.likedByUser).toBe(false);
    expect(repo.hasUserLikedPost).not.toHaveBeenCalled();

    repo.findPostById.mockResolvedValue({ id: 1, status: "publish" });
    const signedIn = await service.getPost("1", member);
    expect(signedIn.post.likedByUser).toBe(true);
    expect(repo.hasUserLikedPost).toHaveBeenCalledWith(1, "member-id");
  });
});

describe("getPostComments", () => {
  test("invalid id → 400", async () => {
    await rejectsWith(service.getPostComments("x"), 400, "Invalid article id");
  });

  test("missing post or draft for non-admin → 404", async () => {
    repo.findPostStatus.mockResolvedValue(undefined);
    await rejectsWith(service.getPostComments("1"), 404, "Article not found");

    repo.findPostStatus.mockResolvedValue({ status: "draft" });
    await rejectsWith(service.getPostComments("1", member), 404, "Article not found");
  });

  test("returns comments for a published post", async () => {
    repo.findPostStatus.mockResolvedValue({ status: "publish" });
    repo.findCommentsByPostId.mockResolvedValue([{ id: 9 }]);
    await expect(service.getPostComments("1")).resolves.toEqual({ comments: [{ id: 9 }] });
  });
});

describe("createPost", () => {
  const body = { title: "T", categoryId: 1, status: "publish" };

  test("commits and returns the new post", async () => {
    repo.findCategoryById.mockResolvedValue(true);
    repo.findStatusByName.mockResolvedValue({ id: 2 });
    repo.insertPost.mockResolvedValue(10);
    repo.findPostById.mockResolvedValue({ id: 10 });

    await expect(service.createPost(body, "admin-id")).resolves.toEqual({ post: { id: 10 } });
    expect(repo.insertPost).toHaveBeenCalledWith(
      client,
      expect.objectContaining({ statusId: 2, authorId: "admin-id" }),
    );
    expect(sql()).toEqual(["begin", "commit"]);
    expect(client.release).toHaveBeenCalledOnce();
  });

  test("unknown category → 400, rolled back, connection released", async () => {
    repo.findCategoryById.mockResolvedValue(false);
    repo.findStatusByName.mockResolvedValue({ id: 2 });

    await rejectsWith(service.createPost(body, "a"), 400, "Category does not exist");
    expect(sql()).toEqual(["begin", "rollback"]);
    expect(repo.insertPost).not.toHaveBeenCalled();
    expect(client.release).toHaveBeenCalledOnce();
  });

  test("unknown status → 400", async () => {
    repo.findCategoryById.mockResolvedValue(true);
    repo.findStatusByName.mockResolvedValue(undefined);
    await rejectsWith(service.createPost(body, "a"), 400, "Status does not exist");
  });
});

describe("updatePost", () => {
  const body = { categoryId: 1, status: "draft" };

  test("invalid id → 400 before touching the database", async () => {
    await rejectsWith(service.updatePost("nope", body), 400, "Invalid article id");
    expect(client.query).not.toHaveBeenCalled();
  });

  test("unknown category or status → 400", async () => {
    repo.findCategoryById.mockResolvedValue(false);
    repo.findStatusByName.mockResolvedValue({ id: 1 });
    await rejectsWith(service.updatePost("1", body), 400, "Category or status does not exist");
    expect(sql()).toEqual(["begin", "rollback"]);
  });

  test("missing post → 404", async () => {
    repo.findCategoryById.mockResolvedValue(true);
    repo.findStatusByName.mockResolvedValue({ id: 1 });
    repo.updatePost.mockResolvedValue(false);
    await rejectsWith(service.updatePost("1", body), 404, "Article not found");
  });

  test("success commits and returns the post", async () => {
    repo.findCategoryById.mockResolvedValue(true);
    repo.findStatusByName.mockResolvedValue({ id: 1 });
    repo.updatePost.mockResolvedValue(true);
    repo.findPostById.mockResolvedValue({ id: 1 });

    await expect(service.updatePost("1", body)).resolves.toEqual({ post: { id: 1 } });
    expect(sql()).toEqual(["begin", "commit"]);
  });
});

describe("removePost", () => {
  test("invalid id → 400, missing → 404, found → resolves", async () => {
    await rejectsWith(service.removePost("x"), 400, "Invalid article id");

    repo.deletePost.mockResolvedValue(false);
    await rejectsWith(service.removePost("1"), 404, "Article not found");

    repo.deletePost.mockResolvedValue(true);
    await expect(service.removePost("1")).resolves.toBeUndefined();
  });
});

describe("likePost", () => {
  test("invalid id → 400", async () => {
    await rejectsWith(service.likePost("x", "u"), 400, "Invalid article id");
  });

  test("missing post → 404 and rollback", async () => {
    repo.findPostForLike.mockResolvedValue(undefined);
    await rejectsWith(service.likePost("1", "u"), 404, "Article not found");
    expect(sql()).toEqual(["begin", "rollback"]);
    expect(client.release).toHaveBeenCalledOnce();
  });

  test("first like notifies the author", async () => {
    repo.findPostForLike.mockResolvedValue({ author_id: "author" });
    repo.insertLike.mockResolvedValue(true);
    repo.getLikesCount.mockResolvedValue(1);

    await expect(service.likePost("1", "u")).resolves.toEqual({
      likes: 1,
      likedByUser: true,
      alreadyLiked: false,
    });
    expect(repo.insertLikeNotification).toHaveBeenCalledWith(client, "author", "u", 1);
  });

  test("repeat like is idempotent and sends no notification", async () => {
    repo.findPostForLike.mockResolvedValue({ author_id: "author" });
    repo.insertLike.mockResolvedValue(false);
    repo.getLikesCount.mockResolvedValue(1);

    await expect(service.likePost("1", "u")).resolves.toMatchObject({ alreadyLiked: true });
    expect(repo.insertLikeNotification).not.toHaveBeenCalled();
  });

  test("liking your own post sends no notification", async () => {
    repo.findPostForLike.mockResolvedValue({ author_id: "u" });
    repo.insertLike.mockResolvedValue(true);
    repo.getLikesCount.mockResolvedValue(1);

    await service.likePost("1", "u");
    expect(repo.insertLikeNotification).not.toHaveBeenCalled();
  });
});

describe("unlikePost", () => {
  test("missing post → 404", async () => {
    repo.findPostAuthorForUnlike.mockResolvedValue(undefined);
    await rejectsWith(service.unlikePost("1", "u"), 404, "Article not found");
  });

  test("removes the like and its notification", async () => {
    repo.findPostAuthorForUnlike.mockResolvedValue({ author_id: "author" });
    repo.deleteLike.mockResolvedValue(true);
    repo.getLikesCount.mockResolvedValue(0);

    await expect(service.unlikePost("1", "u")).resolves.toEqual({
      likes: 0,
      likedByUser: false,
      alreadyUnliked: false,
    });
    expect(repo.deleteLikeNotification).toHaveBeenCalledWith(client, "author", "u", 1);
  });

  test("unliking when not liked is idempotent", async () => {
    repo.findPostAuthorForUnlike.mockResolvedValue({ author_id: "author" });
    repo.deleteLike.mockResolvedValue(false);
    repo.getLikesCount.mockResolvedValue(0);

    await expect(service.unlikePost("1", "u")).resolves.toMatchObject({ alreadyUnliked: true });
    expect(repo.deleteLikeNotification).not.toHaveBeenCalled();
  });
});

describe("addComment", () => {
  test("invalid id → 400", async () => {
    await rejectsWith(service.addComment("x", "u", "hi"), 400, "Invalid article id");
  });

  test.each([undefined, "", "   "])("empty message %j → 400", async (message) => {
    await rejectsWith(service.addComment("1", "u", message), 400, "Comment is required");
  });

  test("message over 1000 chars → 400, exactly 1000 allowed", async () => {
    await rejectsWith(
      service.addComment("1", "u", "a".repeat(1001)),
      400,
      "Comment must be 1000 characters or fewer",
    );

    repo.findPublishedPostForComment.mockResolvedValue({ author_id: "author" });
    repo.insertComment.mockResolvedValue(5);
    repo.findCommentById.mockResolvedValue({ id: 5 });
    await expect(service.addComment("1", "u", "a".repeat(1000))).resolves.toEqual({
      comment: { id: 5 },
    });
  });

  test("unpublished or missing post → 404", async () => {
    repo.findPublishedPostForComment.mockResolvedValue(undefined);
    await rejectsWith(service.addComment("1", "u", "hi"), 404, "Article not found");
    expect(sql()).toEqual(["begin", "rollback"]);
  });

  test("trims the message and notifies the author", async () => {
    repo.findPublishedPostForComment.mockResolvedValue({ author_id: "author" });
    repo.insertComment.mockResolvedValue(5);
    repo.findCommentById.mockResolvedValue({ id: 5 });

    await service.addComment("1", "u", "  nice  ");
    expect(repo.insertComment).toHaveBeenCalledWith(client, 1, "u", "nice");
    expect(repo.insertCommentNotification).toHaveBeenCalledWith(client, "author", "u", 1, 5);
  });

  test("commenting on your own post sends no notification", async () => {
    repo.findPublishedPostForComment.mockResolvedValue({ author_id: "u" });
    repo.insertComment.mockResolvedValue(5);
    repo.findCommentById.mockResolvedValue({ id: 5 });

    await service.addComment("1", "u", "hi");
    expect(repo.insertCommentNotification).not.toHaveBeenCalled();
  });
});
