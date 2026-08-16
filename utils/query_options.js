class APIFeatures {
  constructor(query, queryString) {
    this.query = query;
    this.queryString = queryString;
  }

  /**
   * True when the model declares a Mongo text index. Only models with a text
   * index can use `$text` — building it for others makes Mongo throw a raw
   * 500 ("text index required").
   */
  static hasTextIndex(model) {
    return model.schema
      .indexes()
      .some(([fields]) => Object.values(fields).some((v) => v === "text"));
  }

  filter() {
    //Filtering
    const queryObj = { ...this.queryString };
    const delObj = ["page", "sort", "limit", "fields"];

    delObj.forEach((el) => {
      delete queryObj[el];
    });

    // Free-text search → MongoDB $text. Only Product has a text index, so on
    // other models the `search` param is silently dropped instead of making
    // Mongo throw a raw 500.
    if (queryObj.search) {
      if (APIFeatures.hasTextIndex(this.query.model)) {
        queryObj.$text = { $search: queryObj.search };
      }
      delete queryObj.search;
    }

    //Advanced Filtering
    let queryString = JSON.stringify(queryObj);
    queryString = queryString.replace(
      /\b(gte|gt|lt|lte)\b/g,
      (match) => `$${match}`,
    );
    this._filterConditions = JSON.parse(queryString);
    this.query = this.query.find(this._filterConditions);
    return this;
  }

  /**
   * Total count matching the same filters (without pagination).
   *
   * Uses the query's merged filter (base conditions from the initial
   * `Model.find(...)` plus everything added in `filter()`) so scoped queries
   * like `find({ createdBy: ... })` count correctly too.
   *
   * `deletedAt: null` mirrors the soft-delete `pre(/^find/)` middleware —
   * `countDocuments()` does not trigger that middleware, so we exclude
   * soft-deleted documents explicitly. Models without a `deletedAt` field
   * are unaffected (a missing field matches `null`).
   */
  count() {
    const conditions = {
      deletedAt: null,
      ...(this.query.getFilter() || {}),
    };
    return this.query.model.countDocuments(conditions);
  }
  sort() {
    if (this.queryString.sort) {
      const sortBy = this.queryString.sort.split(",").join(" ");
      this.query = this.query.sort(sortBy);
    }
    return this;
  }
  limiting() {
    if (this.queryString.fields) {
      const fields = this.queryString.fields.split(",").join(" ");
      this.query = this.query.select(fields);
    }
    return this;
  }
  paginate() {
    const MAX_LIMIT = 100;
    const page = Math.max(1, Number(this.queryString.page) || 1);
    const limit = Math.min(MAX_LIMIT, Math.max(1, Number(this.queryString.limit) || 50));
    const skip = page * limit - limit;
    this.query = this.query.skip(skip).limit(limit);

    return this;
  }
}

module.exports = APIFeatures;
