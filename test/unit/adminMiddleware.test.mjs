import { beforeEach, describe, expect, test, vi } from "vitest";

const getUserMock = vi.hoisted(() => vi.fn());
const findProfileRoleMock = vi.hoisted(() => vi.fn());

vi.mock("../../utils/supabase.mjs", () => ({
  default: { auth: { getUser: getUserMock } },
}));
vi.mock("../../repositories/userRepository.mjs", () => ({
  findProfileRole: findProfileRoleMock,
}));

import identifyAdmin from "../../middlewares/identifyAdmin.mjs";
import protectAdmin from "../../middlewares/protectAdmin.mjs";

const makeRes = () => ({ status: vi.fn().mockReturnThis(), json: vi.fn() });
const bearer = (token) => ({ headers: { authorization: `Bearer ${token}` } });
const signedIn = () =>
  getUserMock.mockResolvedValue({ data: { user: { id: "u1" } }, error: null });

beforeEach(() => vi.resetAllMocks());

describe("protectAdmin", () => {
  test.each([
    ["no header", { headers: {} }],
    ["wrong scheme", { headers: { authorization: "Basic abc" } }],
    ["no token", { headers: { authorization: "Bearer" } }],
  ])("%s → 401 Authentication is required", async (_name, req) => {
    const res = makeRes();
    const next = vi.fn();

    await protectAdmin(req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({ message: "Authentication is required" });
    expect(next).not.toHaveBeenCalled();
    expect(getUserMock).not.toHaveBeenCalled();
  });

  test("rejected token → 401 Invalid or expired token", async () => {
    getUserMock.mockResolvedValue({ data: { user: null }, error: { message: "bad" } });
    const res = makeRes();

    await protectAdmin(bearer("t"), res, vi.fn());

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({ message: "Invalid or expired token" });
  });

  test("user without a profile → 403", async () => {
    signedIn();
    findProfileRoleMock.mockResolvedValue(undefined);
    const res = makeRes();

    await protectAdmin(bearer("t"), res, vi.fn());

    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith({ message: "Admin access is required" });
  });

  test("member → 403", async () => {
    signedIn();
    findProfileRoleMock.mockResolvedValue({ role: "member" });
    const res = makeRes();
    const next = vi.fn();

    await protectAdmin(bearer("t"), res, next);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(next).not.toHaveBeenCalled();
  });

  test("admin → next() with req.user.role", async () => {
    signedIn();
    findProfileRoleMock.mockResolvedValue({ role: "admin" });
    const req = bearer("t");
    const next = vi.fn();

    await protectAdmin(req, makeRes(), next);

    expect(next).toHaveBeenCalledOnce();
    expect(req.user).toEqual({ id: "u1", role: "admin" });
  });

  test("lookup failure → 500", async () => {
    getUserMock.mockRejectedValue(new Error("network"));
    const res = makeRes();

    await protectAdmin(bearer("t"), res, vi.fn());

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({ message: "Unable to verify admin access" });
  });
});

describe("identifyAdmin (optional identity)", () => {
  test("never blocks: anonymous, bad token and lookup errors all call next()", async () => {
    for (const req of [{ headers: {} }, bearer("t"), bearer("t")]) {
      const next = vi.fn();
      getUserMock.mockResolvedValueOnce({ data: { user: null }, error: { message: "bad" } });
      await identifyAdmin(req, makeRes(), next);
      expect(next).toHaveBeenCalledOnce();
      expect(req.user).toBeUndefined();
    }

    getUserMock.mockRejectedValue(new Error("down"));
    const next = vi.fn();
    await identifyAdmin(bearer("t"), makeRes(), next);
    expect(next).toHaveBeenCalledOnce();
  });

  test("valid token attaches the profile role, defaulting to member", async () => {
    signedIn();
    findProfileRoleMock.mockResolvedValue({ role: "admin" });
    const adminReq = bearer("t");
    await identifyAdmin(adminReq, makeRes(), vi.fn());
    expect(adminReq.user).toMatchObject({ id: "u1", role: "admin" });

    findProfileRoleMock.mockResolvedValue(undefined);
    const memberReq = bearer("t");
    await identifyAdmin(memberReq, makeRes(), vi.fn());
    expect(memberReq.user.role).toBe("member");
  });
});
