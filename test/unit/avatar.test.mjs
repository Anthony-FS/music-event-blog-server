import { beforeEach, describe, expect, test, vi } from "vitest";
import multer from "multer";

const storage = vi.hoisted(() => {
  const bucket = {
    upload: vi.fn(),
    getPublicUrl: vi.fn(),
    remove: vi.fn(),
  };
  return { bucket, from: vi.fn(() => bucket) };
});

vi.mock("../../utils/supabaseAdmin.mjs", () => ({
  default: () => ({ storage: { from: storage.from } }),
}));

import { handleAvatarUploadError } from "../../middlewares/uploadAvatar.mjs";
import * as avatarService from "../../services/avatarService.mjs";

const rejectsWith = (promise, status, message) =>
  expect(promise).rejects.toMatchObject({ status, message });

beforeEach(() => {
  vi.clearAllMocks();
  process.env.SUPABASE_SERVICE_ROLE_KEY = "service-key";
  process.env.SUPABASE_URL = "https://example.supabase.co";
  process.env.SUPABASE_ANON_KEY = "anon";
});

describe("avatarService.uploadAvatar", () => {
  const file = { originalname: "me.PNG", mimetype: "image/png", buffer: Buffer.from("x") };

  test("no file → 400", async () => {
    await rejectsWith(avatarService.uploadAvatar("u1", undefined, "t"), 400, "Please select an image.");
  });

  test("uploads under the user's folder and returns the public url", async () => {
    storage.bucket.upload.mockResolvedValue({ error: null });
    storage.bucket.getPublicUrl.mockReturnValue({ data: { publicUrl: "https://cdn/x.png" } });

    const result = await avatarService.uploadAvatar("u1", file, "t");

    expect(storage.from).toHaveBeenCalledWith("avatar-images");
    expect(result.avatarUrl).toBe("https://cdn/x.png");
    expect(result.path).toMatch(/^u1\/\d+-[0-9a-f-]{36}\.png$/);
    expect(storage.bucket.upload).toHaveBeenCalledWith(result.path, file.buffer, {
      contentType: "image/png",
      upsert: false,
    });
  });

  test("extension falls back to the mime type, then jpg", async () => {
    storage.bucket.upload.mockResolvedValue({ error: null });
    storage.bucket.getPublicUrl.mockReturnValue({ data: { publicUrl: "u" } });

    const webp = await avatarService.uploadAvatar(
      "u1",
      { originalname: "noext", mimetype: "image/webp", buffer: Buffer.from("x") },
      "t",
    );
    expect(webp.path).toMatch(/\.webp$/);

    const unknown = await avatarService.uploadAvatar(
      "u1",
      { originalname: "noext", mimetype: "application/x", buffer: Buffer.from("x") },
      "t",
    );
    expect(unknown.path).toMatch(/\.jpg$/);
  });

  test("storage error → 500 with its message", async () => {
    storage.bucket.upload.mockResolvedValue({ error: { message: "quota" } });
    await rejectsWith(avatarService.uploadAvatar("u1", file, "t"), 500, "quota");
  });
});

describe("avatarService.deleteAvatar", () => {
  const managed = "https://x.supabase.co/storage/v1/object/public/avatar-images/u1/a%20b.png";

  test("ignores empty, foreign and malformed urls", async () => {
    for (const url of [undefined, "", "https://elsewhere.com/a.png", "not a url"]) {
      await avatarService.deleteAvatar(url, "t");
    }
    expect(storage.bucket.remove).not.toHaveBeenCalled();
  });

  test("removes the decoded object path for managed urls", async () => {
    storage.bucket.remove.mockResolvedValue({ error: null });
    await avatarService.deleteAvatar(managed, "t");
    expect(storage.bucket.remove).toHaveBeenCalledWith(["u1/a b.png"]);
  });

  test("storage error → 500", async () => {
    storage.bucket.remove.mockResolvedValue({ error: { message: "nope" } });
    await rejectsWith(avatarService.deleteAvatar(managed, "t"), 500, "nope");
  });
});

describe("handleAvatarUploadError", () => {
  const makeRes = () => ({ status: vi.fn().mockReturnThis(), json: vi.fn() });

  test("no error → next()", () => {
    const next = vi.fn();
    handleAvatarUploadError(undefined, {}, makeRes(), next);
    expect(next).toHaveBeenCalledWith();
  });

  test("oversized file → 400 with a friendly message", () => {
    const res = makeRes();
    handleAvatarUploadError(new multer.MulterError("LIMIT_FILE_SIZE"), {}, res, vi.fn());
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ message: "The avatar must be 2 MB or smaller." });
  });

  test("other multer errors → 400 with multer's message", () => {
    const res = makeRes();
    handleAvatarUploadError(new multer.MulterError("LIMIT_UNEXPECTED_FILE"), {}, res, vi.fn());
    expect(res.status).toHaveBeenCalledWith(400);
  });

  test("rejected mime type → 400", () => {
    const res = makeRes();
    handleAvatarUploadError(new Error("Use a JPG, PNG, WebP, or GIF image."), {}, res, vi.fn());
    expect(res.status).toHaveBeenCalledWith(400);
  });

  test("unknown errors fall through to the app error handler", () => {
    const next = vi.fn();
    const error = new Error("boom");
    handleAvatarUploadError(error, {}, makeRes(), next);
    expect(next).toHaveBeenCalledWith(error);
  });
});
