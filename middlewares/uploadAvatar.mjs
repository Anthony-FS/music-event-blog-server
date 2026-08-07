import multer from "multer";

const MAX_AVATAR_SIZE = 2 * 1024 * 1024;
const ALLOWED_AVATAR_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
]);

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: MAX_AVATAR_SIZE,
    files: 1,
  },
  fileFilter(_req, file, callback) {
    if (!ALLOWED_AVATAR_TYPES.has(file.mimetype)) {
      callback(new Error("Use a JPG, PNG, WebP, or GIF image."));
      return;
    }

    callback(null, true);
  },
});

export const uploadAvatar = upload.single("avatar");

export function handleAvatarUploadError(error, _req, res, next) {
  if (!error) {
    return next();
  }

  if (error instanceof multer.MulterError) {
    if (error.code === "LIMIT_FILE_SIZE") {
      return res
        .status(400)
        .json({ message: "The avatar must be 2 MB or smaller." });
    }

    return res.status(400).json({ message: error.message });
  }

  if (error.message === "Use a JPG, PNG, WebP, or GIF image.") {
    return res.status(400).json({ message: error.message });
  }

  return next(error);
}
