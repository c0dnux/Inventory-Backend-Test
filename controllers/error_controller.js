const AppError = require("../utils/app_error");

const handleCastErrDB = (err) => {
  const message = `Invalid ${err.path}: ${err.value}`;
  return new AppError(message, 404);
};
const handleValErrDB = (err) => {
  const errors = Object.values(err.errors).map((elem) => elem.message);
  const message = `${errors.join(". ")}`;
  return new AppError(message, 400);
};
const handleDuplErrDB = (err) => {
  const [key, value] = Object.entries(err.errorResponse.keyValue)[0];

  const message = `${key} :${value} already exists.`;
  return new AppError(message, 403);
};
const handleAuthErr = () => {
  return new AppError("Action not Allowed,login to get access", 401);
};
const handleAuthEXpireErr = () => {
  return new AppError("Login Timeout,please login again.", 401);
};
const sendErrDev = (err, req, res) => {
  if (req.originalUrl.startsWith("/api")) {
    res.status(err.statusCode).json({
      status: err.status,
      error: err,
      message: err.message,
      stack: err.stack,
    });
  } else {
    res.status(err.statusCode).render("error", {
      title: "Something went wrong!",
      msg: err.message,
    });
  }
};
const sendErrProduc = (err, req, res) => {
  if (req.originalUrl.startsWith("/api")) {
    if (err.isOperational) {
      return res.status(err.statusCode).json({
        status: err.status,
        message: err.message,
      });
    }

    console.error("Error", err);
    return res.status(500).json({
      status: "Error",
      message: "Something went very wrong!",
    });
  }
  if (err.isOperational) {
    return res.status(err.statusCode).render("error", {
      title: "Something went wrong!",
      msg: err.message,
    });
  }
  console.error("Error", err);
  return res.status(err.statusCode).render("error", {
    title: "Something went wrong!",
    msg: "Please try again later",
  });
};

module.exports = (err, req, res, next) => {
  err.statusCode = err.statusCode || 500;
  err.status = err.status || "Error";
  if (process.env.NODE_ENV === "development") {
    sendErrDev(err, req, res);
  } else if (process.env.NODE_ENV === "production") {
    // let error = {
    //   ...err,
    //   name: err.name || "Unknown Error",
    //   code: err.code,
    //   message: err.message || "An Unknown error have occurred",
    //   stack: err.stack,
    // };
    let error = {
      name: err.name ?? "Unknown Error",
      code: err.code ?? "Unknown Code",
      message: err.message ?? "An unknown error has occurred",
      stack: err.stack ?? "No stack trace available",
      ...err, // Spread last to ensure existing properties are not overridden
    };

    if (error.name === "CastError") error = handleCastErrDB(error);
    if (error.code === 11000) error = handleDuplErrDB(error);
    if (error.name === "ValidationError") error = handleValErrDB(error);
    if (error.name === "JsonWebTokenError") error = handleAuthErr();
    if (error.name === "TokenExpiredError") error = handleAuthEXpireErr();
    sendErrProduc(error, req, res);
  }
};
