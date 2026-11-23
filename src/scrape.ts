// Cloud-scraper (stap 3).
//
// Regels
// - Alleen listings met scrape_methode='cloud' en actief=1.
// - Max 1 verzoek per listing per dag: een listing die vandaag al een waarneming heeft
//   (geslaagd of mislukt, van welke bron ook) wordt overgeslagen.
// - Niet parallel: listings worden één voor één opgehaald, met een pauze per winkel.
// - Kleine batches per cron-aanroep (gratis plan: weinig CPU-tijd en max 50 subrequests
//   per aanroep). De cron draait elke 5 minuten tussen 04:00 en 05:59 UTC en doet alleen
//   iets als het in Nederland 06:xx is (werkt zo in zomer- én wintertijd).
import { bewaarWaarneming, herberekenBenchmarks, type ListingMetEenheid } from './db';
import type { Env } from './env';
import { haalOp } from './fetcher';
import { PARSERS } from './parsers';
import { ParseFout } from './parsers/types';
import { nlNu } from './util';

export const BATCH_GROOTTE = 4;
const PAUZE_MS = 2500; // tussen twee verzoeken

export interface ScrapeResultaat {
  listing_id: number;
  winkel: string;
  ok: boolean;
  prijs?: number | null;
  actie_label?: string | null;
  prijs_per_eenheid?: number | null;
  fout?: string;
  ms?: number;
}

/** Eén listing ophalen en parsen. Gooit nooit; geeft fout terug in het resultaat. */
export async function scrapeListing(listing: ListingMetEenheid) {
  const parser = PARSERS[listing.winkel];
  if (!parser) return { ok: false as const, fout: `geen parser voor winkel ${listing.winkel}` };
  const t0 = Date.now();
  try {
    const url = parser.bronUrl ? parser.bronUrl(listing.url) : listing.url;
    const page = await haalOp(url, { headers: parser.extraHeaders });
    const g = parser.parse(page);
    if (!g.prijs) return { ok: false as const, fout: 'geen prijs gevonden', ms: Date.now() - t0 };
    return { ok: true as const, ...g, ms: Date.now() - t0 };
  } catch (e) {
    const fout = e instanceof ParseFout ? e.message : `ophalen/parsen mislukt: ${e instanceof Error ? e.message : String(e)}`;
    return { ok: false as const, fout: fout.slice(0, 300), ms: Date.now() - t0 };
  }
}

/** Volgende listings die vandaag nog niet geprobeerd zijn, winkels om-en-om. */
async function teDoen(env: Env, datum: string, max: number, listingId?: number) {
  return (
    await env.DB.prepare(
      `SELECT * FROM (
         SELECT l.*, c.eenheid,
                ROW_NUMBER() OVER (PARTITION BY l.winkel ORDER BY l.id) AS volgorde
         FROM listing l JOIN category c ON c.id = l.category_id
         WHERE l.actief = 1 AND l.scrape_methode = 'cloud'
           AND (?3 IS NULL OR l.id = ?3)
           AND NOT EXISTS (SELECT 1 FROM price_observation o WHERE o.listing_id = l.id AND o.datum = ?1))
       ORDER BY volgorde, winkel LIMIT ?2`,
    )
      .bind(datum, max, listingId ?? null)
      .all<ListingMetEenheid>()
  ).results;
}

export async function scrapeBatch(env: Env, opts: { max?: number; listingId?: number; bron?: string } = {}) {
  const { datum } = nlNu();
  const lijst = await teDoen(env, datum, opts.max ?? BATCH_GROOTTE, opts.listingId);
  const res: ScrapeResultaat[] = [];
  for (const [i, l] of lijst.entries()) {
    if (i > 0) await new Promise((r) => setTimeout(r, PAUZE_MS));
    const s = await scrapeListing(l);
    const opgeslagen = await bewaarWaarneming(
      env,
      s.ok
        ? { listing_id: l.id, datum, prijs: s.prijs, normale_prijs: s.normale_prijs, actie_label: s.actie_label }
        : { listing_id: l.id, datum, bron_ok: false, foutmelding: s.fout },
      'cloud',
    );
    res.push({
      listing_id: l.id,
      winkel: l.winkel,
      ok: opgeslagen.bron_ok,
      prijs: s.ok ? s.prijs : null,
      actie_label: s.ok ? s.actie_label : null,
      prijs_per_eenheid: 'prijs_per_eenheid' in opgeslagen ? opgeslagen.prijs_per_eenheid : null,
      fout: opgeslagen.foutmelding ?? undefined,
      ms: s.ms,
    });
  }
  if (res.length) {
    const ok = res.filter((r) => r.ok).length;
    const fouten = res.filter((r) => !r.ok).map((r) => `#${r.listing_id} ${r.winkel}: ${r.fout}`);
    await env.DB.prepare('INSERT INTO scrape_run (bron, aantal_ok, aantal_fout, foutmelding) VALUES (?, ?, ?, ?)')
      .bind(opts.bron ?? 'cloud', ok, res.length - ok, fouten.join('\n') || null)
      .run();
    await herberekenBenchmarks(env);
  }
  const resterend = (await teDoen(env, datum, 1000)).length;
  return { datum, verwerkt: res, resterend };
}

/** Cron-handler: alleen tussen 06:00 en 06:59 Nederlandse tijd. */
export async function cron(env: Env, nu = new Date()) {
  if (nlNu(nu).uur !== 6) return { overgeslagen: 'niet 06:xx NL-tijd' };
  return scrapeBatch(env, { bron: 'cloud' });
}
