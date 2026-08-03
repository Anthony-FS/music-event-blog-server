import "dotenv/config";
import express from "express";
import cors from "cors";
import postsRouter from "./routes/posts.mjs";
import protectUser from "./middlewares/protectUser.mjs";
import protectAdmin from "./middlewares/protectAdmin.mjs";

const app = express();
const port = process.env.PORT || 4000;

app.use(cors(
  {
  origin: [
    "http://localhost:5173", // Frontend local (Vite)
    "http://localhost:3000", // Frontend local (React แบบอื่น)
    "https://music-event-blog.vercel.app", // Frontend ที่ Deploy แล้ว
  ],
  }
));

app.use(express.json());

app.use("/posts", postsRouter);

app.get("/test", (req, res) => {
  res.send("Hello TechUp!");
});

app.get("/health", (req, res) => {
  res.status(200).json({ message: "OK" });
});

app.get("/protected-route", protectUser, (req, res) => {
  res.json({ message: "This is protected content", user: req.user });
});

app.get("/admin-only", protectAdmin, (req, res) => {
  res.json({ message: "This is admin-only content", admin: req.user });
});

app.listen(port, () => {
  console.log(`Server is running at ${port}`);
});
