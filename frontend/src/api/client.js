export async function api(path, options = {}) {
  const res = await fetch("/api" + path, {
    ...options,
    headers: {
      ...(options.body instanceof FormData
        ? {}
        : { "Content-Type": "application/json" }),
      ...options.headers,
    },
  });
  const body = await res.json();
  if (!res.ok)
    throw Object.assign(Error(body.error || "Request failed"), {
      status: res.status,
    });
  return body;
}
