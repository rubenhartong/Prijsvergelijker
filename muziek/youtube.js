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

export async function searchYouTube(q, recent = false) {
  // YouTube geeft af en toe een lege/afwijkende pagina; dan één keer opnieuw proberen
  const first = await searchOnce(q, recent);
  return first.length ? first : searchOnce(q, recent);
}

async function searchOnce(q, recent) {
  // sp=EgIQAQ%3D%3D -> alleen video's
  // EgQIAxAB = video's van deze week; EgIQAQ = alle video's
  const url = "https://www.youtube.com/results?sp=" + (recent ? "EgQIAxAB" : "EgIQAQ%253D%253D") + "&search_query=" + encodeURIComponent(q);
  const res = await fetch(url, {
    headers: { "User-Agent": UA, "Accept-Language": "nl-NL,nl;q=0.9,en;q=0.8", Cookie: "CONSENT=YES+1" },
  });
  if (!res.ok) throw new Error("YouTube gaf status " + res.status);
  return parseResults(await res.text());
}


// ---- videopagina: tracklist (hoofdstukken of tijden in de beschrijving) + vergelijkbare video's ----
const toSec = (s) => s.split(":").reduce((a, b) => a * 60 + Number(b), 0);

export function parseWatch(html) {
  const out = { tracks: [], related: [] };
  const m = html.match(/var ytInitialData = (\{.*?\});<\/script>/s);
  let data = null;
  try { data = m && JSON.parse(m[1]); } catch {}
  if (data) {
    const seen = new Set();
    (function walk(o) {
      if (!o || typeof o !== "object") return;
      if (o.chapterRenderer) {
        const c = o.chapterRenderer, t = c.title?.simpleText;
        const at = Math.round((c.timeRangeStartMillis || 0) / 1000);
        if (t && !seen.has(at)) { seen.add(at); out.tracks.push({ at, title: t }); }
        return;
      }
      const l = o.lockupViewModel;
      if (l && l.contentType === "LOCKUP_CONTENT_TYPE_VIDEO" && l.contentId) {
        let dur = "";
        (function f(x) { if (!x || typeof x !== "object" || dur) return; if (x.thumbnailBadgeViewModel?.text) { dur = x.thumbnailBadgeViewModel.text; return; } for (const k in x) f(x[k]); })(l.contentImage);
        const md = l.metadata?.lockupMetadataViewModel;
        const rows = md?.metadata?.contentMetadataViewModel?.metadataRows || [];
        const artist = rows[0]?.metadataParts?.[0]?.text?.content || "";
        if (/^\d+(:\d+)+$/.test(dur)) {
          out.related.push({ id: l.contentId, title: md?.title?.content || "", artist, duration: dur, seconds: toSec(dur) });
        }
        return;
      }
      for (const k in o) walk(o[k]);
    })(data);
  }
  if (out.tracks.length < 2) {
    // geen hoofdstukken: zoek tijden in de beschrijving, bv. "12:34 Artiest - Titel"
    const d = html.match(/"shortDescription":"((?:[^"\\]|\\.)*)"/);
    let desc = "";
    try { desc = d ? JSON.parse('"' + d[1] + '"') : ""; } catch {}
    const tr = [];
    for (const line of desc.split("\n")) {
      const t = line.match(/^\s*(?:\d+[.)]\s*)?[\[(]?((?:\d{1,2}:)?\d{1,2}:\d{2})[\])]?\s*[-–|:.]?\s*(.+?)\s*$/) ||
                line.match(/^\s*(?:\d+[.)]\s*)?(.+?)\s*[-–|]?\s*[\[(]?((?:\d{1,2}:)?\d{1,2}:\d{2})[\])]?\s*$/);
      if (!t) continue;
      const [time, title] = /\d:\d\d/.test(t[1]) ? [t[1], t[2]] : [t[2], t[1]];
      if (title && title.length > 1) tr.push({ at: toSec(time), title: title.replace(/^[-–|:.\s]+/, "") });
    }
    if (tr.length >= 3 && tr.every((x, i) => !i || x.at >= tr[i - 1].at)) out.tracks = tr;
  }
  return out;
}

export async function videoInfo(id) {
  const res = await fetch("https://www.youtube.com/watch?v=" + encodeURIComponent(id), {
    headers: { "User-Agent": UA, "Accept-Language": "nl-NL,nl;q=0.9,en;q=0.8", Cookie: "CONSENT=YES+1" },
  });
  if (!res.ok) throw new Error("YouTube gaf status " + res.status);
  return parseWatch(await res.text());
}
