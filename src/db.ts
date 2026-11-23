import type { Env } from './env';
import { eenhedenIn, normalize, type Eenheid } from './normalize';
import { HttpError, nlNu } from './util';

export interface CategoryRow {
  id: number;
  naam: string;
  eenheid: Eenheid;
  benchmark_prijs: number | null;
  benchmark_listing_id: number | null;
}

export interface ListingRow {
  id: number;
  category_id: number;
  winkel: string;
  merk: string;
  productnaam: string;
  url: string;
  stuks_per_verpakking: number;
  scrape_methode: 'cloud' | 'thuis';
  actief: number;
}

export interface ListingMetEenheid extends ListingRow {
  eenheid: Eenheid;
}

/** Ruwe waarneming zoals een scraper (cloud of thuis) die aanlevert. */
export interface RuweWaarneming {
  listing_id: number;
  datum?: string;
  prijs?: number | null;
  normale_prijs?: number | null;
  actie_label?: string | null;
  bron_ok?: boolean;
  foutmelding?: string | null;
}

export async function getListing(env: Env, id: number): Promise<ListingMetEenheid | null> {
  return env.DB.prepare(
    `SELECT l.*, c.eenheid FROM listing l JOIN category c ON c.id = l.category_id WHERE l.id = ?`,
  )
    .bind(id)
    .first<ListingMetEenheid>();
}

/**
 * Sla een waarneming op (upsert op listing+datum) na normalisatie.
 * Een mislukte waarneming overschrijft nooit een geslaagde van dezelfde dag.
 */
export async function bewaarWaarneming(env: Env, w: RuweWaarneming, bron: string) {
  const listing = await getListing(env, w.listing_id);
  if (!listing) throw new HttpError(404, `listing ${w.listing_id} bestaat niet`);
  const datum = w.datum ?? nlNu().datum;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(datum)) throw new HttpError(400, 'datum moet YYYY-MM-DD zijn');

  const n =
    w.bron_ok === false
      ? null
      : normalize({
          prijs: w.prijs ?? null,
          normale_prijs: w.normale_prijs ?? null,
          actie_label: w.actie_label ?? null,
          stuks_per_verpakking: listing.stuks_per_verpakking,
          eenheid: listing.eenheid,
        });
  const ok = n !== null;
  const fout = ok ? null : (w.foutmelding ?? (w.bron_ok === false ? 'onbekende fout' : 'geen bruikbare prijs'));

  await env.DB.prepare(
    `INSERT INTO price_observation
       (listing_id, datum, prijs, normale_prijs, actie_label, min_aantal, effectieve_prijs_totaal,
        prijs_per_eenheid, bron_ok, bron, foutmelding)
     VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11)
     ON CONFLICT (listing_id, datum) DO UPDATE SET
       prijs = excluded.prijs, normale_prijs = excluded.normale_prijs, actie_label = excluded.actie_label,
       min_aantal = excluded.min_aantal, effectieve_prijs_totaal = excluded.effectieve_prijs_totaal,
       prijs_per_eenheid = excluded.prijs_per_eenheid, bron_ok = excluded.bron_ok, bron = excluded.bron,
       foutmelding = excluded.foutmelding, aangemaakt = datetime('now')
     WHERE excluded.bron_ok = 1 OR price_observation.bron_ok = 0`,
  )
    .bind(
      listing.id,
      datum,
      w.prijs ?? null,
      w.normale_prijs ?? null,
      w.actie_label ?? null,
      n?.min_aantal ?? null,
      n?.effectieve_prijs_totaal ?? null,
      n?.prijs_per_eenheid ?? null,
      ok ? 1 : 0,
      bron,
      fout,
    )
    .run();
  return { listing_id: listing.id, datum, bron_ok: ok, ...(n ?? {}), foutmelding: fout };
}

