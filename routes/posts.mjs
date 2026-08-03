import { Router } from "express";

import identifyAdmin from "../middlewares/identifyAdmin.mjs";
import { validateCreatePost } from "../middlewares/postValidation.mjs";
import protectAdmin from "../middlewares/protectAdmin.mjs";
import protectUser from "../middlewares/protectUser.mjs";
import connectionPool from "../utils/db.mjs";

const postsRouter = Router();

const postSelect = `
  select
    posts.id,
    posts.title,
    posts.image,
    posts.category_id as "categoryId",
    categories.name as category,
    posts.description,
    posts.content,
    case
      when statuses.status = 'publish' then 'published'
      else statuses.status
    end as status,
    posts.date,
    posts.likes_count as likes
  from posts
  left join categories on posts.category_id = categories.id
  left join statuses on posts.status_id = statuses.id
`;

postsRouter.get("/", identifyAdmin, async (req, res) => {
  const page = toPositiveInteger(req.query.page, 1);
  const limit = Math.min(toPositiveInteger(req.query.limit, 6), 100);
  const offset = (page - 1) * limit;
  const search = String(req.query.search ?? req.query.keyword ?? "").trim();
  const category = String(req.query.category ?? "").trim();
  const categoryId = Number(req.query.categoryId);
  const requestedStatus = String(req.query.status ?? "").trim().toLowerCase();
  const status = requestedStatus === "published" ? "publish" : requestedStatus;
  const includeDrafts = req.user?.role === "admin";
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

  try {
    const countResult = await connectionPool.query(
      `select count(*)::int as total
       from posts
       left join categories on posts.category_id = categories.id
       left join statuses on posts.status_id = statuses.id
       ${whereClause}`,
      values,
    );
    const totalPosts = countResult.rows[0].total;
    const totalPages = Math.ceil(totalPosts / limit);
    const dataValues = [...values, limit, offset];
    const result = await connectionPool.query(
      `${postSelect}
       ${whereClause}
       order by posts.id desc
       limit $${values.length + 1} offset $${values.length + 2}`,
      dataValues,
    );

    return res.status(200).json({
      totalPosts,
      totalPages,
      currentPage: page,
      limit,
      posts: result.rows,
      nextPage: page < totalPages ? page + 1 : null,
      hasMore: page < totalPages,
    });
  } catch {
    return res.status(500).json({ message: "Unable to load articles" });
  }
});

postsRouter.get("/:postId", identifyAdmin, async (req, res) => {
  const postId = toId(req.params.postId);

  if (!postId) {
    return res.status(400).json({ message: "Invalid article id" });
  }

  try {
    const result = await connectionPool.query(
      `${postSelect} where posts.id = $1`,
      [postId],
    );
    const post = result.rows[0];

    if (!post || (post.status === "draft" && req.user?.role !== "admin")) {
      return res.status(404).json({ message: "Article not found" });
    }

    post.likedByUser = false;

    if (req.user) {
      const likedResult = await connectionPool.query(
        `select 1 from post_likes where post_id = $1 and user_id = $2`,
        [postId, req.user.id],
      );
      post.likedByUser = likedResult.rowCount > 0;
    }

    return res.status(200).json({ post });
  } catch {
    return res.status(500).json({ message: "Unable to load the article" });
  }
});

postsRouter.post("/", protectAdmin, validateCreatePost, async (req, res) => {
  const client = await connectionPool.connect();

  try {
    await client.query("begin");
    const { categoryId, status, title, image, description, content } = req.body;
    const categoryResult = await client.query(
      `select id from categories where id = $1`,
      [categoryId],
    );
    const statusResult = await client.query(
      `select id from statuses where lower(status) = $1`,
      [status],
    );

    if (!categoryResult.rowCount) {
      await client.query("rollback");
      return res.status(400).json({ message: "Category does not exist" });
    }

    if (!statusResult.rowCount) {
      await client.query("rollback");
      return res.status(400).json({ message: "Status does not exist" });
    }

    const insertResult = await client.query(
      `insert into posts
        (title, image, category_id, description, content, status_id)
       values ($1, $2, $3, $4, $5, $6)
       returning id`,
      [
        title,
        image,
        categoryId,
        description,
        content,
        statusResult.rows[0].id,
      ],
    );
    const created = await client.query(
      `${postSelect} where posts.id = $1`,
      [insertResult.rows[0].id],
    );

    await client.query("commit");
    return res.status(201).json({ post: created.rows[0] });
  } catch {
    await client.query("rollback");
    return res.status(500).json({ message: "Unable to create the article" });
  } finally {
    client.release();
  }
});

