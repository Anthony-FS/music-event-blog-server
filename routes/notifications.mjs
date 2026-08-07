import { Router } from "express";

import * as notificationController from "../controllers/notificationController.mjs";
import protectUser from "../middlewares/protectUser.mjs";

const notificationsRouter = Router();

notificationsRouter.use(protectUser);
notificationsRouter.get("/", notificationController.listNotifications);
notificationsRouter.patch("/read", notificationController.markNotificationsRead);

export default notificationsRouter;