/** Herbereken per categorie de benchmark: laagste prijs per eenheid van de laatste 90 dagen (alleen actieve listings). */
export async function herberekenBenchmarks(env: Env) {
  const van = new Date(Date.now() - 90 * 864e5).toISOString().slice(0, 10);
  await env.DB.prepare(
    `UPDATE category SET
       benchmark_prijs = COALESCE((
         SELECT o.prijs_per_eenheid FROM price_observation o JOIN listing l ON l.id = o.listing_id
         WHERE l.category_id = category.id AND l.actief = 1 AND o.bron_ok = 1 AND o.datum >= ?1
         ORDER BY o.prijs_per_eenheid ASC LIMIT 1), benchmark_prijs),
       benchmark_listing_id = COALESCE((
         SELECT o.listing_id FROM price_observation o JOIN listing l ON l.id = o.listing_id
         WHERE l.category_id = category.id AND l.actief = 1 AND o.bron_ok = 1 AND o.datum >= ?1
         ORDER BY o.prijs_per_eenheid ASC LIMIT 1), benchmark_listing_id)`,
  )
    .bind(van)
    .run();
}

interface ObsRij {
  listing_id: number;
  category_id: number;
  winkel: string;
  merk: string;
  productnaam: string;
  url: string;
  datum: string;
  prijs: number | null;
  normale_prijs: number | null;
  actie_label: string | null;
  min_aantal: number | null;
  effectieve_prijs_totaal: number | null;
  prijs_per_eenheid: number;
}

/**
 * Samenvatting per categorie.
 * "Nu" = per listing de meest recente geslaagde waarneming van de laatste 2 dagen.
 */
