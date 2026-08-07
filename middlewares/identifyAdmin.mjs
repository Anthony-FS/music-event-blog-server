import * as userRepository from "../repositories/userRepository.mjs";
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

    const profile = await userRepository.findProfileRole(data.user.id);

    req.user = {
      ...data.user,
      role: profile?.role ?? "member",
    };
  } catch {
    // Public reads remain available if optional identity lookup fails.
  }

  return next();
}
