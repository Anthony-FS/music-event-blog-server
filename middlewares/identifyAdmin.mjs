import connectionPool from "../utils/db.mjs";
import supabase from "../utils/supabase.mjs";

export default async function identifyAdmin(req, _res, next) {
  const [scheme, token] = req.headers.authorization?.split(" ") ?? [];

  if (scheme !== "Bearer" || !token) {
    return next();
  }

  try {
    const { data, error } = await supabase.auth.getUser(token);

    if (error || !data.user) {
      return next();
    }

    const { rows } = await connectionPool.query(
      `select role from profiles where id = $1`,
      [data.user.id],
    );

    req.user = {
      ...data.user,
      role: rows[0]?.role ?? "member",
    };
  } catch {
    // Public reads remain available if optional identity lookup fails.
  }

  return next();
}
