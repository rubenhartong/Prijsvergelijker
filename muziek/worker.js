// Claude Music — kleine worker: serveert de app en zoekt op YouTube zonder API-sleutel
// door de zoekpagina op te halen en ytInitialData uit te lezen.

import indexHtml from "./public/index.html";
import iconSvg from "./public/icon.svg";
import manifest from "./public/manifest.webmanifest";

const SW = `self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (e) => e.waitUntil(self.clients.claim()));
self.addEventListener("fetch", () => {});`;

const FILES = {
  "/": [indexHtml, "text/html; charset=utf-8"],
  "/index.html": [indexHtml, "text/html; charset=utf-8"],
  "/icon.svg": [iconSvg, "image/svg+xml"],
  "/manifest.webmanifest": [manifest, "application/manifest+json"],
  "/sw.js": [SW, "text/javascript"],
};

import { searchYouTube, videoInfo } from "./youtube.js";

const json = (body, status = 200, extra = {}) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json; charset=utf-8", "Access-Control-Allow-Origin": "*", ...extra },
  });

// Antwoord uit de Cloudflare-cache halen, of ophalen en (alleen als het bruikbaar is) bewaren
async function cached(ctx, name, maxAge, load, ok) {
  const cache = caches.default;
  const key = new Request("https://cache.claude-music/v3/" + encodeURIComponent(name));
  const hit = await cache.match(key);
  if (hit) return hit;
  try {
    const data = await load();
    const good = ok(data);
    const resp = json(data, 200, { "Cache-Control": good ? "public, max-age=" + maxAge : "no-store" });
    if (good) ctx.waitUntil(cache.put(key, resp.clone()));
    return resp;
  } catch (e) {
    return json({ error: String(e.message || e) }, 502);
  }
}

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    if (url.pathname === "/api/search") {
      const q = (url.searchParams.get("q") || "").trim().slice(0, 200);
      const recent = url.searchParams.get("recent") === "1";
      if (!q) return json({ results: [] });
      return cached(ctx, "search/" + (recent ? "week/" : "") + q.toLowerCase(), recent ? 1800 : 3600, async () => ({ results: await searchYouTube(q, recent) }), (d) => d.results.length > 0);
    }
    if (url.pathname === "/api/video") {
      const id = url.searchParams.get("id") || "";
      if (!/^[\w-]{11}$/.test(id)) return json({ error: "ongeldig id" }, 400);
      return cached(ctx, "video/" + id, 6 * 3600, () => videoInfo(id), (d) => d.related.length > 0 || d.tracks.length > 0);
    }
    const sm = url.pathname.match(/^\/api\/sync\/([a-z0-9]{10,32})$/);
    if (sm) {
      const key = "lib:" + sm[1];
      if (request.method === "GET") {
        const v = await env.SYNC.get(key);
        return v ? new Response(v, { headers: { "Content-Type": "application/json", "Cache-Control": "no-store" } }) : json({ empty: true });
      }
      if (request.method === "PUT") {
        const body = await request.text();
        if (body.length > 1_000_000) return json({ error: "te groot" }, 413);
        try { JSON.parse(body); } catch { return json({ error: "geen JSON" }, 400); }
        await env.SYNC.put(key, body);
        return json({ ok: true });
      }
      return json({ error: "methode" }, 405);
    }
    const f = FILES[url.pathname];
    if (f) return new Response(f[0], { headers: { "Content-Type": f[1], "Cache-Control": "public, max-age=300" } });
    return new Response("Niet gevonden", { status: 404 });
  },
};
