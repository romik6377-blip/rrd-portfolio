const PUBLIC_KEYS = new Set([
  "rrd_projects",
  "rrd_prices",
  "rrd_hero_images",
  "rrd_site_stats",
  "rrd_panorama_url",
  "rrd_panorama_config"
]);

function origin(request, env) {
  return env.ALLOWED_ORIGIN || request.headers.get("Origin") || "*";
}

function corsHeaders(request, env) {
  const o = origin(request, env);
  return {
    "Access-Control-Allow-Origin": o,
    "Access-Control-Allow-Credentials": "true",
    "Access-Control-Allow-Headers": "Authorization, Content-Type, X-File-Name",
    "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
    "Vary": "Origin"
  };
}

function json(data, status = 200, request, env, extra = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json; charset=utf-8", ...corsHeaders(request, env), ...extra }
  });
}

function b64url(bytes) {
  let s = "";
  for (const b of new Uint8Array(bytes)) s += String.fromCharCode(b);
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}
function unb64url(s) {
  s = s.replace(/-/g, "+").replace(/_/g, "/");
  while (s.length % 4) s += "=";
  const bin = atob(s);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}
async function hmac(secret, value) {
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign", "verify"]);
  return crypto.subtle.sign("HMAC", key, new TextEncoder().encode(value));
}
async function makeToken(env, email) {
  const payload = b64url(new TextEncoder().encode(JSON.stringify({ email, exp: Date.now() + 8 * 60 * 60 * 1000 })));
  const sig = b64url(await hmac(env.SESSION_SECRET, payload));
  return payload + "." + sig;
}
async function verifyToken(env, token) {
  if (!token || !env.SESSION_SECRET) return null;
  const [payload, sig] = token.split(".");
  if (!payload || !sig) return null;
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(env.SESSION_SECRET), { name: "HMAC", hash: "SHA-256" }, false, ["verify"]);
  const ok = await crypto.subtle.verify("HMAC", key, unb64url(sig), new TextEncoder().encode(payload));
  if (!ok) return null;
  try {
    const data = JSON.parse(new TextDecoder().decode(unb64url(payload)));
    if (!data.email || data.exp < Date.now()) return null;
    return data;
  } catch { return null; }
}
async function requireAuth(request, env) {
  const header = request.headers.get("Authorization") || "";
  return verifyToken(env, header.startsWith("Bearer ") ? header.slice(7) : "");
}

function safeKey(input) {
  const key = decodeURIComponent(input || "").replace(/\\/g, "/").replace(/^\/+/, "");
  if (!key || key.includes("..") || key.includes("//") || key.length > 500) return null;
  return key.replace(/[^a-zA-Z0-9._\-/]/g, "-");
}

