"use strict";

const { test } = require("node:test");
const assert = require("node:assert");

const authorize = require("../../middleware/authorize");
const AppError = require("../../utils/app_error");

const nextStub = () => {
  const calls = [];
  const fn = (...args) => {
    calls.push(args);
  };
  return { fn, calls };
};

test("authorize returns 401 when no user is attached", () => {
  const mw = authorize("products", "read");
  const n = nextStub();
  mw({}, {}, n.fn);
  assert.strictEqual(n.calls.length, 1);
  const [err] = n.calls[0];
  assert.ok(err instanceof AppError);
  assert.strictEqual(err.statusCode, 401);
});

test("authorize allows when the role has the matching permission", () => {
  const mw = authorize("products", "create");
  const req = {
    user: {
      role: {
        permissions: [
          { resource: "products", action: "read" },
          { resource: "products", action: "create" },
        ],
      },
    },
  };
  const n = nextStub();
  mw(req, {}, n.fn);
  assert.strictEqual(n.calls.length, 1);
  assert.deepStrictEqual(n.calls[0], []); // next() called with no error
});

test("authorize denies when the permission is missing", () => {
  const mw = authorize("products", "delete");
  const req = {
    user: {
      role: {
        permissions: [{ resource: "products", action: "read" }],
      },
    },
  };
  const n = nextStub();
  mw(req, {}, n.fn);
  assert.strictEqual(n.calls.length, 1);
  const [err] = n.calls[0];
  assert.ok(err instanceof AppError);
  assert.strictEqual(err.statusCode, 403);
});

test("authorize tolerates a user with no role/permissions", () => {
  const mw = authorize("products", "read");
  const n = nextStub();
  mw({ user: {} }, {}, n.fn);
  assert.strictEqual(n.calls.length, 1);
  assert.strictEqual(n.calls[0][0].statusCode, 403);
});
