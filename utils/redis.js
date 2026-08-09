const redis = require("redis");

const REDIS_URL = process.env.REDIS_URL || "redis://127.0.0.1:6379";

let client = null;
let connectingPromise = null;
let warned = false;

const getClient = async () => {
  if (client && client.isOpen) return client;
  if (connectingPromise) return connectingPromise;

  connectingPromise = (async () => {
    const c = redis.createClient({
      url: REDIS_URL,
      socket: {
        reconnectStrategy: () => new Error("Redis unavailable"),
      },
    });

    c.on("error", (err) => {
      if (!warned) {
        warned = true;
        console.error(
          `Redis unavailable (${err.message}) — running without cache.`,
        );
      }
    });

    await c.connect();
    client = c;
    return c;
  })().catch((err) => {
    connectingPromise = null; // allow a later retry
    throw err;
  });

  return connectingPromise;
};

const getJSON = async (key) => {
  const c = await getClient();
  const raw = await c.get(key);
  return raw ? JSON.parse(raw) : null;
};

const setJSON = async (key, value, ttlSeconds) => {
  const c = await getClient();
  await c.set(key, JSON.stringify(value), { EX: ttlSeconds });
};

const deleteKeys = async (pattern) => {
  const c = await getClient();
  let cursor = 0;
  const keys = [];
  do {
    const reply = await c.scan(cursor, { MATCH: pattern, COUNT: 100 });
    cursor = reply.cursor;
    if (reply.keys.length) keys.push(...reply.keys);
  } while (cursor !== 0);

  if (keys.length) await c.del(keys);
  return keys.length;
};

const disconnect = async () => {
  if (client && client.isOpen) await client.quit();
};

module.exports = { getClient, getJSON, setJSON, deleteKeys, disconnect };
