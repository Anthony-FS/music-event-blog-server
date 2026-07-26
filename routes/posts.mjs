import { Router } from "express";
import connectionPool from "../utils/db.mjs";
import { validateCreatePost } from "../middlewares/postValidation.mjs";

const postsRouter = Router();

postsRouter.get("/test", (req, res) => {
  return res.status(200).json({ message: "Posts router is working" });
});

postsRouter.get("/", async (req, res) => {
  try {
    const page = Math.max(1, Number(req.query.page) || 1);
    const limit = Math.max(1, Number(req.query.limit) || 6);
    const offset = (page - 1) * limit;
    const category = req.query.category;
    const keyword = req.query.keyword;

    const conditions = [];
    const values = [];

    if (category) {
      values.push(category);
      conditions.push(`categories.name ilike $${values.length}`);
    }

    if (keyword) {
      values.push(`%${keyword}%`);
      conditions.push(
        `(posts.title ilike $${values.length} or posts.description ilike $${values.length} or posts.content ilike $${values.length})`,
      );
    }

    const whereClause =
      conditions.length > 0 ? `where ${conditions.join(" and ")}` : "";

    const fromClause = `
      from posts
      left join categories on posts.category_id = categories.id
      ${whereClause}
    `;

    const countResult = await connectionPool.query(
      `select count(*)::int as total ${fromClause}`,
      values,
    );
    const totalPosts = countResult.rows[0].total;
    const totalPages = Math.ceil(totalPosts / limit) || 0;

    const dataValues = [...values, limit, offset];
    const result = await connectionPool.query(
      `select posts.*, categories.name as category
       ${fromClause}
       order by posts.id desc
       limit $${values.length + 1} offset $${values.length + 2}`,
      dataValues,
    );

    const nextPage = page < totalPages ? page + 1 : null;

    return res.status(200).json({
      totalPosts,
      totalPages,
      currentPage: page,
      limit,
      posts: result.rows,
      nextPage,
    });
  } catch {
    return res.status(500).json({
      message: `Server could not get posts because database connection`,
    });
  }
});

postsRouter.post("/", validateCreatePost, async (req, res) => {
  const newPost = req.body;

  try {
    const query = `insert into posts (title, image, category_id, description, content, status_id)
    values ($1, $2, $3, $4, $5, $6)`;

    const values = [
      newPost.title,
      newPost.image,
      newPost.category_id,
      newPost.description,
      newPost.content,
      newPost.status_id,
    ];

    await connectionPool.query(query, values);
  } catch {
    return res.status(500).json({
      message: `Server could not create post because database connection`,
    });
  }

  return res.status(201).json({ message: "Created post successfully" });
});

postsRouter.get("/:postId", async (req, res) => {
  try {
    const postId = req.params.postId;
    const query = `select * from posts where id = $1`;
    const values = [postId];
    const result = await connectionPool.query(query, values);

    if (result.rows.length === 0) {
      return res.status(404).json({
        message: `Server could not find the requested post`,
      });
    }

    return res.status(200).json(result.rows[0]);
  } catch {
    return res.status(500).json({
      message: `Server could not get post because database connection`,
    });
  }
});

postsRouter.put("/:postId", validateCreatePost, async (req, res) => {
  const postId = req.params.postId;
  const updatedPost = req.body;

  try {
    const query = `update posts
      set title = $2,
          image = $3,
          category_id = $4,
          description = $5,
          content = $6,
          status_id = $7
      where id = $1`;

    const values = [
      postId,
      updatedPost.title,
      updatedPost.image,
      updatedPost.category_id,
      updatedPost.description,
      updatedPost.content,
      updatedPost.status_id,
    ];

    const result = await connectionPool.query(query, values);

    if (result.rowCount === 0) {
      return res.status(404).json({
        message: `Server could not find the requested post to update`,
      });
    }
  } catch {
    return res.status(500).json({
      message: `Server could not update the requested post because database connection`,
    });
  }

  return res.status(200).json({ message: "Updated post successfully" });
});

postsRouter.delete("/:postId", async (req, res) => {
  const postId = req.params.postId;

  try {
    const result = await connectionPool.query(
      `delete from posts where id = $1`,
      [postId],
    );

    if (result.rowCount === 0) {
      return res.status(404).json({
        message: `Server could not find the requested post to delete`,
      });
    }
  } catch {
    return res.status(500).json({
      message: `Server could not delete post because database connection`,
    });
  }

  return res.status(200).json({ message: "Deleted post successfully" });
});

export default postsRouter;
