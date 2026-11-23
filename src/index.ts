import { ADMIN_HTML } from './admin';
import { bewaarWaarneming, herberekenBenchmarks, samenvatting, type RuweWaarneming } from './db';
import type { Env } from './env';
import { haalOp, jsonLd, ldProduct, metaPrijs, titel } from './fetcher';
import { HttpError, json, sleutelOk, WINKELS } from './util';

const EENHEDEN = ['doekje', 'tablet', 'ml', 'liter'];

async function body<T = Record<string, unknown>>(req: Request): Promise<T> {
  try {
    return (await req.json()) as T;
  } catch {
    throw new HttpError(400, 'body moet JSON zijn');
  }
}

function eis(cond: unknown, msg: string): asserts cond {
  if (!cond) throw new HttpError(400, msg);
}

async function route(req: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
  const url = new URL(req.url);
  const p = url.pathname;
  const m = req.method;

  if (m === 'GET' && (p === '/' || p === '/admin')) {
    return new Response(ADMIN_HTML, {
      headers: { 'content-type': 'text/html; charset=utf-8', 'x-frame-options': 'DENY' },
    });
  }
  if (!p.startsWith('/api/')) throw new HttpError(404, 'niet gevonden');
  if (!sleutelOk(req, env.API_KEY)) throw new HttpError(401, 'ongeldige of ontbrekende API-sleutel');

  // ---- categorieën
  if (p === '/api/categories' && m === 'GET') {
    return json((await env.DB.prepare('SELECT * FROM category ORDER BY id').all()).results);
  }
  if (p === '/api/categories' && m === 'POST') {
    const b = await body<{ naam?: string; eenheid?: string; benchmark_prijs?: number; benchmark_listing_id?: number }>(req);
    eis(typeof b.naam === 'string' && b.naam.trim(), 'naam is verplicht');
    eis(EENHEDEN.includes(b.eenheid ?? ''), `eenheid moet een van ${EENHEDEN.join(', ')} zijn`);
    const r = await env.DB.prepare(
      'INSERT INTO category (naam, eenheid, benchmark_prijs, benchmark_listing_id) VALUES (?, ?, ?, ?) RETURNING *',
    )
      .bind(b.naam.trim(), b.eenheid, b.benchmark_prijs ?? null, b.benchmark_listing_id ?? null)
      .first();
    return json(r, 201);
  }

  // ---- listings
  if (p === '/api/listings' && m === 'GET') {
    const methode = url.searchParams.get('scrape_methode');
    const winkel = url.searchParams.get('winkel');
    const alleenActief = url.searchParams.get('actief') === '1';
    const rows = await env.DB.prepare(
      `SELECT l.*, c.eenheid, c.naam AS categorie,
              o.datum AS laatste_datum, o.bron_ok AS laatste_ok, o.prijs AS laatste_prijs,
              o.actie_label AS laatste_actie, o.prijs_per_eenheid AS laatste_prijs_per_eenheid
       FROM listing l JOIN category c ON c.id = l.category_id
       LEFT JOIN price_observation o ON o.listing_id = l.id
         AND o.datum = (SELECT MAX(datum) FROM price_observation WHERE listing_id = l.id)
       WHERE (?1 IS NULL OR l.scrape_methode = ?1) AND (?2 IS NULL OR l.winkel = ?2) AND (?3 = 0 OR l.actief = 1)
       ORDER BY l.category_id, l.winkel, l.id`,
    )
      .bind(methode, winkel, alleenActief ? 1 : 0)
      .all();
    return json(rows.results);
  }
  if (p === '/api/listings' && m === 'POST') {
    const b = await body<Record<string, unknown>>(req);
    eis(Number.isInteger(b.category_id), 'category_id is verplicht');
    eis(WINKELS.includes(b.winkel as never), `winkel moet een van ${WINKELS.join(', ')} zijn`);
    eis(typeof b.merk === 'string' && b.merk, 'merk is verplicht');
    eis(typeof b.productnaam === 'string' && b.productnaam, 'productnaam is verplicht');
    eis(typeof b.url === 'string' && /^https:\/\//.test(b.url), 'url moet met https:// beginnen');
    eis(typeof b.stuks_per_verpakking === 'number' && b.stuks_per_verpakking > 0, 'stuks_per_verpakking > 0');
    const methode = b.scrape_methode ?? 'cloud';
    eis(methode === 'cloud' || methode === 'thuis', 'scrape_methode is cloud of thuis');
    const r = await env.DB.prepare(
      `INSERT INTO listing (category_id, winkel, merk, productnaam, url, stuks_per_verpakking, scrape_methode, actief)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?) RETURNING *`,
    )
      .bind(b.category_id, b.winkel, b.merk, b.productnaam, b.url, b.stuks_per_verpakking, methode, b.actief === 0 ? 0 : 1)
      .first();
    return json(r, 201);
  }
  let mm: RegExpMatchArray | null;
  if ((mm = p.match(/^\/api\/listings\/(\d+)$/)) && m === 'PATCH') {
    const b = await body<Record<string, unknown>>(req);
    const velden = ['merk', 'productnaam', 'url', 'stuks_per_verpakking', 'scrape_methode', 'actief', 'winkel', 'category_id'];
    const sets = velden.filter((v) => v in b);
    eis(sets.length, 'niets om te wijzigen');
    const r = await env.DB.prepare(`UPDATE listing SET ${sets.map((s) => `${s} = ?`).join(', ')} WHERE id = ? RETURNING *`)
      .bind(...sets.map((s) => b[s] as string | number), Number(mm[1]))
      .first();
    if (!r) throw new HttpError(404, 'listing niet gevonden');
    return json(r);
  }

  // ---- waarnemingen (handmatig of thuis-scraper)
  if (p === '/api/observations' && m === 'POST') {
    const b = await body<{ bron?: string; observations?: RuweWaarneming[] } & RuweWaarneming>(req);
    const lijst = Array.isArray(b.observations) ? b.observations : [b];
    const bron = b.bron ?? 'thuis';
    eis(['thuis', 'handmatig', 'cloud'].includes(bron), 'bron is thuis, handmatig of cloud');
    eis(lijst.length > 0 && lijst.length <= 200, '1–200 waarnemingen per verzoek');
    const res = [];
    for (const w of lijst) {
      eis(Number.isInteger(w.listing_id), 'listing_id is verplicht');
      res.push(await bewaarWaarneming(env, w, bron));
    }
    const ok = res.filter((r) => r.bron_ok).length;
    await env.DB.prepare('INSERT INTO scrape_run (bron, aantal_ok, aantal_fout, foutmelding) VALUES (?, ?, ?, ?)')
      .bind(bron, ok, res.length - ok, res.filter((r) => !r.bron_ok).map((r) => `#${r.listing_id}: ${r.foutmelding}`).join('\n') || null)
      .run();
    ctx.waitUntil(herberekenBenchmarks(env));
    return json({ opgeslagen: res }, 201);
  }
  if (p === '/api/observations' && m === 'GET') {
    const lid = url.searchParams.get('listing_id');
    const rows = await env.DB.prepare(
      `SELECT * FROM price_observation WHERE (?1 IS NULL OR listing_id = ?1) ORDER BY datum DESC, listing_id LIMIT 500`,
    )
      .bind(lid ? Number(lid) : null)
      .all();
    return json(rows.results);
  }

  if (p === '/api/runs' && m === 'GET') {
    return json((await env.DB.prepare('SELECT * FROM scrape_run ORDER BY id DESC LIMIT 50').all()).results);
  }

  // ---- verkenning (stap 2): haal één pagina op vanuit de Worker en vat samen
  if (p === '/api/probe' && m === 'POST') {
    const b = await body<{ url?: string; method?: string; headers?: Record<string, string>; body?: string; raw?: number; zoek?: string }>(req);
    eis(typeof b.url === 'string' && /^https:\/\//.test(b.url), 'url (https) is verplicht');
    try {
      const r = await haalOp(b.url, { method: b.method ?? 'GET', headers: b.headers, body: b.body });
      const ld = jsonLd(r.text);
      const treffers: string[] = [];
      if (b.zoek) {
        let i = -1;
        while ((i = r.text.indexOf(b.zoek, i + 1)) >= 0 && treffers.length < 10) treffers.push(r.text.slice(Math.max(0, i - 200), i + 300));
      }
      return json({
        status: r.status,
        url: r.url,
        content_type: r.contentType,
        bytes: r.text.length,
        ms: r.ms,
        titel: titel(r.text),
        jsonld_blokken: ld.length,
        jsonld_types: ld.map((x) => (Array.isArray(x) ? 'array' : (x as Record<string, unknown>)['@type'] ?? 'graph')),
        jsonld_product: ldProduct(r.text),
        meta_prijs: metaPrijs(r.text),
        next_data: r.text.includes('__NEXT_DATA__'),
        nuxt: r.text.includes('__NUXT__'),
        treffers,
        begin: b.raw ? r.text.slice(0, Math.min(b.raw, 3000000)) : r.text.slice(0, 300),
      });
    } catch (e) {
      return json({ fout: e instanceof Error ? e.message : String(e) }, 502);
    }
  }

  if (p === '/api/summary' && m === 'GET') {
    return json(await samenvatting(env));
  }

  throw new HttpError(404, 'niet gevonden');
}

export default {
  async fetch(req, env, ctx): Promise<Response> {
    try {
      return await route(req, env, ctx);
    } catch (e) {
      if (e instanceof HttpError) return json({ fout: e.message }, e.status);
      const msg = e instanceof Error ? e.message : String(e);
      if (/UNIQUE constraint/.test(msg)) return json({ fout: 'bestaat al (unieke waarde)' }, 409);
      console.error(e);
      return json({ fout: 'interne fout', detail: msg }, 500);
    }
  },
} satisfies ExportedHandler<Env>;
