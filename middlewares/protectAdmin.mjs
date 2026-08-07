import * as userRepository from "../repositories/userRepository.mjs";
import supabase from "../utils/supabase.mjs";

const protectAdmin = async (req, res, next) => {
  const [scheme, token] = req.headers.authorization?.split(" ") ?? [];

  if (scheme !== "Bearer" || !token) {
    return res.status(401).json({ message: "Authentication is required" });
  }

  try {
    const { data, error } = await supabase.auth.getUser(token);

    if (error || !data.user) {
      return res.status(401).json({ message: "Invalid or expired token" });
    }

    const profile = await userRepository.findProfileRole(data.user.id);

    if (!profile) {
      return res.status(403).json({ message: "Admin access is required" });
    }

    req.user = { ...data.user, role: profile.role };

    if (req.user.role !== "admin") {
      return res.status(403).json({ message: "Admin access is required" });
    }

    return next();
  } catch {
    return res.status(500).json({ message: "Unable to verify admin access" });
  }
};

export default protectAdmin;
