import { ADMIN_HTML } from './admin';
import { bewaarActies, bewaarKandidaten, bewaarWaarneming, herbereken, huishouden, herberekenBenchmarks, lopendeActies, samenvatting, zoek, type FolderActieIn, type KandidaatIn, type RuweWaarneming } from './db';
import { EENHEDEN } from './normalize';
import type { Env } from './env';
import { cron, scrapeBatch } from './scrape';
import { haalOp, jsonLd, ldProduct, metaPrijs, titel } from './fetcher';
import { HttpError, json, nlNu, sleutelOk, WINKELS } from './util';


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
    const b = await body<{ naam?: string; eenheid?: string; groep?: string; benchmark_prijs?: number; trefwoorden?: string; zoektermen?: string; omschrijving?: string }>(req);
    eis(typeof b.naam === 'string' && b.naam.trim(), 'naam is verplicht');
    eis(EENHEDEN.includes((b.eenheid ?? '') as never), `eenheid moet een van ${EENHEDEN.join(', ')} zijn`);
    eis(['drogisterij', 'huishouden'].includes(b.groep ?? 'drogisterij'), 'groep is drogisterij of huishouden');
    const r = await env.DB.prepare(
      'INSERT INTO category (naam, eenheid, groep, benchmark_prijs, trefwoorden, zoektermen, omschrijving) VALUES (?, ?, ?, ?, ?, ?, ?) RETURNING *',
    )
      .bind(b.naam.trim(), b.eenheid, b.groep ?? 'drogisterij', b.benchmark_prijs ?? null, b.trefwoorden ?? null, b.zoektermen ?? null, b.omschrijving ?? null)
      .first();
    return json(r, 201);
  }
  let cm: RegExpMatchArray | null;
  if ((cm = p.match(/^\/api\/categories\/(\d+)$/)) && m === 'PATCH') {
    const b = await body<Record<string, unknown>>(req);
    const velden = ['naam', 'eenheid', 'groep', 'trefwoorden', 'zoektermen', 'omschrijving'].filter((v) => v in b);
    eis(velden.length, 'niets om te wijzigen');
    if ('eenheid' in b) eis(EENHEDEN.includes(b.eenheid as never), 'ongeldige eenheid');
    const r = await env.DB.prepare(`UPDATE category SET ${velden.map((v) => `${v} = ?`).join(', ')} WHERE id = ? RETURNING *`)
      .bind(...velden.map((v) => b[v] as string), Number(cm[1]))
      .first();
    if (!r) throw new HttpError(404, 'categorie niet gevonden');
    return json(r);
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

  // ---- prijs voor één listing (handmatig, of thuis-scraper per listing)
  if ((mm = p.match(/^\/api\/listings\/(\d+)\/prijs$/)) && m === 'POST') {
    const b = await body<RuweWaarneming & { bron?: string }>(req);
    eis(typeof b.prijs === 'number' && b.prijs > 0, 'prijs (> 0) is verplicht');
    const bron = b.bron ?? 'handmatig';
    eis(['thuis', 'handmatig'].includes(bron), 'bron is thuis of handmatig');
    const r = await bewaarWaarneming(env, { ...b, listing_id: Number(mm[1]) }, bron);
    ctx.waitUntil(herberekenBenchmarks(env));
    return json(r, 201);
  }

  // ---- kandidaten: zoekresultaten van de thuis-scraper (Picnic/AH) om listings uit te kiezen
  if (p === '/api/kandidaten' && m === 'POST') {
    const b = await body<{ kandidaten?: KandidaatIn[] }>(req);
    eis(Array.isArray(b.kandidaten) && b.kandidaten.length <= 1000, 'kandidaten: lijst (max 1000)');
    return json(await bewaarKandidaten(env, b.kandidaten), 201);
  }
  if (p === '/api/kandidaten' && m === 'GET') {
    const cid = url.searchParams.get('category_id');
    return json((await env.DB.prepare('SELECT * FROM kandidaat WHERE (?1 IS NULL OR category_id = ?1) ORDER BY category_id, winkel, prijs').bind(cid ? Number(cid) : null).all()).results);
  }

  if (p === '/api/herbereken' && m === 'POST') {
    return json(await herbereken(env));
  }

  // ---- huishouden: Picnic vs. beste (incl. Action-folder) en of een Action-ronde loont
  if (p === '/api/huishouden' && m === 'GET') {
    const d = Number(url.searchParams.get('drempel') ?? env.ACTION_DREMPEL ?? 5);
    return json(await huishouden(env, Number.isFinite(d) ? d : 5));
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
    // Eén run-regel per bron per uur: de thuis-scraper stuurt elke waarneming los.
    const fouten = res.filter((r) => !r.bron_ok).map((r) => `#${r.listing_id}: ${r.foutmelding}`).join('\n') || null;
    const bestaand = await env.DB.prepare(
      `SELECT id FROM scrape_run WHERE bron = ?1 AND tijdstip >= datetime('now', '-1 hour') ORDER BY id DESC LIMIT 1`,
    )
      .bind(bron)
      .first<{ id: number }>();
    if (bestaand) {
      await env.DB.prepare(
        `UPDATE scrape_run SET aantal_ok = aantal_ok + ?2, aantal_fout = aantal_fout + ?3,
           foutmelding = CASE WHEN ?4 IS NULL THEN foutmelding WHEN foutmelding IS NULL THEN ?4 ELSE foutmelding || char(10) || ?4 END
         WHERE id = ?1`,
      )
        .bind(bestaand.id, ok, res.length - ok, fouten)
        .run();
    } else {
      await env.DB.prepare('INSERT INTO scrape_run (bron, aantal_ok, aantal_fout, foutmelding) VALUES (?, ?, ?, ?)')
        .bind(bron, ok, res.length - ok, fouten)
        .run();
    }
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

  // ---- handmatig een cloud-batch draaien (zelfde regels als de cron: 1x per listing per dag)
  if (p === '/api/scrape' && m === 'POST') {
    const b = await body<{ listing_id?: number; max?: number }>(req).catch(() => ({}) as { listing_id?: number; max?: number });
    const max = Math.min(Math.max(Number(b.max ?? 4), 1), 8);
    return json(await scrapeBatch(env, { max, listingId: b.listing_id, bron: 'cloud-handmatig' }));
  }

  if (p === '/api/summary' && m === 'GET') {
    return json(await samenvatting(env));
  }

  // ---- folderacties (thuis-scraper via Folderz)
  if (p === '/api/acties' && m === 'POST') {
    const b = await body<{ acties?: FolderActieIn[] }>(req);
    eis(Array.isArray(b.acties) && b.acties.length <= 500, 'acties: lijst (max 500)');
    for (const a of b.acties) eis(typeof a.titel === 'string' && typeof a.url === 'string' && typeof a.winkel === 'string', 'winkel, titel en url verplicht');
    return json(await bewaarActies(env, b.acties), 201);
  }
  if (p === '/api/acties' && m === 'GET') {
    return json(await lopendeActies(env, nlNu().datum));
  }

  // ---- zoeken in gevolgde artikelen: per winkel de laatste geslaagde prijs
  if (p === '/api/zoek' && m === 'GET') {
    return json(await zoek(env, url.searchParams.get('q') ?? ''));
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
  async scheduled(ctrl, env, ctx) {
    ctx.waitUntil(
      cron(env, new Date(ctrl.scheduledTime)).then(
        (r) => console.log(JSON.stringify(r)),
        (e) => console.error('cron mislukt', e),
      ),
    );
  },
} satisfies ExportedHandler<Env>;
