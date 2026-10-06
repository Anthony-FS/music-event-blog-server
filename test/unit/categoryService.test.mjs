import { beforeEach, describe, expect, test, vi } from "vitest";

vi.mock("../../repositories/categoryRepository.mjs", () => ({
  findAllCategories: vi.fn(),
  findDuplicateCategory: vi.fn(),
  createCategory: vi.fn(),
  updateCategory: vi.fn(),
  countPostsUsingCategory: vi.fn(),
  deleteCategory: vi.fn(),
}));

import * as repo from "../../repositories/categoryRepository.mjs";
import * as service from "../../services/categoryService.mjs";

const rejectsWith = (promise, status, message) =>
  expect(promise).rejects.toMatchObject({ status, message });

beforeEach(() => vi.resetAllMocks());

describe("createCategory", () => {
  test("trims the name and returns the created category", async () => {
    repo.findDuplicateCategory.mockResolvedValue(false);
    repo.createCategory.mockResolvedValue({ id: 1, name: "Jazz" });

    await expect(service.createCategory("  Jazz ")).resolves.toEqual({
      category: { id: 1, name: "Jazz" },
    });
    expect(repo.createCategory).toHaveBeenCalledWith("Jazz");
  });

  test("blank name → 400", async () => {
    await rejectsWith(service.createCategory("   "), 400, "Category name is required");
    expect(repo.createCategory).not.toHaveBeenCalled();
  });

  test("duplicate → 409", async () => {
    repo.findDuplicateCategory.mockResolvedValue(true);
    await rejectsWith(service.createCategory("Jazz"), 409, "Category already exists");
  });
});

describe("updateCategory", () => {
  test("invalid id → 400", async () => {
    await rejectsWith(service.updateCategory("abc", "Jazz"), 400, "Invalid category id");
  });

  test("blank name → 400", async () => {
    await rejectsWith(service.updateCategory("1", " "), 400, "Category name is required");
  });

  test("duplicate check excludes itself → 409", async () => {
    repo.findDuplicateCategory.mockResolvedValue(true);
    await rejectsWith(service.updateCategory("2", "Jazz"), 409, "Category already exists");
    expect(repo.findDuplicateCategory).toHaveBeenCalledWith("Jazz", 2);
  });

  test("missing row → 404", async () => {
    repo.findDuplicateCategory.mockResolvedValue(false);
    repo.updateCategory.mockResolvedValue(null);
    await rejectsWith(service.updateCategory("2", "Jazz"), 404, "Category not found");
  });

  test("success returns the category", async () => {
    repo.findDuplicateCategory.mockResolvedValue(false);
    repo.updateCategory.mockResolvedValue({ id: 2, name: "Jazz" });
    await expect(service.updateCategory("2", "Jazz")).resolves.toEqual({
      category: { id: 2, name: "Jazz" },
    });
  });
});

describe("removeCategory", () => {
  test("invalid id → 400", async () => {
    await rejectsWith(service.removeCategory("0"), 400, "Invalid category id");
  });

  test("category still in use → 409 and nothing deleted", async () => {
    repo.countPostsUsingCategory.mockResolvedValue(2);
    await rejectsWith(
      service.removeCategory("1"),
      409,
      "This category is still used by one or more articles",
    );
    expect(repo.deleteCategory).not.toHaveBeenCalled();
  });

  test("missing row → 404", async () => {
    repo.countPostsUsingCategory.mockResolvedValue(0);
    repo.deleteCategory.mockResolvedValue(false);
    await rejectsWith(service.removeCategory("1"), 404, "Category not found");
  });

  test("unused category is deleted", async () => {
    repo.countPostsUsingCategory.mockResolvedValue(0);
    repo.deleteCategory.mockResolvedValue(true);
    await expect(service.removeCategory("1")).resolves.toBeUndefined();
  });
});

test("listCategories wraps the rows", async () => {
  repo.findAllCategories.mockResolvedValue([{ id: 1, name: "Jazz" }]);
  await expect(service.listCategories()).resolves.toEqual({
    categories: [{ id: 1, name: "Jazz" }],
  });
});
