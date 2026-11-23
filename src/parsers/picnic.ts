// Picnic: geen publieke productpagina's (picnic.app is een WordPress-site). Prijzen alleen via de
// ingelogde app-API -> thuis-scraper. De listing-URL bevat het Picnic-product-id (s1234567).
import { ParseFout, type Parser } from './types';

export const picnic: Parser = {
  winkel: 'picnic',
  parse: () => {
    throw new ParseFout("picnic: geen publieke productpagina's; alleen via ingelogde app-API (thuis)");
  },
};
