// Etos: 403 vanaf Cloudflare.
// Listings staan op scrape_methode='thuis'. Zie VERKENNING.md.
import { maakGeblokkeerd } from './geblokkeerd';

export const etos = maakGeblokkeerd('etos', 'bot-bescherming');
