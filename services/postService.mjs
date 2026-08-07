import connectionPool from "../utils/db.mjs";
import { HttpError } from "../utils/httpError.mjs";
import { toId, toPositiveInteger } from "../utils/parseParams.mjs";
import * as postRepository from "../repositories/postRepository.mjs";

function buildListFilters(query, user) {
  const page = toPositiveInteger(query.page, 1);
  const limit = Math.min(toPositiveInteger(query.limit, 6), 100);
  const offset = (page - 1) * limit;
  const search = String(query.search ?? query.keyword ?? "").trim();
  const category = String(query.category ?? "").trim();
  const categoryId = Number(query.categoryId);
  const requestedStatus = String(query.status ?? "").trim().toLowerCase();
  const status = requestedStatus === "published" ? "publish" : requestedStatus;
  const includeDrafts = user?.role === "admin";
  const conditions = [];
  const values = [];

  if (!includeDrafts) {
    values.push("publish");
    conditions.push(`statuses.status = $${values.length}`);
  } else if (status) {
    values.push(status);
    conditions.push(`statuses.status = $${values.length}`);
  }

  if (Number.isInteger(categoryId) && categoryId > 0) {
    values.push(categoryId);
    conditions.push(`posts.category_id = $${values.length}`);
  } else if (category) {
    values.push(category);
    conditions.push(`categories.name ilike $${values.length}`);
  }

  if (search) {
    values.push(`%${search}%`);
    conditions.push(
      `(posts.title ilike $${values.length} or posts.description ilike $${values.length} or posts.content ilike $${values.length})`,
    );
  }

  const whereClause =
    conditions.length > 0 ? `where ${conditions.join(" and ")}` : "";

  return { page, limit, offset, whereClause, values };
}

function assertPostVisible(post, user) {
  if (!post || (post.status === "draft" && user?.role !== "admin")) {
    throw new HttpError(404, "Article not found");
  }
}

export async function listPosts(query, user) {
  const { page, limit, offset, whereClause, values } = buildListFilters(
    query,
    user,
  );
  const totalPosts = await postRepository.countPosts(whereClause, values);
  const totalPages = Math.ceil(totalPosts / limit);
  const posts = await postRepository.findPosts(
    whereClause,
    values,
    limit,
    offset,
  );

  return {
    totalPosts,
    totalPages,
    currentPage: page,
    limit,
    posts,
    nextPage: page < totalPages ? page + 1 : null,
    hasMore: page < totalPages,
  };
}

export async function getPostComments(postIdValue, user) {
  const postId = toId(postIdValue);

  if (!postId) {
    throw new HttpError(400, "Invalid article id");
  }

  const post = await postRepository.findPostStatus(postId);

  if (!post || (post.status === "draft" && user?.role !== "admin")) {
    throw new HttpError(404, "Article not found");
  }

  const comments = await postRepository.findCommentsByPostId(postId);
  return { comments };
}

export async function getPost(postIdValue, user) {
  const postId = toId(postIdValue);

  if (!postId) {
    throw new HttpError(400, "Invalid article id");
  }

  const post = await postRepository.findPostById(postId);
  assertPostVisible(post, user);

  post.likedByUser = false;

  if (user) {
    post.likedByUser = await postRepository.hasUserLikedPost(postId, user.id);
  }

  return { post };
}

export async function createPost(body, authorId) {
  const client = await connectionPool.connect();

  try {
    await client.query("begin");

    const categoryExists = await postRepository.findCategoryById(
      client,
      body.categoryId,
    );
    const status = await postRepository.findStatusByName(client, body.status);

    if (!categoryExists) {
      throw new HttpError(400, "Category does not exist");
    }

    if (!status) {
      throw new HttpError(400, "Status does not exist");
    }

    const postId = await postRepository.insertPost(client, {
      ...body,
      statusId: status.id,
      authorId,
    });
    const post = await postRepository.findPostById(postId, client);

    await client.query("commit");
    return { post };
  } catch (error) {
    await client.query("rollback");
    throw error;
  } finally {
    client.release();
  }
}

