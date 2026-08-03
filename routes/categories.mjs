import { Router } from "express";

import protectAdmin from "../middlewares/protectAdmin.mjs";
import connectionPool from "../utils/db.mjs";

const categoriesRouter = Router();

categoriesRouter.get("/", async (_req, res) => {
  try {
    const result = await connectionPool.query(
      `select id, name from categories order by lower(name)`,
    );
    return res.status(200).json({ categories: result.rows });
  } catch {
    return res.status(500).json({ message: "Unable to load categories" });
  }
});

categoriesRouter.post("/", protectAdmin, async (req, res) => {
  const name = cleanName(req.body.name);

  if (!name) {
    return res.status(400).json({ message: "Category name is required" });
  }

  try {
    const duplicate = await connectionPool.query(
      `select id from categories where lower(name) = lower($1)`,
      [name],
    );

    if (duplicate.rowCount) {
      return res.status(409).json({ message: "Category already exists" });
    }

    const result = await connectionPool.query(
      `insert into categories (name) values ($1) returning id, name`,
      [name],
    );
    return res.status(201).json({ category: result.rows[0] });
  } catch {
    return res.status(500).json({ message: "Unable to create the category" });
  }
});

categoriesRouter.patch("/:categoryId", protectAdmin, async (req, res) => {
  const categoryId = toId(req.params.categoryId);
  const name = cleanName(req.body.name);

  if (!categoryId) {
    return res.status(400).json({ message: "Invalid category id" });
  }

  if (!name) {
    return res.status(400).json({ message: "Category name is required" });
  }

  try {
    const duplicate = await connectionPool.query(
      `select id
       from categories
       where lower(name) = lower($1) and id <> $2`,
      [name, categoryId],
    );

    if (duplicate.rowCount) {
      return res.status(409).json({ message: "Category already exists" });
    }

    const result = await connectionPool.query(
      `update categories set name = $2 where id = $1 returning id, name`,
      [categoryId, name],
    );

    if (!result.rowCount) {
      return res.status(404).json({ message: "Category not found" });
    }

    return res.status(200).json({ category: result.rows[0] });
  } catch {
    return res.status(500).json({ message: "Unable to update the category" });
  }
});

categoriesRouter.delete("/:categoryId", protectAdmin, async (req, res) => {
  const categoryId = toId(req.params.categoryId);

  if (!categoryId) {
    return res.status(400).json({ message: "Invalid category id" });
  }

  try {
    const usage = await connectionPool.query(
      `select count(*)::int as count from posts where category_id = $1`,
      [categoryId],
    );

    if (usage.rows[0].count > 0) {
      return res.status(409).json({
        message: "This category is still used by one or more articles",
      });
    }

    const result = await connectionPool.query(
      `delete from categories where id = $1 returning id`,
      [categoryId],
    );

    if (!result.rowCount) {
      return res.status(404).json({ message: "Category not found" });
    }

    return res.status(204).send();
  } catch {
    return res.status(500).json({ message: "Unable to delete the category" });
  }
});

function cleanName(value) {
  return typeof value === "string" ? value.trim() : "";
}

function toId(value) {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
}

export default categoriesRouter;
