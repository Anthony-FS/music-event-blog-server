import { Router } from "express";

import * as authController from "../controllers/authController.mjs";

const authRouter = Router();

authRouter.post("/register", authController.register);
authRouter.post("/login", authController.login);
authRouter.get("/get-user", authController.getUser);
authRouter.put("/reset-password", authController.resetPassword);

export default authRouter;
