const { MemoryStore } = require("express-rate-limit");
const { RedisStore } = require("rate-limit-redis");
const { getClient } = require("./redis");

// GracefulRedisStore proxies to Redis when available and falls back to the
// in-memory store otherwise, so rate limiting never takes the API down.
class GracefulRedisStore {
  constructor() {
    this.localKeys = true;
    this.memoryStore = new MemoryStore();
    this.redisStore = null;
    this.redisReady = false;
    this.initPromise = getClient()
      .then((client) => {
        this.redisStore = new RedisStore({
          sendCommand: (...args) => client.sendCommand(args),
        });
      })
      .catch(() => {
        this.redisStore = null;
      });
  }

  async redis() {
    if (!this.redisReady) {
      await this.initPromise;
      this.redisReady = true;
      if (this.redisStore && this.options) {
        Promise.resolve(this.redisStore.init(this.options)).catch(() => {});
      }
    }
    return this.redisStore;
  }

  init(options) {
    this.options = options;
    this.memoryStore.init(options);
    if (this.redisStore) {
      Promise.resolve(this.redisStore.init(options)).catch(() => {});
    }
  }

  async get(key) {
    const r = await this.redis();
    return r ? r.get(key) : this.memoryStore.get(key);
  }

  async increment(key) {
    const r = await this.redis();
    return r ? r.increment(key) : this.memoryStore.increment(key);
  }

  async decrement(key) {
    const r = await this.redis();
    return r ? r.decrement(key) : this.memoryStore.decrement(key);
  }

  async resetKey(key) {
    const r = await this.redis();
    return r ? r.resetKey(key) : this.memoryStore.resetKey(key);
  }
}

module.exports = GracefulRedisStore;
