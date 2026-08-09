const { getJSON, setJSON, deleteKeys } = require("./redis");

const CACHE_PREFIX = "cache";

const resourceFromReq = (req) => req.baseUrl.split("/").pop() || "root";

const cacheKey = (req) =>
  `${CACHE_PREFIX}:${resourceFromReq(req)}:${req.originalUrl}`;

const cache = (ttlSeconds = 60) => (req, res, next) => {
  const key = cacheKey(req);

  getJSON(key)
    .then((cached) => {
      if (cached) {
        return res.status(cached.statusCode).json(cached.body);
      }

      const originalJson = res.json.bind(res);
      res.json = (body) => {
        if (res.statusCode >= 200 && res.statusCode < 400) {
          setJSON(key, { statusCode: res.statusCode, body }, ttlSeconds).catch(
            () => {},
          );
        }
        return originalJson(body);
      };
      next();
    })
    .catch(() => {
      next();
    });
};

const clearCache = (...resources) => {
  for (const resource of resources) {
    deleteKeys(`${CACHE_PREFIX}:${resource}:*`).catch(() => {});
  }
};

module.exports = { cache, clearCache };
