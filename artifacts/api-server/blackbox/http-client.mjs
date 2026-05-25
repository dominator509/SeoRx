export async function req(baseUrl, method, path, opts = {}) {
  const headers = { ...(opts.headers ?? {}) };
  const init = { method, headers };
  if (opts.body !== undefined) {
    init.body = typeof opts.body === "string" ? opts.body : JSON.stringify(opts.body);
    if (!headers["Content-Type"]) headers["Content-Type"] = "application/json";
  }
  const started = Date.now();
  const res = await fetch(`${baseUrl}${path}`, init);
  const elapsedMs = Date.now() - started;
  const text = await res.text();
  let json = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {}
  return { status: res.status, headers: Object.fromEntries(res.headers.entries()), text, json, elapsedMs };
}

export function assert(condition, message) {
  if (!condition) throw new Error(message);
}
