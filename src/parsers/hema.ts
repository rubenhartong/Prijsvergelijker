// HEMA: 403 "Verboden toegang" vanaf Cloudflare.
// Listings staan op scrape_methode='thuis'. Zie VERKENNING.md.
import { maakGeblokkeerd } from './geblokkeerd';

export const hema = maakGeblokkeerd('hema', 'bot-bescherming');
