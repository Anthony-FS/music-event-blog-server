/**
 * Test Case List — validateCreatePost middleware
 *
 * เคสบังคับ (จากห้อง) — จะเขียนเป็น test ในช่วง Unit:
 * - Happy: validBody → next()
 * - Error: ไม่ส่ง title → 400
 * - Error: title "" → 400
 * - Error: category_id "1" → 400
 * - Error: title "   " → 400
 * - Error: status_id 99 → 400 (middleware ใช้ status — ทดสอบด้วย status ที่ไม่ถูกต้อง)
 *
 * เคสที่ออกแบบเอง (อย่างน้อย 2 เคส);
 * reject/error อย่างน้อย 1 ห้ามซ้ำหมวดกับ 6 บังคับ:
 * - Input: ไม่ส่ง image | Expected: 400 "Image is required" | เหตุผล: ทดสอบ required field อื่นที่ไม่ใช่ title/category/status
 * - Input: description 121 ตัวอักษร | Expected: 400 "Description must not exceed 120 characters" | เหตุผล: ทดสอบ max length ไม่ใช่ required/type/whitespace
 */

import { describe, expect, test, vi } from "vitest";
import { validateCreatePost } from "../middlewares/postValidation.mjs";

const makeRes = () => ({
  status: vi.fn().mockReturnThis(),
  json: vi.fn(),
});

const validBody = {
  title: "My Article",
  image: "https://example.com/image.jpg",
  category_id: 1,
  description: "A short description",
  content: "Full article content",
  status: "published",
};

describe("validateCreatePost", () => {
  test("Happy Path: validBody → next()", () => {
    const req = { body: { ...validBody } };
    const res = makeRes();
    const next = vi.fn();

    validateCreatePost(req, res, next);

    expect(next).toHaveBeenCalledOnce();
    expect(res.status).not.toHaveBeenCalled();
    expect(req.body).toEqual({
      title: "My Article",
      image: "https://example.com/image.jpg",
      categoryId: 1,
      description: "A short description",
      content: "Full article content",
      status: "publish",
    });
  });

  test('Error: ไม่ส่ง title → 400', () => {
    const { title: _title, ...bodyWithoutTitle } = validBody;
    const req = { body: bodyWithoutTitle };
    const res = makeRes();
    const next = vi.fn();

    validateCreatePost(req, res, next);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ message: "Title is required" });
    expect(next).not.toHaveBeenCalled();
  });

  test('Error: title "" → 400', () => {
    const req = { body: { ...validBody, title: "" } };
    const res = makeRes();
    const next = vi.fn();

    validateCreatePost(req, res, next);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ message: "Title is required" });
    expect(next).not.toHaveBeenCalled();
  });

  test('Error: category_id "1" → 400', () => {
    const req = { body: { ...validBody, category_id: "1" } };
    const res = makeRes();
    const next = vi.fn();

    validateCreatePost(req, res, next);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({
      message: "A valid category is required",
    });
    expect(next).not.toHaveBeenCalled();
  });

  test('Error: title "   " → 400', () => {
    const req = { body: { ...validBody, title: "   " } };
    const res = makeRes();
    const next = vi.fn();

    validateCreatePost(req, res, next);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ message: "Title is required" });
    expect(next).not.toHaveBeenCalled();
  });

  test("Error: status ไม่ถูกต้อง → 400 (เทียบเท่า status_id 99)", () => {
    const req = { body: { ...validBody, status: "archived" } };
    const res = makeRes();
    const next = vi.fn();

    validateCreatePost(req, res, next);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({
      message: "Status must be draft or published",
    });
    expect(next).not.toHaveBeenCalled();
  });

  test('Custom: ไม่ส่ง image → 400 "Image is required"', () => {
    const { image: _image, ...bodyWithoutImage } = validBody;
    const req = { body: bodyWithoutImage };
    const res = makeRes();
    const next = vi.fn();

    validateCreatePost(req, res, next);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ message: "Image is required" });
    expect(next).not.toHaveBeenCalled();
  });

  test("Custom: description 121 ตัวอักษร → 400 max length", () => {
    const req = {
      body: { ...validBody, description: "a".repeat(121) },
    };
    const res = makeRes();
    const next = vi.fn();

    validateCreatePost(req, res, next);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({
      message: "Description must not exceed 120 characters",
    });
    expect(next).not.toHaveBeenCalled();
  });
});
