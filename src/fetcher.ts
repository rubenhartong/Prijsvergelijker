// Gedeelde HTTP- en extractiehulpjes voor parsers en de verkenning (probe).

export const BROWSER_HEADERS: Record<string, string> = {
  'user-agent':
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
  accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  'accept-language': 'nl-NL,nl;q=0.9,en;q=0.6',
};

export interface PageResult {
  status: number;
  url: string;
  contentType: string;
  text: string;
  ms: number;
}

export async function haalOp(url: string, init: RequestInit = {}, timeoutMs = 20000): Promise<PageResult> {
  const t0 = Date.now();
  const r = await fetch(url, {
    redirect: 'follow',
    ...init,
    headers: { ...BROWSER_HEADERS, ...(init.headers as Record<string, string> | undefined) },
    signal: AbortSignal.timeout(timeoutMs),
  });
  const text = await r.text();
  return { status: r.status, url: r.url, contentType: r.headers.get('content-type') ?? '', text, ms: Date.now() - t0 };
}

/** Alle <script type="application/ld+json"> blokken, geparsed (ongeldige worden overgeslagen). */
export function jsonLd(html: string): unknown[] {
  const out: unknown[] = [];
  const re = /<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(html))) {
    try {
      out.push(JSON.parse(m[1].trim()));
    } catch {
      /* negeren */
    }
  }
  return out;
}

/** Vlakke lijst van alle objecten in (geneste) JSON-LD, incl. @graph. */
function alleObjecten(x: unknown, acc: Record<string, unknown>[] = []): Record<string, unknown>[] {
  if (Array.isArray(x)) x.forEach((y) => alleObjecten(y, acc));
  else if (x && typeof x === 'object') {
    const o = x as Record<string, unknown>;
    acc.push(o);
    for (const v of Object.values(o)) if (v && typeof v === 'object') alleObjecten(v, acc);
  }
  return acc;
}

export interface LdProduct {
  naam?: string;
  prijs?: number;
  valuta?: string;
  beschikbaar?: string;
}

const isType = (o: Record<string, unknown>, t: string) =>
  o['@type'] === t || (Array.isArray(o['@type']) && (o['@type'] as unknown[]).includes(t));

/** Zoek Product + offers.price in JSON-LD. */
export function ldProduct(html: string): LdProduct | null {
  for (const blok of jsonLd(html)) {
    const objs = alleObjecten(blok);
    const prod = objs.find((o) => isType(o, 'Product'));
    if (!prod) continue;
    const offersRaw = prod.offers as unknown;
    const offers = alleObjecten(offersRaw).filter((o) => isType(o, 'Offer') || isType(o, 'AggregateOffer') || 'price' in o || 'lowPrice' in o);
    for (const off of offers) {
      const p = off.price ?? off.lowPrice;
      const prijs = typeof p === 'number' ? p : typeof p === 'string' ? Number(p.replace(',', '.')) : NaN;
      if (Number.isFinite(prijs) && prijs > 0) {
        return {
          naam: typeof prod.name === 'string' ? prod.name : undefined,
          prijs,
          valuta: off.priceCurrency as string | undefined,
          beschikbaar: off.availability as string | undefined,
        };
      }
    }
    return { naam: typeof prod.name === 'string' ? prod.name : undefined };
  }
  return null;
}

export function titel(html: string): string | null {
  const m = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  return m ? m[1].replace(/\s+/g, ' ').trim().slice(0, 200) : null;
}

/** Inhoud van <script id="__NEXT_DATA__"> of vergelijkbare state-blobs. */
export function scriptJson(html: string, id: string): unknown | null {
  const re = new RegExp(`<script[^>]+id=["']${id}["'][^>]*>([\\s\\S]*?)</script>`, 'i');
  const m = html.match(re);
  if (!m) return null;
  try {
    return JSON.parse(m[1]);
  } catch {
    return null;
  }
}

/** Meta-tags zoals product:price:amount / og:price:amount / itemprop=price. */
export function metaPrijs(html: string): number | null {
  const pats = [
    /<meta[^>]+(?:property|name)=["'](?:product|og):price:amount["'][^>]+content=["']([\d.,]+)["']/i,
    /<meta[^>]+content=["']([\d.,]+)["'][^>]+(?:property|name)=["'](?:product|og):price:amount["']/i,
    /itemprop=["']price["'][^>]*content=["']([\d.,]+)["']/i,
  ];
  for (const re of pats) {
    const m = html.match(re);
    if (m) {
      const n = Number(m[1].replace(',', '.'));
      if (n > 0) return n;
    }
  }
  return null;
}
