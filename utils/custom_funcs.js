const jwt = require("jsonwebtoken");
const crypto = require("crypto");
const Counter = require("../models/counter_model");

const getRefreshSecret = () =>
  process.env.JWT_REFRESH_SECRET || process.env.JWT_SECRET;

const ACCESS_EXPIRES_IN = process.env.JWT_ACCESS_EXPIRES_IN || "15m";
const REFRESH_EXPIRES_IN = process.env.JWT_REFRESH_EXPIRES_IN || "7d";
const ACCESS_COOKIE_EXPIRES_MS =
  (Number(process.env.JWT_ACCESS_COOKIE_EXPIRES_IN) || 15) * 60 * 1000;
const REFRESH_COOKIE_EXPIRES_MS =
  (Number(process.env.JWT_REFRESH_COOKIE_EXPIRES_IN) || 7) * 24 * 60 * 60 * 1000;

const signToken = (id) =>
  jwt.sign({ id }, process.env.JWT_SECRET, { expiresIn: ACCESS_EXPIRES_IN });

const signRefreshToken = (id, tokenId) =>
  jwt.sign({ id, tokenId }, getRefreshSecret(), { expiresIn: REFRESH_EXPIRES_IN });

const hashToken = (token) =>
  crypto.createHash("sha256").update(token).digest("hex");

// `secure` is only meaningful over HTTPS. In production we mark cookies secure
// when the request actually arrived over TLS (directly or via a trusted proxy);
// otherwise (e.g. local testing over plain HTTP) the browser would silently drop
// them and break the refresh flow.
const isRequestSecure = (res) =>
  Boolean(res?.req?.secure || res?.req?.headers?.["x-forwarded-proto"] === "https");

const accessCookieOptions = (res) => ({
  expires: new Date(Date.now() + ACCESS_COOKIE_EXPIRES_MS),
  httpOnly: true,
  secure: process.env.NODE_ENV === "production" && isRequestSecure(res),
  sameSite: "Strict",
});

const refreshCookieOptions = (res) => ({
  expires: new Date(Date.now() + REFRESH_COOKIE_EXPIRES_MS),
  httpOnly: true,
  secure: process.env.NODE_ENV === "production" && isRequestSecure(res),
  sameSite: "Strict",
  path: "/api/v1/auth",
});

const setAuthCookies = (res, accessToken, refreshToken) => {
  res.cookie("jwt", accessToken, accessCookieOptions(res));
  res.cookie("jwt_refresh", refreshToken, refreshCookieOptions(res));
};

const clearAuthCookies = (res) => {
  res.clearCookie("jwt", accessCookieOptions(res));
  res.clearCookie("jwt_refresh", refreshCookieOptions(res));
};

const issueTokens = async (res, user) => {
  const accessToken = signToken(user._id);
  const tokenId = crypto.randomBytes(32).toString("hex");
  const refreshToken = signRefreshToken(user._id, tokenId);

  await user.addRefreshToken(hashToken(refreshToken), REFRESH_COOKIE_EXPIRES_MS);
  setAuthCookies(res, accessToken, refreshToken);
  return { accessToken, refreshToken };
};

exports.signTokenHandler = async (statusCode, message, res, user) => {
  const { accessToken } = await issueTokens(res, user);

  await user.populate({ path: "role", populate: { path: "permissions" } });

  res.setHeader("Access-Control-Allow-Credentials", true);
  user.password = undefined;
  return res.status(statusCode).json({
    status: "success",
    token: accessToken,
    message: message,
    data: { user },
  });
};
exports.signRefreshToken = signRefreshToken;
exports.verifyRefreshToken = (token) => jwt.verify(token, getRefreshSecret());
exports.hashToken = hashToken;
exports.clearAuthCookies = clearAuthCookies;
exports.setAuthCookies = setAuthCookies;
exports.generatePurchaseRef = async (Purchase) => {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const key = `purchaseRef-${year}${month}`;

  // Atomic per-month counter: concurrent orders get distinct sequence numbers,
  // unlike the old countDocuments()-based "next number" which raced to
  // duplicates. First use of a month upserts the counter (seq 0 → 1).
  const counter = await Counter.findOneAndUpdate(
    { key },
    { $inc: { seq: 1 } },
    { returnDocument: "after", upsert: true, setDefaultsOnInsert: true },
  );

  return `PO-${year}${month}-${String(counter.seq).padStart(3, "0")}`;
};

// Backfill the current month's counter from existing PO references so a fresh
// Counter collection (e.g. right after deploy) doesn't collide with refs that
// were already handed out by the old count-based generator.
exports.seedPurchaseRefCounter = async (Purchase) => {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const key = `purchaseRef-${year}${month}`;

  const exists = await Counter.exists({ key });
  if (exists) return;

  const prefix = `PO-${year}${month}-`;
  const purchases = await Purchase.find({
    referenceNo: { $regex: `^${prefix}` },
  }).select("referenceNo");
  const maxSeq = purchases.reduce((max, p) => {
    const seq = Number(p.referenceNo.slice(prefix.length));
    return Number.isFinite(seq) ? Math.max(max, seq) : max;
  }, 0);

  await Counter.updateOne(
    { key },
    { $setOnInsert: { seq: maxSeq } },
    { upsert: true },
  );
};
