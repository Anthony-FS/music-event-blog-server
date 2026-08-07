import { Router } from "express";

import * as categoryController from "../controllers/categoryController.mjs";
import protectAdmin from "../middlewares/protectAdmin.mjs";

const categoriesRouter = Router();

categoriesRouter.get("/", categoryController.listCategories);
categoriesRouter.post("/", protectAdmin, categoryController.createCategory);
categoriesRouter.patch("/:categoryId", protectAdmin, categoryController.updateCategory);
categoriesRouter.delete("/:categoryId", protectAdmin, categoryController.deleteCategory);

export default categoriesRouter;
