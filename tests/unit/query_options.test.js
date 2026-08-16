"use strict";

const { test } = require("node:test");
const assert = require("node:assert");

const mongoose = require("mongoose");
const APIFeatures = require("../../utils/query_options");

// Local schemas — no DB connection required for schema/model-level assertions
// and for building un-executed query chains.
const textSchema = new mongoose.Schema({ name: String });
textSchema.index({ name: "text" });
const TextModel = mongoose.model("TextSearchable", textSchema);

const plainSchema = new mongoose.Schema({ name: String });
const PlainModel = mongoose.model("NotSearchable", plainSchema);

test("hasTextIndex is true only for models with a text index", () => {
  assert.strictEqual(APIFeatures.hasTextIndex(TextModel), true);
  assert.strictEqual(APIFeatures.hasTextIndex(PlainModel), false);
});

test("filter builds a $text query for text-indexed models", () => {
  const features = new APIFeatures(TextModel.find(), {
    search: "tomato",
    status: "active",
    page: 2,
  });
  features.filter();
  const filter = features.query.getFilter();
  assert.deepStrictEqual(filter.$text, { $search: "tomato" });
  assert.strictEqual(filter.status, "active");
});

test("filter silently drops search on models without a text index", () => {
  const features = new APIFeatures(PlainModel.find(), {
    search: "tomato",
    status: "active",
  });
  features.filter();
  const filter = features.query.getFilter();
  assert.strictEqual(filter.search, undefined);
  assert.strictEqual(filter.$text, undefined);
  assert.strictEqual(filter.status, "active");
});

test("filter strips pagination/sort/fields keys", () => {
  const features = new APIFeatures(PlainModel.find(), {
    page: 3,
    limit: 25,
    sort: "-createdAt",
    fields: "name",
  });
  features.filter();
  const filter = features.query.getFilter();
  assert.deepStrictEqual(filter, {});
});

test("count merges deletedAt:null with the scoped filter", () => {
  const features = new APIFeatures(PlainModel.find({ createdBy: "x" }), {
    status: "active",
  });
  features.filter();
  const conditions = features.query.getFilter();
  const countQuery = features.query.model.countDocuments({
    deletedAt: null,
    ...conditions,
  });
  assert.strictEqual(countQuery.getFilter().deletedAt, null);
  assert.strictEqual(countQuery.getFilter().createdBy, "x");
  assert.strictEqual(countQuery.getFilter().status, "active");
});

test("paginate clamps limit to the maximum and keeps a minimum of 1", () => {
  const features = new APIFeatures(PlainModel.find(), {});
  features.paginate();
  assert.strictEqual(features.query.options.limit, 50); // default

  const big = new APIFeatures(PlainModel.find(), { limit: 5000 });
  big.paginate();
  assert.strictEqual(big.query.options.limit, 100);

  const zero = new APIFeatures(PlainModel.find(), { limit: 0 });
  zero.paginate();
  assert.strictEqual(zero.query.options.limit, 50); // 0 falls back to default

  const tiny = new APIFeatures(PlainModel.find(), { limit: -5 });
  tiny.paginate();
  assert.strictEqual(tiny.query.options.limit, 1); // clamped to minimum
});