export async function samenvatting(env: Env) {
  const { datum: vandaag } = nlNu();
  const gisteren = new Date(Date.parse(vandaag) - 864e5).toISOString().slice(0, 10);
  const van90 = new Date(Date.parse(vandaag) - 90 * 864e5).toISOString().slice(0, 10);

  const cats = (await env.DB.prepare(`SELECT * FROM category ORDER BY id`).all<CategoryRow>()).results;

  const nu = (
    await env.DB.prepare(
      `SELECT o.listing_id, l.category_id, l.winkel, l.merk, l.productnaam, l.url, o.datum, o.prijs,
              o.normale_prijs, o.actie_label, o.min_aantal, o.effectieve_prijs_totaal, o.prijs_per_eenheid
       FROM price_observation o JOIN listing l ON l.id = o.listing_id
       WHERE o.bron_ok = 1 AND l.actief = 1 AND o.datum >= ?1
         AND o.datum = (SELECT MAX(o2.datum) FROM price_observation o2
                        WHERE o2.listing_id = o.listing_id AND o2.bron_ok = 1)
       ORDER BY o.prijs_per_eenheid ASC`,
    )
      .bind(gisteren)
      .all<ObsRij>()
  ).results;

  const bench = (
    await env.DB.prepare(
      `SELECT l.category_id, o.listing_id, l.winkel, l.merk, l.productnaam, l.url, o.datum, o.prijs_per_eenheid
       FROM price_observation o JOIN listing l ON l.id = o.listing_id
       WHERE o.bron_ok = 1 AND l.actief = 1 AND o.datum >= ?1
       ORDER BY o.prijs_per_eenheid ASC`,
    )
      .bind(van90)
      .all<Omit<ObsRij, 'prijs' | 'normale_prijs' | 'actie_label' | 'min_aantal' | 'effectieve_prijs_totaal'>>()
  ).results;

  // listings waarvan de laatste 3 waarnemingen (3 verschillende dagen) alle drie mislukt zijn
  const falend = (
    await env.DB.prepare(
      `WITH r AS (
         SELECT o.listing_id, o.datum, o.bron_ok, o.foutmelding,
                ROW_NUMBER() OVER (PARTITION BY o.listing_id ORDER BY o.datum DESC) AS rn
         FROM price_observation o)
       SELECT l.id AS listing_id, l.category_id, l.winkel, l.merk, l.productnaam, l.url, l.scrape_methode,
              MAX(r.datum) AS laatste_datum,
              (SELECT foutmelding FROM r r2 WHERE r2.listing_id = l.id AND r2.rn = 1) AS laatste_fout
       FROM r JOIN listing l ON l.id = r.listing_id
       WHERE r.rn <= 3 AND l.actief = 1
       GROUP BY l.id
       HAVING COUNT(*) = 3 AND SUM(r.bron_ok) = 0`,
    ).all()
  ).results;

  const acties = await lopendeActies(env, vandaag);
  const r4 = (n: number | null | undefined, d = 4) => (n == null ? null : Math.round(n * 10 ** d) / 10 ** d);
  const eenheidLabel = { doekje: 'per doekje', tablet: 'per tablet', ml: 'per 100 ml', liter: 'per liter' } as const;

  return {
    gegenereerd: new Date().toISOString(),
    datum: vandaag,
    categorieen: cats.map((c) => {
      const mijn = nu.filter((o) => o.category_id === c.id);
      const best = mijn[0] ?? null;
      const picnic = mijn.find((o) => o.winkel === 'picnic') ?? null;
      const b90 = bench.find((o) => o.category_id === c.id) ?? null;
      const benchmarkPrijs = b90?.prijs_per_eenheid ?? c.benchmark_prijs;
      const gem = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null);
      const metingen90 = bench.filter((o) => o.category_id === c.id).map((o) => o.prijs_per_eenheid);
      const gemiddelde90 = gem(metingen90);
      const gemiddeldeNu = gem(mijn.map((o) => o.prijs_per_eenheid));
      const fmt = (o: ObsRij | null) =>
        o && {
          listing_id: o.listing_id,
          winkel: o.winkel,
          merk: o.merk,
          productnaam: o.productnaam,
          url: o.url,
          datum: o.datum,
          prijs_per_eenheid: r4(o.prijs_per_eenheid, 5),
          prijs: o.prijs,
          normale_prijs: o.normale_prijs,
          actie_label: o.actie_label,
          min_aantal: o.min_aantal,
          effectieve_prijs_totaal: o.effectieve_prijs_totaal,
        };
      return {
        id: c.id,
        naam: c.naam,
        eenheid: c.eenheid,
        eenheid_label: eenheidLabel[c.eenheid],
        beste_nu: fmt(best),
        picnic_nu: fmt(picnic),
        // >1 betekent duurder dan de 90-dagen-benchmark
        picnic_vs_benchmark: picnic && benchmarkPrijs ? r4(picnic.prijs_per_eenheid / benchmarkPrijs, 3) : null,
        // >1 betekent duurder dan gemiddeld (90 dagen)
        picnic_vs_gemiddelde: picnic && gemiddelde90 ? r4(picnic.prijs_per_eenheid / gemiddelde90, 3) : null,
        laagste_90d: r4(benchmarkPrijs, 5),
        gemiddelde_90d: r4(gemiddelde90, 5),
        gemiddelde_nu: r4(gemiddeldeNu, 5),
        aantal_metingen_90d: metingen90.length,
        benchmark: {
          prijs_per_eenheid: r4(benchmarkPrijs, 5),
          // ook hier, zodat bestaande HA-sensoren (attribuut 'benchmark') het meteen tonen
          gemiddelde_90d: r4(gemiddelde90, 5),
          gemiddelde_nu: r4(gemiddeldeNu, 5),
          bron: b90 ? 'laagste_90_dagen' : c.benchmark_prijs != null ? 'ingesteld' : null,
          listing_id: b90?.listing_id ?? c.benchmark_listing_id,
          winkel: b90?.winkel ?? null,
          productnaam: b90?.productnaam ?? null,
          url: b90?.url ?? null,
          datum: b90?.datum ?? null,
        },
        aantal_listings_met_prijs: mijn.length,
        // acties uit folders (Kruidvat/Action via Folderz): alleen label, geen prijs per eenheid
        folderacties: acties.filter((a) => a.category_id === c.id).map(({ category_id, ...a }) => a),
      };
    }),
    listings_3_dagen_fout: falend,
  };
}

/** Zoekwoorden -> elk woord moet voorkomen in merk/product/categorie/winkel. */
export function zoekwoorden(q: string): string[] {
  return q
    .toLowerCase()
    .replace(/[%_]/g, ' ')
    .split(/\s+/)
    .map((w) => w.trim())
    .filter((w) => w.length >= 2)
    .slice(0, 6);
}

/**
 * Zoek in gevolgde (actieve) listings. Per listing de laatste geslaagde waarneming;
 * resultaten per categorie, goedkoopste prijs per eenheid eerst (zonder prijs onderaan).
 */
