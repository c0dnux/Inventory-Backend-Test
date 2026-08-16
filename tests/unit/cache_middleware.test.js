"use strict";

const { test } = require("node:test");
const assert = require("node:assert");

const { cache, cacheBust, resourceFromReq } = require("../../utils/cache_middleware");

test("resourceFromReq maps a baseUrl to its cache resource", () => {
  assert.strictEqual(resourceFromReq({ baseUrl: "/api/v1/products" }), "products");
  assert.strictEqual(resourceFromReq({ baseUrl: "/api/v1/purchases" }), "purchases");
  assert.strictEqual(resourceFromReq({ baseUrl: "/" }), "root");
});

// Redis is unavailable in the test environment; the helpers must fail open
// (resolve/reject internally, never throw synchronously).
test("cache middleware nexts through when Redis is down", async () => {
  const mw = cache(60);
  const called = await new Promise((resolve) => {
    mw(
      { baseUrl: "/api/v1/products", originalUrl: "/api/v1/products?status=active" },
      { json: () => {}, status: () => ({ json: () => {} }) },
      () => resolve(true),
    );
  });
  assert.strictEqual(called, true);
});

test("cacheBust does not throw when Redis is down", () => {
  const req = { baseUrl: "/api/v1/purchases" };
  assert.doesNotThrow(() => cacheBust(req, "products", "movements"));
});
