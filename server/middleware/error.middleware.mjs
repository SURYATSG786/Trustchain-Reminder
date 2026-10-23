export const errorHandler = (err, req, res, next) => {
  console.error(err.message);
  res.status(err.status || 400).json({
    error:
      err.status === 413 ? "Upload too large" : err.message || "Request failed",
  });
};