export async function zoek(env: Env, q: string) {
  const woorden = zoekwoorden(q);
  if (!woorden.length) return { q, resultaten: [] };
  // Eerst alleen op merk/product/winkel; pas als dat niets oplevert ook op categorienaam
  // (anders vindt "dreft" ook alle Finish-producten via de categorie "... / Dreft ...").
  const zonder = await zoekMet(env, woorden, `lower(l.merk || ' ' || l.productnaam || ' ' || l.winkel)`);
  const resultaten = zonder.length ? zonder : await zoekMet(env, woorden, `lower(l.merk || ' ' || l.productnaam || ' ' || c.naam || ' ' || l.winkel)`);
  const vandaag = nlNu().datum;
  const acties = (await lopendeActies(env, vandaag)).filter((a) =>
    woorden.every((w) => `${a.titel} ${a.winkel} ${a.actie_label ?? ''}`.toLowerCase().includes(w)),
  );
  return { q, resultaten, folderacties: acties };
}

async function zoekMet(env: Env, woorden: string[], hooi: string) {
  const rows = (
    await env.DB.prepare(
      `SELECT l.id AS listing_id, l.winkel, l.merk, l.productnaam, l.url, l.stuks_per_verpakking,
              l.scrape_methode, c.id AS category_id, c.naam AS categorie, c.eenheid,
              o.datum, o.prijs, o.normale_prijs, o.actie_label, o.min_aantal,
              o.effectieve_prijs_totaal, o.prijs_per_eenheid,
              (SELECT ROUND(AVG(h.prijs_per_eenheid), 5) FROM price_observation h
                WHERE h.listing_id = l.id AND h.bron_ok = 1 AND h.datum >= date('now', '-90 day')) AS gem_90d,
              (SELECT MIN(h.prijs_per_eenheid) FROM price_observation h
                WHERE h.listing_id = l.id AND h.bron_ok = 1 AND h.datum >= date('now', '-90 day')) AS min_90d,
              (SELECT COUNT(*) FROM price_observation h
                WHERE h.listing_id = l.id AND h.bron_ok = 1 AND h.datum >= date('now', '-90 day')) AS n_90d
       FROM listing l JOIN category c ON c.id = l.category_id
       LEFT JOIN price_observation o ON o.listing_id = l.id AND o.bron_ok = 1
         AND o.datum = (SELECT MAX(datum) FROM price_observation WHERE listing_id = l.id AND bron_ok = 1)
       WHERE l.actief = 1 AND ${woorden.map((_, i) => `${hooi} LIKE ?${i + 1}`).join(' AND ')}
       ORDER BY c.id, o.prijs_per_eenheid IS NULL, o.prijs_per_eenheid, l.winkel
       LIMIT 100`,
    )
      .bind(...woorden.map((w) => `%${w}%`))
      .all()
  ).results;
  return rows;
}

// ---------------------------------------------------------------- folderacties
export interface FolderActieIn {
  winkel: string;
  titel: string;
  actie_label?: string | null;
  prijs?: number | null;
  prijs_was?: number | null;
  geldig_van?: string | null;
  geldig_tot?: string | null;
  url: string;
}

/** Koppel een titel aan een categorie via category.trefwoorden (heel woord, hoofdletterongevoelig). */
export function koppelCategorie(titel: string, cats: { id: number; trefwoorden: string | null }[]): number | null {
  const t = ` ${titel.toLowerCase().replace(/[^a-z0-9à-ÿ]+/g, ' ')} `;
  for (const c of cats) {
    for (const w of (c.trefwoorden ?? '').split(',').map((x) => x.trim().toLowerCase()).filter(Boolean)) {
      if (t.includes(` ${w} `)) return c.id;
    }
  }
  return null;
}

/**
 * Hoeveelheid uit een foldertitel, in de eenheid van de categorie:
 * "5 x 75 ml" -> 375 (ml), "650 ml" -> 0.65 (liter), "2 x 56 stuks" -> 112 (doekje/tablet).
 */
