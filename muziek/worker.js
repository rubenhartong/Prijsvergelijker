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

import { searchYouTube } from "./youtube.js";

const json = (body, status = 200, extra = {}) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json; charset=utf-8", "Access-Control-Allow-Origin": "*", ...extra },
  });

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    if (url.pathname === "/api/search") {
      const q = (url.searchParams.get("q") || "").trim().slice(0, 200);
      if (!q) return json({ results: [] });
      const cache = caches.default;
      const key = new Request("https://cache.claude-music/v2/search?q=" + encodeURIComponent(q.toLowerCase()));
      const hit = await cache.match(key);
      if (hit) return hit;
      try {
        const results = await searchYouTube(q);
        const resp = json({ results }, 200, { "Cache-Control": results.length ? "public, max-age=3600" : "no-store" });
        if (results.length) ctx.waitUntil(cache.put(key, resp.clone()));
        return resp;
      } catch (e) {
        return json({ error: String(e.message || e) }, 502);
      }
    }
    const f = FILES[url.pathname];
    if (f) return new Response(f[0], { headers: { "Content-Type": f[1], "Cache-Control": "public, max-age=300" } });
    return new Response("Niet gevonden", { status: 404 });
  },
};
