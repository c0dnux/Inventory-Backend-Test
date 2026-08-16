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

/**
 * Bust the cache for the resource inferred from the request (same inference as
 * the read key, so the two can't drift) plus any extra resources the mutation
 * also affects (e.g. a purchase receive also invalidates products/movements).
 */
const cacheBust = (req, ...extraResources) => {
  clearCache(resourceFromReq(req), ...extraResources);
};

module.exports = { cache, clearCache, cacheBust, resourceFromReq };
