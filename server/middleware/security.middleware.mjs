export const securityHeaders = (req, res, next) => {
  if (req.path.startsWith("/api")) res.set("Cache-Control", "no-store");
  res.set({
    "X-Content-Type-Options": "nosniff",
    "Referrer-Policy": "same-origin",
    "Content-Security-Policy":
      "default-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; script-src 'self'; connect-src 'self'; frame-ancestors 'none'",
  });
  next();
};
