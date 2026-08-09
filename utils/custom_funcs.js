const jwt = require("jsonwebtoken");
const crypto = require("crypto");

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

const accessCookieOptions = () => ({
  expires: new Date(Date.now() + ACCESS_COOKIE_EXPIRES_MS),
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "Strict",
});

const refreshCookieOptions = () => ({
  expires: new Date(Date.now() + REFRESH_COOKIE_EXPIRES_MS),
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "Strict",
  path: "/api/v1/auth",
});

const setAuthCookies = (res, accessToken, refreshToken) => {
  res.cookie("jwt", accessToken, accessCookieOptions());
  res.cookie("jwt_refresh", refreshToken, refreshCookieOptions());
};

const clearAuthCookies = (res) => {
  res.clearCookie("jwt", accessCookieOptions());
  res.clearCookie("jwt_refresh", refreshCookieOptions());
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

  res.setHeader("Access-Control-Allow-Credentials", true);
  user.password = undefined;
  return res.status(statusCode).json({
    status: "Success",
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

  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const count = await Purchase.countDocuments({
    createdAt: { $gte: startOfMonth },
  });

  return `PO-${year}${month}-${String(count + 1).padStart(3, "0")}`;
};
