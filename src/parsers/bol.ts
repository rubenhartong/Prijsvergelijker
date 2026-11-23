// bol: 403 vanaf Cloudflare.
// Listings staan op scrape_methode='thuis'. Zie VERKENNING.md.
import { maakGeblokkeerd } from './geblokkeerd';

export const bol = maakGeblokkeerd('bol', 'bot-bescherming');
