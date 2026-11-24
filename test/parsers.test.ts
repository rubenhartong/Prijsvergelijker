import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import type { PageResult } from '../src/fetcher';
import { parseAmazon } from '../src/parsers/amazon';
import { parseJsonLd } from '../src/parsers/jsonld';
import { PARSERS } from '../src/parsers';
import { ParseFout } from '../src/parsers/types';
import { WINKELS } from '../src/util';

const fx = (naam: string, url = 'https://x/', status = 200): PageResult => ({
  status,
  url,
  contentType: 'text/html',
  text: readFileSync(new URL(`./fixtures/${naam}`, import.meta.url), 'utf8'),
  ms: 0,
});

describe('elke winkel heeft een parser-module', () => {
  it.each(WINKELS)('%s', (w) => expect(PARSERS[w]?.winkel).toBe(w));
});

describe('generieke JSON-LD-parser', () => {
  // fixture is een opgeslagen productpagina met JSON-LD (Product.offers.price)
  it('prijs uit JSON-LD', () => {
    expect(parseJsonLd(fx('jumbo-dreft-676439ZK.html'))).toEqual({ prijs: 13.99, normale_prijs: null, actie_label: null });
  });
});

describe('amazon', () => {
  it('buybox-prijs', () => {
    expect(parseAmazon(fx('amazon-huggies-B0111AIZ68.html'))).toEqual({ prijs: 17.99, normale_prijs: null, actie_label: null });
  });
  it('geen buybox -> fout, niet een gesponsorde prijs', () => {
    expect(() => parseAmazon(fx('amazon-taft-geen-buybox.html'))).toThrow(ParseFout);
  });
});

describe('geblokkeerde winkels', () => {
  it('403 geeft duidelijke fout', () => {
    const p: PageResult = { status: 403, url: 'https://www.ah.nl/', contentType: 'text/html', text: 'Access Denied', ms: 1 };
    expect(() => PARSERS.ah.parse(p)).toThrow(/thuis/);
  });
});
