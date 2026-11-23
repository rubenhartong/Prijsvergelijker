import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import type { PageResult } from '../src/fetcher';
import { parseAmazon } from '../src/parsers/amazon';
import { parseJumbo, skuUitUrl } from '../src/parsers/jumbo';
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

describe('jumbo', () => {
  const url = 'https://www.jumbo.com/producten/dreft-platinum-plus-all-in-one-vaatwastabletten-anti-dofheidstechnologie-19-x-676439ZK';
  it('sku uit url', () => expect(skuUitUrl(url)).toBe('676439ZK'));
  it('prijs zonder actie', () => {
    expect(parseJumbo(fx('jumbo-dreft-676439ZK.html', url))).toEqual({ prijs: 13.99, normale_prijs: null, actie_label: null });
  });
  it('actielabel uit Nuxt-payload (ander product op dezelfde pagina)', () => {
    const r = parseJumbo(fx('jumbo-dreft-676439ZK.html'), 'https://www.jumbo.com/producten/finish-ultimate-regular-16-753142ZK');
    expect(r).toEqual({ prijs: 9.99, normale_prijs: null, actie_label: '1+1 gratis' });
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
