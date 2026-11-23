// Amazon.nl: geen JSON-LD. We lezen alleen de "buybox"-prijs:
//   <span id="apex-pricetopay-accessibility-label" ...> € 17,99 met een besparing van 7 procent </span>
// Andere prijzen op de pagina (gesponsorde producten, "Mediaan") worden genegeerd.
// De "besparing" is t.o.v. de mediaanprijs; dat is geen actie, dus geen actie_label.
import type { PageResult } from '../fetcher';
import { eurNaarGetal, ParseFout, stripTags, type Geparsed, type Parser } from './types';

export function parseAmazon(page: PageResult): Geparsed {
  const t = page.text;
  if (/captcha|Typ de tekens die u in deze afbeelding ziet/i.test(t.slice(0, 20000)) && t.length < 20000)
    throw new ParseFout('Amazon captcha');
  if (page.status === 404) throw new ParseFout('Amazon: pagina niet gevonden (ASIN?)');
  const i = t.indexOf('id="apex-pricetopay-accessibility-label"');
  if (i < 0) {
    if (t.includes('Momenteel niet verkrijgbaar')) throw new ParseFout('Amazon: momenteel niet verkrijgbaar');
    throw new ParseFout('Amazon: geen buybox-prijs (alleen via andere verkopers?)');
  }
  const end = t.indexOf('</span>', i);
  const tekst = stripTags(t.slice(t.indexOf('>', i) + 1, end));
  const prijs = eurNaarGetal(tekst.replace(/\./g, ''));
  if (!prijs) throw new ParseFout(`Amazon: prijs onleesbaar: ${tekst.slice(0, 60)}`);
  // Coupon ("Bespaar 10% met coupon") wordt bewust niet meegenomen: die vraagt een klik.
  return { prijs, normale_prijs: null, actie_label: null };
}

export const amazon: Parser = { winkel: 'amazon', parse: parseAmazon };
