import { ldProduct, metaPrijs, type PageResult } from '../fetcher';
import { ParseFout, type Geparsed } from './types';

/** Generieke parser: JSON-LD offers.price, anders meta product:price:amount. Geen actielabel. */
export function parseJsonLd(page: PageResult): Geparsed {
  const p = ldProduct(page.text);
  const prijs = p?.prijs ?? metaPrijs(page.text);
  if (!prijs) throw new ParseFout('geen prijs in JSON-LD/meta');
  return { prijs, normale_prijs: null, actie_label: null };
}
