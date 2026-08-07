import { HttpError } from "../utils/httpError.mjs";
import { cleanName, toId } from "../utils/parseParams.mjs";
import * as categoryRepository from "../repositories/categoryRepository.mjs";

export async function listCategories() {
  const categories = await categoryRepository.findAllCategories();
  return { categories };
}

export async function createCategory(nameValue) {
  const name = cleanName(nameValue);

  if (!name) {
    throw new HttpError(400, "Category name is required");
  }

  const duplicate = await categoryRepository.findDuplicateCategory(name);

  if (duplicate) {
    throw new HttpError(409, "Category already exists");
  }

  const category = await categoryRepository.createCategory(name);
  return { category };
}

export async function updateCategory(categoryIdValue, nameValue) {
  const categoryId = toId(categoryIdValue);
  const name = cleanName(nameValue);

  if (!categoryId) {
    throw new HttpError(400, "Invalid category id");
  }

  if (!name) {
    throw new HttpError(400, "Category name is required");
  }

  const duplicate = await categoryRepository.findDuplicateCategory(
    name,
    categoryId,
  );

  if (duplicate) {
    throw new HttpError(409, "Category already exists");
  }

  const category = await categoryRepository.updateCategory(categoryId, name);

  if (!category) {
    throw new HttpError(404, "Category not found");
  }

  return { category };
}

export async function removeCategory(categoryIdValue) {
  const categoryId = toId(categoryIdValue);

  if (!categoryId) {
    throw new HttpError(400, "Invalid category id");
  }

  const usageCount = await categoryRepository.countPostsUsingCategory(categoryId);

  if (usageCount > 0) {
    throw new HttpError(
      409,
      "This category is still used by one or more articles",
    );
  }

  const deleted = await categoryRepository.deleteCategory(categoryId);

  if (!deleted) {
    throw new HttpError(404, "Category not found");
  }
}
