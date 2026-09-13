import { beforeEach, describe, expect, test, vi } from "vitest";

const getUserMock = vi.hoisted(() => vi.fn());

vi.mock("../utils/supabase.mjs", () => ({
  default: {
    auth: {
      getUser: getUserMock,
    },
  },
}));

import protectUser from "../middlewares/protectUser.mjs";

const makeRes = () => ({
  status: vi.fn().mockReturnThis(),
  json: vi.fn(),
});

describe("protectUser", () => {
  beforeEach(() => {
    getUserMock.mockReset();
  });

  test("invalid token → 401 Invalid or expired token", async () => {
    getUserMock.mockResolvedValue({
      data: { user: null },
      error: { message: "Invalid JWT" },
    });

    const req = { headers: { authorization: "Bearer bad-token" } };
    const res = makeRes();
    const next = vi.fn();

    await protectUser(req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({
      message: "Invalid or expired token",
    });
    expect(next).not.toHaveBeenCalled();
  });

  test("valid token → next() with req.user", async () => {
    getUserMock.mockResolvedValue({
      data: { user: { id: "user-123", email: "member@test.com" } },
      error: null,
    });

    const req = { headers: { authorization: "Bearer valid-token" } };
    const res = makeRes();
    const next = vi.fn();

    await protectUser(req, res, next);

    expect(next).toHaveBeenCalledOnce();
    expect(req.user).toEqual({ id: "user-123", email: "member@test.com" });
    expect(res.status).not.toHaveBeenCalled();
  });
});
