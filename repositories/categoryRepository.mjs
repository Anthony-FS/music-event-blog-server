import connectionPool from "../utils/db.mjs";

export async function findAllCategories() {
  const result = await connectionPool.query(
    `select id, name from categories order by lower(name)`,
  );
  return result.rows;
}

export async function findDuplicateCategory(name, excludeId = null) {
  const query = excludeId
    ? `select id from categories where lower(name) = lower($1) and id <> $2`
    : `select id from categories where lower(name) = lower($1)`;
  const values = excludeId ? [name, excludeId] : [name];
  const result = await connectionPool.query(query, values);
  return result.rowCount > 0;
}

export async function createCategory(name) {
  const result = await connectionPool.query(
    `insert into categories (name) values ($1) returning id, name`,
    [name],
  );
  return result.rows[0];
}

export async function updateCategory(categoryId, name) {
  const result = await connectionPool.query(
    `update categories set name = $2 where id = $1 returning id, name`,
    [categoryId, name],
  );
  return result.rows[0] ?? null;
}

export async function countPostsUsingCategory(categoryId) {
  const result = await connectionPool.query(
    `select count(*)::int as count from posts where category_id = $1`,
    [categoryId],
  );
  return result.rows[0].count;
}

export async function deleteCategory(categoryId) {
  const result = await connectionPool.query(
    `delete from categories where id = $1 returning id`,
    [categoryId],
  );
  return result.rowCount > 0;
}
