export function validateCreatePost(req, res, next) {
  const title = cleanString(req.body.title);
  const image = cleanString(req.body.image);
  const description = cleanString(req.body.description);
  const content = cleanString(req.body.content);
  const rawCategoryId = req.body.categoryId ?? req.body.category_id;
  const categoryId =
    typeof rawCategoryId === "number" ? rawCategoryId : Number.NaN;
  const requestedStatus = cleanString(req.body.status).toLowerCase();
  const status = requestedStatus === "published" ? "publish" : requestedStatus;

  if (!title) {
    return res.status(400).json({ message: "Title is required" });
  }

  if (!image) {
    return res.status(400).json({ message: "Image is required" });
  }

  if (!Number.isInteger(categoryId) || categoryId < 1) {
    return res
      .status(400)
      .json({ message: "A valid category is required" });
  }

  if (!description) {
    return res.status(400).json({ message: "Description is required" });
  }

  if (description.length > 120) {
    return res
      .status(400)
      .json({ message: "Description must not exceed 120 characters" });
  }

  if (!content) {
    return res.status(400).json({ message: "Content is required" });
  }

  if (!["draft", "publish"].includes(status)) {
    return res
      .status(400)
      .json({ message: "Status must be draft or published" });
  }

  req.body = {
    title,
    image,
    categoryId,
    description,
    content,
    status,
  };

  return next();
}

function cleanString(value) {
  return typeof value === "string" ? value.trim() : "";
}
