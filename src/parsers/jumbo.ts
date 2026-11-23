// Jumbo: productpagina is server-side gerenderd (Nuxt). De prijs staat in JSON-LD,
// maar acties alleen in de Nuxt-payload (<script id="__NUXT_DATA__">, devalue-formaat):
// product { id, price: { price, promoPrice }, promotions: [{ tags: [{ text }] }] } (bedragen in centen).
import type { PageResult } from '../fetcher';
import { parseJsonLd } from './jsonld';
import { ParseFout, type Geparsed, type Parser } from './types';

type Nuxt = unknown[];
const WRAPPERS = new Set(['Reactive', 'ShallowReactive', 'Ref', 'ShallowRef', 'EmptyRef']);

function los(a: Nuxt, i: unknown, diepte = 0): unknown {
  if (typeof i !== 'number' || diepte > 8) return undefined;
  const v = a[i];
  if (Array.isArray(v)) {
    if (typeof v[0] === 'string' && WRAPPERS.has(v[0])) return los(a, v[1], diepte + 1);
    return v.map((x) => los(a, x, diepte + 1));
  }
  if (v && typeof v === 'object') {
    const o: Record<string, unknown> = {};
    for (const [k, x] of Object.entries(v)) o[k] = los(a, x, diepte + 1);
    return o;
  }
  return v;
}

export function skuUitUrl(url: string): string | null {
  if (!/^https?:/.test(url)) return null;
  const m = new URL(url).pathname.match(/-([0-9]+[A-Z]+)\/?$/);
  return m ? m[1] : null;
}

export function parseJumbo(page: PageResult, url = page.url): Geparsed {
  const m = page.text.match(/<script[^>]*id="__NUXT_DATA__"[^>]*>([\s\S]*?)<\/script>/);
  if (page.status === 403) throw new ParseFout('jumbo: HTTP 403 (rate-limit/Akamai)');
  if (page.status === 404) throw new ParseFout('jumbo: pagina niet gevonden');
  if (page.text.includes('__MISSING_PRODUCT__')) throw new ParseFout('jumbo: product niet meer in assortiment');
  if (/schema\.org\/(Discontinued|OutOfStock|SoldOut)/.test(page.text.slice(0, 200000)) && !/schema\.org\/InStock/.test(page.text.slice(0, 200000)))
    throw new ParseFout('jumbo: niet leverbaar (JSON-LD availability)');
  // na een redirect hoort de pagina bij de SKU van de uiteindelijke URL
  const sku = skuUitUrl(page.url) ?? skuUitUrl(url);
  if (m && sku) {
    const a = JSON.parse(m[1]) as Nuxt;
    const skuIdx = a.indexOf(sku);
    for (let i = 0; i < a.length && skuIdx >= 0; i++) {
      const v = a[i] as Record<string, unknown> | null;
      if (!v || typeof v !== 'object' || Array.isArray(v) || v.id !== skuIdx || !('price' in v)) continue;
      const price = los(a, v.price) as { price?: number; promoPrice?: number | null } | undefined;
      const promos = (los(a, v.promotions) as { tags?: { text?: string }[] }[] | undefined) ?? [];
      const label = promos.flatMap((p) => p?.tags ?? []).map((t) => t?.text).filter(Boolean).join(' | ') || null;
      if (!price?.price) break;
      const normaal = price.price / 100;
      const promo = price.promoPrice ? price.promoPrice / 100 : null;
      return { prijs: promo ?? normaal, normale_prijs: promo ? normaal : null, actie_label: label };
    }
  }
  // terugval: JSON-LD (zonder actie)
  const ld = parseJsonLd(page);
  if (!ld.prijs) throw new ParseFout('geen prijs');
  return ld;
}

export const jumbo: Parser = { winkel: 'jumbo', parse: (p) => parseJumbo(p) };
