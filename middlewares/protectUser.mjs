import supabase from "../utils/supabase.mjs";

const protectUser = async (req, res, next) => {
  const [scheme, token] = req.headers.authorization?.split(" ") ?? [];

  if (scheme !== "Bearer" || !token) {
    return res.status(401).json({ message: "Authentication is required" });
  }

  try {
    const { data, error } = await supabase.auth.getUser(token);
    if (error || !data.user) {
      return res.status(401).json({ message: "Invalid or expired token" });
    }
    req.user = { ...data.user };
    return next();
  } catch {
    return res.status(500).json({ message: "Unable to verify authentication" });
  }
};

export default protectUser;