export function hoeveelheidUitTitel(titel: string, eenheid: Eenheid): number | null {
  const t = titel.toLowerCase().replace(',', '.');
  const m = t.match(/(?:(\d+)\s*[x×]\s*)?(\d+(?:\.\d+)?)\s*(ml|l|liter|stuks|st|tabletten|capsules|doekjes)\b/);
  if (!m) return null;
  const n = m[1] ? Number(m[1]) : 1;
  const q = Number(m[2]);
  const e = m[3];
  if (eenheid === 'ml') return e === 'ml' ? n * q : e === 'l' || e === 'liter' ? n * q * 1000 : null;
  if (eenheid === 'liter') return e === 'ml' ? (n * q) / 1000 : e === 'l' || e === 'liter' ? n * q : null;
  return ['stuks', 'st', 'tabletten', 'capsules', 'doekjes'].includes(e) ? n * q : null;
}

const datumOk = (d: unknown) => (typeof d === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(d) ? d : null);

export async function bewaarActies(env: Env, acties: FolderActieIn[]) {
  const cats = (await env.DB.prepare('SELECT id, trefwoorden, eenheid FROM category').all<{ id: number; trefwoorden: string | null; eenheid: Eenheid }>()).results;
  let gekoppeld = 0;
  for (const a of acties) {
    const cid = koppelCategorie(a.titel, cats);
    if (!cid) continue; // alleen acties voor onze categorieën bewaren
    gekoppeld++;
    // Folderprijs is de prijs voor de hele actie zoals in de titel ("5 x 75 ml 2+3 GRATIS" -> € 8,58).
    const eenheid = cats.find((c) => c.id === cid)!.eenheid;
    let q = hoeveelheidUitTitel(a.titel, eenheid);
    // Zonder "N x" in de titel geldt de folderprijs meestal voor het hele actiepakket.
    if (q && !/\d+\s*[x×]\s*\d/i.test(a.titel)) {
      const lab = (a.actie_label ?? a.titel).toLowerCase();
      const plus = lab.match(/(\d+)\s*\+\s*(\d+)/);
      const voor = lab.match(/(\d+)\s*voor/);
      if (plus) q *= Number(plus[1]) + Number(plus[2]);
      else if (voor && Number(voor[1]) > 1) q *= Number(voor[1]);
    }
    const ppe = a.prijs && q ? Math.round((a.prijs / eenhedenIn(q, eenheid)) * 1e5) / 1e5 : null;
    await env.DB.prepare(
      `INSERT INTO folder_actie (winkel, category_id, titel, actie_label, prijs, prijs_was, prijs_per_eenheid, geldig_van, geldig_tot, url)
       VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10)
       ON CONFLICT (url) DO UPDATE SET category_id = excluded.category_id, titel = excluded.titel,
         actie_label = excluded.actie_label, prijs = excluded.prijs, prijs_was = excluded.prijs_was,
         prijs_per_eenheid = excluded.prijs_per_eenheid, geldig_van = excluded.geldig_van,
         geldig_tot = excluded.geldig_tot, laatst_gezien = datetime('now')`,
    )
      .bind(a.winkel, cid, a.titel.slice(0, 200), a.actie_label ?? null, a.prijs ?? null, a.prijs_was ?? null, ppe, datumOk(a.geldig_van), datumOk(a.geldig_tot), a.url)
      .run();
  }
  return { ontvangen: acties.length, gekoppeld };
}

/** Lopende folderacties: niet verlopen en de afgelopen 14 dagen nog gezien. */
export async function lopendeActies(env: Env, vandaag: string) {
  return (
    await env.DB.prepare(
      `SELECT category_id, winkel, titel, actie_label, prijs, prijs_was, prijs_per_eenheid, geldig_van, geldig_tot, url
       FROM folder_actie
       WHERE (geldig_tot IS NULL OR geldig_tot >= ?1) AND laatst_gezien >= datetime('now', '-14 days')
       ORDER BY category_id, winkel, geldig_tot`,
    )
      .bind(vandaag)
      .all<{ category_id: number; winkel: string; titel: string; actie_label: string | null; prijs: number | null; prijs_was: number | null; prijs_per_eenheid: number | null; geldig_van: string | null; geldig_tot: string | null; url: string }>()
  ).results;
}
