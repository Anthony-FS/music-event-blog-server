import { Router } from "express";

import * as avatarController from "../controllers/avatarController.mjs";
import {
  handleAvatarUploadError,
  uploadAvatar,
} from "../middlewares/uploadAvatar.mjs";
import protectUser from "../middlewares/protectUser.mjs";

const avatarsRouter = Router();

avatarsRouter.post(
  "/",
  protectUser,
  uploadAvatar,
  handleAvatarUploadError,
  avatarController.uploadAvatar,
);

avatarsRouter.delete("/", protectUser, avatarController.deleteAvatar);

export default avatarsRouter;
