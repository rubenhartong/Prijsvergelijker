// Draaitafel — kleine worker: serveert de app en zoekt op YouTube zonder API-sleutel
// door de zoekpagina op te halen en ytInitialData uit te lezen.

const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0 Safari/537.36";

export function parseResults(html) {
  const m = html.match(/var ytInitialData = (\{.*?\});<\/script>/s);
  if (!m) return [];
  let data;
  try { data = JSON.parse(m[1]); } catch { return []; }
  const out = [];
  const seen = new Set();
  (function walk(o) {
    if (!o || typeof o !== "object") return;
    const v = o.videoRenderer;
    if (v && v.videoId && !seen.has(v.videoId)) {
      seen.add(v.videoId);
      const dur = v.lengthText?.simpleText;
      if (dur) {
        // livestreams hebben geen duur; die slaan we over
        out.push({
          id: v.videoId,
          title: (v.title?.runs || []).map((r) => r.text).join("") || "",
          artist: v.ownerText?.runs?.[0]?.text || "",
          duration: dur,
          seconds: dur.split(":").reduce((a, b) => a * 60 + Number(b), 0),
        });
      }
      return;
    }
    for (const k in o) walk(o[k]);
  })(data);
  return out;
}

export async function searchYouTube(q) {
  // sp=EgIQAQ%3D%3D -> alleen video's
  const url = "https://www.youtube.com/results?sp=EgIQAQ%253D%253D&search_query=" + encodeURIComponent(q);
  const res = await fetch(url, {
    headers: { "User-Agent": UA, "Accept-Language": "nl-NL,nl;q=0.9,en;q=0.8", Cookie: "CONSENT=YES+1" },
  });
  if (!res.ok) throw new Error("YouTube gaf status " + res.status);
  return parseResults(await res.text());
}

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
      const key = new Request("https://cache.draaitafel/search?q=" + encodeURIComponent(q.toLowerCase()));
      const hit = await cache.match(key);
      if (hit) return hit;
      try {
        const results = await searchYouTube(q);
        const resp = json({ results }, 200, { "Cache-Control": "public, max-age=3600" });
        ctx.waitUntil(cache.put(key, resp.clone()));
        return resp;
      } catch (e) {
        return json({ error: String(e.message || e) }, 502);
      }
    }
    return env.ASSETS.fetch(request);
  },
};
