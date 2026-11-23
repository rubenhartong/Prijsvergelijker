import type { Env } from './env';
import { normalize, type Eenheid } from './normalize';
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
        benchmark: {
          prijs_per_eenheid: r4(benchmarkPrijs, 5),
          bron: b90 ? 'laagste_90_dagen' : c.benchmark_prijs != null ? 'ingesteld' : null,
          listing_id: b90?.listing_id ?? c.benchmark_listing_id,
          winkel: b90?.winkel ?? null,
          productnaam: b90?.productnaam ?? null,
          url: b90?.url ?? null,
          datum: b90?.datum ?? null,
        },
        aantal_listings_met_prijs: mijn.length,
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
  return { q, resultaten: zonder.length ? zonder : await zoekMet(env, woorden, `lower(l.merk || ' ' || l.productnaam || ' ' || c.naam || ' ' || l.winkel)`) };
}

async function zoekMet(env: Env, woorden: string[], hooi: string) {
  const rows = (
    await env.DB.prepare(
      `SELECT l.id AS listing_id, l.winkel, l.merk, l.productnaam, l.url, l.stuks_per_verpakking,
              l.scrape_methode, c.id AS category_id, c.naam AS categorie, c.eenheid,
              o.datum, o.prijs, o.normale_prijs, o.actie_label, o.min_aantal,
              o.effectieve_prijs_totaal, o.prijs_per_eenheid
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
