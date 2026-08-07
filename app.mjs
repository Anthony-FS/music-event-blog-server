import "dotenv/config";
import express from "express";
import cors from "cors";
import avatarsRouter from "./routes/avatars.mjs";
import categoriesRouter from "./routes/categories.mjs";
import notificationsRouter from "./routes/notifications.mjs";
import postsRouter from "./routes/posts.mjs";

const app = express();
const port = process.env.PORT || 4000;
const allowedOrigins = new Set(
  [
    "http://localhost:5173",
    "http://localhost:3000",
    "https://music-event-blog.vercel.app",
    process.env.FRONTEND_URL,
  ].filter(Boolean),
);

app.use(
  cors({
    origin(origin, callback) {
      if (!origin || allowedOrigins.has(origin)) {
        callback(null, true);
        return;
      }

      callback(new Error("Origin is not allowed by CORS"));
    },
  }),
);

app.use(express.json({ limit: "1mb" }));

app.use("/avatars", avatarsRouter);
app.use("/categories", categoriesRouter);
app.use("/notifications", notificationsRouter);
app.use("/posts", postsRouter);

app.get("/health", (_req, res) => {
  res.status(200).json({ message: "OK" });
});

app.use((_req, res) => {
  res.status(404).json({ message: "Route not found" });
});

app.use((error, _req, res, _next) => {
  if (error.message === "Origin is not allowed by CORS") {
    return res.status(403).json({ message: error.message });
  }

  return res.status(500).json({ message: "Internal server error" });
});

if (!process.env.VERCEL && process.env.NODE_ENV !== "test") {
  app.listen(port, () => {
    console.log(`Server is running at ${port}`);
  });
}

export default app;
