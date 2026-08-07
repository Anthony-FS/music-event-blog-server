import { afterAll, beforeAll, describe, expect, it } from "vitest";
import request from "supertest";

let app;
let connectionPool;

beforeAll(async () => {
  process.env.NODE_ENV = "test";
  ({ default: app } = await import("../app.mjs"));
  ({ default: connectionPool } = await import("../utils/db.mjs"));
});

afterAll(async () => {
  await connectionPool.end();
});

describe("app", () => {
  it("GET /health reports a healthy server", async () => {
    const response = await request(app).get("/health");

    expect(response.status).toBe(200);
    expect(response.body).toEqual({ message: "OK" });
  });

  it("unknown routes return JSON 404 responses", async () => {
    const response = await request(app).get("/missing");

    expect(response.status).toBe(404);
    expect(response.body.message).toBe("Route not found");
  });

  it("article mutations require authentication", async () => {
    const response = await request(app).post("/posts").send({});

    expect(response.status).toBe(401);
    expect(response.body.message).toBe("Authentication is required");
  });

  it("liking an article requires authentication", async () => {
    const response = await request(app).post("/posts/1/likes");

    expect(response.status).toBe(401);
    expect(response.body.message).toBe("Authentication is required");
  });

  it("unliking an article requires authentication", async () => {
    const response = await request(app).delete("/posts/1/likes");

    expect(response.status).toBe(401);
    expect(response.body.message).toBe("Authentication is required");
  });

  it("adding a comment requires authentication", async () => {
    const response = await request(app)
      .post("/posts/1/comments")
      .send({ message: "Test comment" });

    expect(response.status).toBe(401);
    expect(response.body.message).toBe("Authentication is required");
  });

  it("reading notifications requires authentication", async () => {
    const response = await request(app).get("/notifications");

    expect(response.status).toBe(401);
    expect(response.body.message).toBe("Authentication is required");
  });

  it("marking notifications read requires authentication", async () => {
    const response = await request(app).patch("/notifications/read");

    expect(response.status).toBe(401);
    expect(response.body.message).toBe("Authentication is required");
  });

  it("category mutations require authentication", async () => {
    const response = await request(app).post("/categories").send({});

    expect(response.status).toBe(401);
    expect(response.body.message).toBe("Authentication is required");
  });

  it("avatar uploads require authentication", async () => {
    const response = await request(app).post("/avatars");

    expect(response.status).toBe(401);
    expect(response.body.message).toBe("Authentication is required");
  });

  it("unapproved browser origins are rejected", async () => {
    const response = await request(app)
      .get("/health")
      .set("Origin", "https://example.invalid");

    expect(response.status).toBe(403);
    expect(response.body.message).toBe("Origin is not allowed by CORS");
  });
});
