import assert from "node:assert/strict";
import { after, before, test } from "node:test";

import request from "supertest";

let app;
let connectionPool;

before(async () => {
  process.env.NODE_ENV = "test";
  ({ default: app } = await import("../app.mjs"));
  ({ default: connectionPool } = await import("../utils/db.mjs"));
});

after(async () => {
  await connectionPool.end();
});

test("GET /health reports a healthy server", async () => {
  const response = await request(app).get("/health");

  assert.equal(response.status, 200);
  assert.deepEqual(response.body, { message: "OK" });
});

test("unknown routes return JSON 404 responses", async () => {
  const response = await request(app).get("/missing");

  assert.equal(response.status, 404);
  assert.equal(response.body.message, "Route not found");
});

test("article mutations require authentication", async () => {
  const response = await request(app).post("/posts").send({});

  assert.equal(response.status, 401);
  assert.equal(response.body.message, "Authentication is required");
});

test("liking an article requires authentication", async () => {
  const response = await request(app).post("/posts/1/likes");

  assert.equal(response.status, 401);
  assert.equal(response.body.message, "Authentication is required");
});

test("unliking an article requires authentication", async () => {
  const response = await request(app).delete("/posts/1/likes");

  assert.equal(response.status, 401);
  assert.equal(response.body.message, "Authentication is required");
});

test("adding a comment requires authentication", async () => {
  const response = await request(app)
    .post("/posts/1/comments")
    .send({ message: "Test comment" });

  assert.equal(response.status, 401);
  assert.equal(response.body.message, "Authentication is required");
});

test("reading notifications requires authentication", async () => {
  const response = await request(app).get("/notifications");

  assert.equal(response.status, 401);
  assert.equal(response.body.message, "Authentication is required");
});

test("marking notifications read requires authentication", async () => {
  const response = await request(app).patch("/notifications/read");

  assert.equal(response.status, 401);
  assert.equal(response.body.message, "Authentication is required");
});

test("category mutations require authentication", async () => {
  const response = await request(app).post("/categories").send({});

  assert.equal(response.status, 401);
  assert.equal(response.body.message, "Authentication is required");
});

test("unapproved browser origins are rejected", async () => {
  const response = await request(app)
    .get("/health")
    .set("Origin", "https://example.invalid");

  assert.equal(response.status, 403);
  assert.equal(response.body.message, "Origin is not allowed by CORS");
});
