import connectionPool from "../utils/db.mjs";

export async function findProfileRole(userId) {
  const result = await connectionPool.query(
    `select role from profiles where id = $1`,
    [userId],
  );
  return result.rows[0] ?? null;
}

export async function findUserByUsername(username) {
  const result = await connectionPool.query(
    `select * from users where username = $1`,
    [username],
  );
  return result.rows[0] ?? null;
}

export async function createUser(user) {
  const result = await connectionPool.query(
    `insert into users (id, username, name, role)
     values ($1, $2, $3, $4)
     returning *`,
    [user.id, user.username, user.name, user.role],
  );
  return result.rows[0];
}

export async function findUserById(userId) {
  const result = await connectionPool.query(
    `select * from users where id = $1`,
    [userId],
  );
  return result.rows[0] ?? null;
}