export default {
  async fetch(request, env) {
    if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: corsHeaders(request, env) });
    const url = new URL(request.url);

    // Public media endpoint. The R2 bucket itself can remain private.
    if (url.pathname.startsWith("/media/")) {
      const key = safeKey(url.pathname.slice("/media/".length));
      if (!key) return new Response("Bad key", { status: 400, headers: corsHeaders(request, env) });
      const object = await env.MEDIA.get(key);
      if (!object) return new Response("Not found", { status: 404, headers: corsHeaders(request, env) });
      const headers = new Headers(corsHeaders(request, env));
      object.writeHttpMetadata(headers);
      headers.set("ETag", object.httpEtag);
      headers.set("Cache-Control", "public, max-age=31536000, immutable");
      return new Response(object.body, { headers });
    }

    if (url.pathname === "/api/auth/login" && request.method === "POST") {
      const body = await request.json().catch(() => ({}));
      if (!env.ADMIN_EMAIL || !env.ADMIN_PASSWORD || !env.SESSION_SECRET) return json({ error: "AUTH_NOT_CONFIGURED" }, 500, request, env);
      if (body.email !== env.ADMIN_EMAIL || body.password !== env.ADMIN_PASSWORD) return json({ error: "INVALID_CREDENTIALS" }, 401, request, env);
      return json({ ok: true, token: await makeToken(env, body.email) }, 200, request, env);
    }

    if (url.pathname === "/api/auth/me" && request.method === "GET") {
      const user = await requireAuth(request, env);
      return json({ authenticated: !!user, email: user?.email || null }, user ? 200 : 401, request, env);
    }

    if (url.pathname === "/api/state" && request.method === "GET") {
      if (!env.DB) return json({ error: "D1_NOT_CONFIGURED" }, 500, request, env);
      const rows = await env.DB.prepare("SELECT key, data FROM site_state WHERE key IN (?, ?, ?, ?, ?)")
        .bind(...PUBLIC_KEYS).all();
      const out = {};
      for (const row of rows.results || []) { try { out[row.key] = JSON.parse(row.data); } catch {} }
      return json(out, 200, request, env);
    }

    if (url.pathname.startsWith("/api/state/") && request.method === "PUT") {
      const user = await requireAuth(request, env);
      if (!user) return json({ error: "UNAUTHORIZED" }, 401, request, env);
      if (!env.DB) return json({ error: "D1_NOT_CONFIGURED" }, 500, request, env);
      const key = decodeURIComponent(url.pathname.slice("/api/state/".length));
      const allowed = new Set([...PUBLIC_KEYS, "rrd_media_library", "rrd_site_settings"]);
      if (!allowed.has(key)) return json({ error: "KEY_NOT_ALLOWED" }, 400, request, env);
      const body = await request.json().catch(() => null);
      if (!body || !Object.prototype.hasOwnProperty.call(body, "data")) return json({ error: "DATA_REQUIRED" }, 400, request, env);
      await env.DB.prepare("INSERT INTO site_state(key,data,updated_at) VALUES(?,?,datetime('now')) ON CONFLICT(key) DO UPDATE SET data=excluded.data,updated_at=excluded.updated_at")
        .bind(key, JSON.stringify(body.data)).run();
      return json({ ok: true, key }, 200, request, env);
    }

    if (url.pathname === "/api/upload" && request.method === "PUT") {
      const user = await requireAuth(request, env);
      if (!user) return json({ error: "UNAUTHORIZED" }, 401, request, env);
      const key = safeKey(url.searchParams.get("key"));
      if (!key) return json({ error: "BAD_KEY" }, 400, request, env);
      const type = request.headers.get("Content-Type") || "application/octet-stream";
      const object = await env.MEDIA.put(key, request.body, { httpMetadata: { contentType: type, cacheControl: "public, max-age=31536000, immutable" } });
      const base = (env.PUBLIC_MEDIA_BASE || new URL(request.url).origin).replace(/\/$/, "");
      return json({ ok: true, key, url: base + "/media/" + encodeURIComponent(key).replace(/%2F/g, "/"), size: object?.size || null }, 200, request, env);
    }

    if (url.pathname === "/api/media" && request.method === "GET") {
      const user = await requireAuth(request, env);
      if (!user) return json({ error: "UNAUTHORIZED" }, 401, request, env);
      const listed = await env.MEDIA.list({ limit: 1000 });
      const base = (env.PUBLIC_MEDIA_BASE || new URL(request.url).origin).replace(/\/$/, "");
      return json({ objects: listed.objects.map(o => ({ key:o.key,size:o.size,uploaded:o.uploaded,etag:o.etag,url:base+"/media/"+o.key.split("/").map(encodeURIComponent).join("/") })) }, 200, request, env);
    }

    if (url.pathname === "/api/media" && request.method === "DELETE") {
      const user = await requireAuth(request, env);
      if (!user) return json({ error: "UNAUTHORIZED" }, 401, request, env);
      const key = safeKey(url.searchParams.get("key"));
      if (!key) return json({ error: "BAD_KEY" }, 400, request, env);
      await env.MEDIA.delete(key);
      return json({ ok:true, key }, 200, request, env);
    }

    return json({ service: "RRD Admin API", ok: true }, 200, request, env);
  }
};