export async function updatePost(postIdValue, body) {
  const postId = toId(postIdValue);

  if (!postId) {
    throw new HttpError(400, "Invalid article id");
  }

  const client = await connectionPool.connect();

  try {
    await client.query("begin");

    const categoryExists = await postRepository.findCategoryById(
      client,
      body.categoryId,
    );
    const status = await postRepository.findStatusByName(client, body.status);

    if (!categoryExists || !status) {
      throw new HttpError(400, "Category or status does not exist");
    }

    const updated = await postRepository.updatePost(client, postId, {
      ...body,
      statusId: status.id,
    });

    if (!updated) {
      throw new HttpError(404, "Article not found");
    }

    const post = await postRepository.findPostById(postId, client);

    await client.query("commit");
    return { post };
  } catch (error) {
    await client.query("rollback");
    throw error;
  } finally {
    client.release();
  }
}

export async function removePost(postIdValue) {
  const postId = toId(postIdValue);

  if (!postId) {
    throw new HttpError(400, "Invalid article id");
  }

  const deleted = await postRepository.deletePost(postId);

  if (!deleted) {
    throw new HttpError(404, "Article not found");
  }
}

export async function likePost(postIdValue, userId) {
  const postId = toId(postIdValue);

  if (!postId) {
    throw new HttpError(400, "Invalid article id");
  }

  const client = await connectionPool.connect();

  try {
    await client.query("begin");

    const post = await postRepository.findPostForLike(client, postId);

    if (!post) {
      throw new HttpError(404, "Article not found");
    }

    const liked = await postRepository.insertLike(client, postId, userId);

    if (liked && post.author_id !== userId) {
      await postRepository.insertLikeNotification(
        client,
        post.author_id,
        userId,
        postId,
      );
    }

    const likes = await postRepository.getLikesCount(client, postId);

    await client.query("commit");
    return {
      likes,
      likedByUser: true,
      alreadyLiked: !liked,
    };
  } catch (error) {
    await client.query("rollback");
    throw error;
  } finally {
    client.release();
  }
}

export async function unlikePost(postIdValue, userId) {
  const postId = toId(postIdValue);

  if (!postId) {
    throw new HttpError(400, "Invalid article id");
  }

  const client = await connectionPool.connect();

  try {
    await client.query("begin");

    const post = await postRepository.findPostAuthorForUnlike(client, postId);

    if (!post) {
      throw new HttpError(404, "Article not found");
    }

    const unliked = await postRepository.deleteLike(client, postId, userId);

    if (unliked) {
      await postRepository.deleteLikeNotification(
        client,
        post.author_id,
        userId,
        postId,
      );
    }

    const likes = await postRepository.getLikesCount(client, postId);

    await client.query("commit");
    return {
      likes,
      likedByUser: false,
      alreadyUnliked: !unliked,
    };
  } catch (error) {
    await client.query("rollback");
    throw error;
  } finally {
    client.release();
  }
}

export async function addComment(postIdValue, userId, messageValue) {
  const postId = toId(postIdValue);
  const message = String(messageValue ?? "").trim();

  if (!postId) {
    throw new HttpError(400, "Invalid article id");
  }

  if (!message) {
    throw new HttpError(400, "Comment is required");
  }

  if (message.length > 1000) {
    throw new HttpError(400, "Comment must be 1000 characters or fewer");
  }

  const client = await connectionPool.connect();

  try {
    await client.query("begin");

    const post = await postRepository.findPublishedPostForComment(client, postId);

    if (!post) {
      throw new HttpError(404, "Article not found");
    }

    const commentId = await postRepository.insertComment(
      client,
      postId,
      userId,
      message,
    );

    if (post.author_id !== userId) {
      await postRepository.insertCommentNotification(
        client,
        post.author_id,
        userId,
        postId,
        commentId,
      );
    }

    const comment = await postRepository.findCommentById(commentId);

    await client.query("commit");
    return { comment };
  } catch (error) {
    await client.query("rollback");
    throw error;
  } finally {
    client.release();
  }
}
