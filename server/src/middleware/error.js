function errorHandler(err, req, res, _next) {
  console.error("[error]", err);

  if (err.name === "ZodError") {
    return res.status(400).json({ error: "Validation failed", details: err.errors });
  }

  const status = err.status || 500;
  res.status(status).json({
    error: err.message || "Internal server error",
    ...(process.env.NODE_ENV !== "production" && { stack: err.stack }),
  });
}

function notFound(req, res) {
  res.status(404).json({ error: `Not found: ${req.method} ${req.path}` });
}

module.exports = { errorHandler, notFound };
