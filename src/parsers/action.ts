// Action: 403 "Just a moment..." (Cloudflare-challenge).
// Listings staan op scrape_methode='thuis'. Zie VERKENNING.md.
import { maakGeblokkeerd } from './geblokkeerd';

export const action = maakGeblokkeerd('action', 'Cloudflare challenge');
