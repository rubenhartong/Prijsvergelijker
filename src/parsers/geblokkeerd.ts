// Winkels die vanuit Cloudflare geblokkeerd worden (zie VERKENNING.md). Deze listings
// staan op scrape_methode='thuis'. Mocht een listing toch op 'cloud' staan, dan proberen
// we de generieke JSON-LD parser; een 403/challenge levert een duidelijke fout op.
import { parseJsonLd } from './jsonld';
import { ParseFout, type Parser } from './types';

export function maakGeblokkeerd(winkel: string, reden: string): Parser {
  return {
    winkel,
    parse: (page) => {
      if (page.status === 403 || page.status === 429 || page.status === 503)
        throw new ParseFout(`${winkel}: HTTP ${page.status} (${reden}) – gebruik scrape_methode 'thuis'`);
      return parseJsonLd(page);
    },
  };
}

