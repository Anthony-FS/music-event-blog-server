import { describe, expect, test, vi } from "vitest";

import { HttpError, sendControllerError } from "../../utils/httpError.mjs";
import { cleanName, toId, toPositiveInteger } from "../../utils/parseParams.mjs";

describe("toPositiveInteger", () => {
  test.each([
    ["3", 3],
    [7, 7],
    ["0", 9],
    ["-2", 9],
    ["1.5", 9],
    ["abc", 9],
    [undefined, 9],
  ])("%j → %j", (input, expected) => {
    expect(toPositiveInteger(input, 9)).toBe(expected);
  });
});

describe("toId", () => {
  test.each([
    ["12", 12],
    ["0", null],
    ["-1", null],
    ["1.2", null],
    ["x", null],
    [undefined, null],
  ])("%j → %j", (input, expected) => {
    expect(toId(input)).toBe(expected);
  });
});

describe("cleanName", () => {
  test("trims strings and blanks non-strings", () => {
    expect(cleanName("  Jazz ")).toBe("Jazz");
    expect(cleanName(42)).toBe("");
    expect(cleanName(undefined)).toBe("");
  });
});

describe("sendControllerError", () => {
  const makeRes = () => ({ status: vi.fn().mockReturnThis(), json: vi.fn() });

  test("HttpError keeps its status and message", () => {
    const res = makeRes();
    sendControllerError(res, new HttpError(409, "Dup"), "fallback");
    expect(res.status).toHaveBeenCalledWith(409);
    expect(res.json).toHaveBeenCalledWith({ message: "Dup" });
  });

  test("unknown errors become a logged 500 with the fallback message", () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    const res = makeRes();
    sendControllerError(res, new Error("boom"), "fallback");
    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({ message: "fallback" });
    expect(spy).toHaveBeenCalled();
    spy.mockRestore();
  });
});
