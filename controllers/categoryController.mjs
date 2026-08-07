import { sendControllerError } from "../utils/httpError.mjs";
import * as categoryService from "../services/categoryService.mjs";

export async function listCategories(_req, res) {
  try {
    const result = await categoryService.listCategories();
    return res.status(200).json(result);
  } catch (error) {
    return sendControllerError(res, error, "Unable to load categories");
  }
}

export async function createCategory(req, res) {
  try {
    const result = await categoryService.createCategory(req.body.name);
    return res.status(201).json(result);
  } catch (error) {
    return sendControllerError(res, error, "Unable to create the category");
  }
}

export async function updateCategory(req, res) {
  try {
    const result = await categoryService.updateCategory(
      req.params.categoryId,
      req.body.name,
    );
    return res.status(200).json(result);
  } catch (error) {
    return sendControllerError(res, error, "Unable to update the category");
  }
}

export async function deleteCategory(req, res) {
  try {
    await categoryService.removeCategory(req.params.categoryId);
    return res.status(204).send();
  } catch (error) {
    return sendControllerError(res, error, "Unable to delete the category");
  }
}
