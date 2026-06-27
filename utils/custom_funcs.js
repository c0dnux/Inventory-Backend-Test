const jwt = require("jsonwebtoken");

const signToken = (id) => {
  return jwt.sign({ id }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN,
  });
};
exports.signTokenHandler = (statusCode, message, res, user) => {
  // console.log(trialLimit);

  const token = signToken(user._id);

  const cookieOptions = {
    expires: new Date(
      Date.now() + process.env.JWT_COOKIE_EXPIRES_IN * 24 * 60 * 60 * 1000,
    ),
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "Strict",
  };

  res.cookie("jwt", token, cookieOptions);
  res.setHeader("Access-Control-Allow-Credentials", true);
  user.password = undefined;
  return res.status(statusCode).json({
    status: "Success",
    token,
    message: message,
    data: { user },
  });
};
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
