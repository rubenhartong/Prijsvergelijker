// YouTube-zoekresultaten ophalen zonder API-sleutel (ytInitialData uit de zoekpagina).

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
  // YouTube geeft af en toe een lege/afwijkende pagina; dan één keer opnieuw proberen
  const first = await searchOnce(q);
  return first.length ? first : searchOnce(q);
}

async function searchOnce(q) {
  // sp=EgIQAQ%3D%3D -> alleen video's
  const url = "https://www.youtube.com/results?sp=EgIQAQ%253D%253D&search_query=" + encodeURIComponent(q);
  const res = await fetch(url, {
    headers: { "User-Agent": UA, "Accept-Language": "nl-NL,nl;q=0.9,en;q=0.8", Cookie: "CONSENT=YES+1" },
  });
  if (!res.ok) throw new Error("YouTube gaf status " + res.status);
  return parseResults(await res.text());
}

