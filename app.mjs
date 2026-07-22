import express from "express";
import cors from "cors";
import connectionPool from "./utils/db.mjs";


const app = express();
const port = process.env.PORT || 4000;

app.use(cors(
  {
  origin: [
    "http://localhost:5173", // Frontend local (Vite)
    "http://localhost:3000", // Frontend local (React แบบอื่น)
    "https://music-event-blog.vercel.app/", // Frontend ที่ Deploy แล้ว
  ],
  }
));

app.use(express.json());

app.get("/test", (req, res) => {
  res.send("Hello TechUp!");
});

app.get("/health", (req, res) => {
  res.status(200).json({ message: "OK" });
});

app.post("/posts", async (req, res) => {

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

app.listen(port, () => {
  console.log(`Server is running at ${port}`);
});