postsRouter.post("/:postId/likes", protectUser, async (req, res) => {
  const postId = toId(req.params.postId);

  if (!postId) {
    return res.status(400).json({ message: "Invalid article id" });
  }

  const client = await connectionPool.connect();

  try {
    await client.query("begin");
    const postResult = await client.query(
      `select likes_count from posts where id = $1 for update`,
      [postId],
    );

    if (!postResult.rowCount) {
      await client.query("rollback");
      return res.status(404).json({ message: "Article not found" });
    }

    const likeResult = await client.query(
      `insert into post_likes (post_id, user_id)
       values ($1, $2)
       on conflict (post_id, user_id) do nothing
       returning post_id`,
      [postId, req.user.id],
    );
    const countResult = await client.query(
      `select likes_count from posts where id = $1`,
      [postId],
    );
    const likes = Number(countResult.rows[0].likes_count ?? 0);

    await client.query("commit");
    return res.status(200).json({
      likes,
      likedByUser: true,
      alreadyLiked: likeResult.rowCount === 0,
    });
  } catch {
    await client.query("rollback");
    return res.status(500).json({ message: "Unable to like the article" });
  } finally {
    client.release();
  }
});

postsRouter.patch(
  "/:postId",
  protectAdmin,
  validateCreatePost,
  async (req, res) => {
    const postId = toId(req.params.postId);

    if (!postId) {
      return res.status(400).json({ message: "Invalid article id" });
    }

    const client = await connectionPool.connect();

    try {
      await client.query("begin");
      const { categoryId, status, title, image, description, content } = req.body;
      const categoryResult = await client.query(
        `select id from categories where id = $1`,
        [categoryId],
      );
      const statusResult = await client.query(
        `select id from statuses where lower(status) = $1`,
        [status],
      );

      if (!categoryResult.rowCount || !statusResult.rowCount) {
        await client.query("rollback");
        return res
          .status(400)
          .json({ message: "Category or status does not exist" });
      }

      const updateResult = await client.query(
        `update posts
         set title = $2,
             image = $3,
             category_id = $4,
             description = $5,
             content = $6,
             status_id = $7
         where id = $1
         returning id`,
        [
          postId,
          title,
          image,
          categoryId,
          description,
          content,
          statusResult.rows[0].id,
        ],
      );

      if (!updateResult.rowCount) {
        await client.query("rollback");
        return res.status(404).json({ message: "Article not found" });
      }

      const updated = await client.query(
        `${postSelect} where posts.id = $1`,
        [postId],
      );

      await client.query("commit");
      return res.status(200).json({ post: updated.rows[0] });
    } catch {
      await client.query("rollback");
      return res.status(500).json({ message: "Unable to update the article" });
    } finally {
      client.release();
    }
  },
);

postsRouter.delete("/:postId", protectAdmin, async (req, res) => {
  const postId = toId(req.params.postId);

  if (!postId) {
    return res.status(400).json({ message: "Invalid article id" });
  }

  try {
    const result = await connectionPool.query(
      `delete from posts where id = $1 returning id`,
      [postId],
    );

    if (!result.rowCount) {
      return res.status(404).json({ message: "Article not found" });
    }

    return res.status(204).send();
  } catch {
    return res.status(500).json({ message: "Unable to delete the article" });
  }
});

function toPositiveInteger(value, fallback) {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}

function toId(value) {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
}

export default postsRouter;
