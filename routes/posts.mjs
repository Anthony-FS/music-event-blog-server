import { Router } from "express";

import * as postController from "../controllers/postController.mjs";
import identifyAdmin from "../middlewares/identifyAdmin.mjs";
import { validateCreatePost } from "../middlewares/postValidation.mjs";
import protectAdmin from "../middlewares/protectAdmin.mjs";
import protectUser from "../middlewares/protectUser.mjs";

const postsRouter = Router();

postsRouter.get("/", identifyAdmin, postController.listPosts);
postsRouter.get("/:postId/comments", identifyAdmin, postController.getPostComments);
postsRouter.get("/:postId", identifyAdmin, postController.getPost);
postsRouter.post("/", protectAdmin, validateCreatePost, postController.createPost);
postsRouter.post("/:postId/likes", protectUser, postController.likePost);
postsRouter.post("/:postId/comments", protectUser, postController.addComment);
postsRouter.delete("/:postId/likes", protectUser, postController.unlikePost);
postsRouter.patch(
  "/:postId",
  protectAdmin,
  validateCreatePost,
  postController.updatePost,
);
postsRouter.delete("/:postId", protectAdmin, postController.deletePost);

export default postsRouter;
