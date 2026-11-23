// AH: www.ah.nl geeft 403 (Akamai) vanaf Cloudflare.
// Listings staan op scrape_methode='thuis'. Zie VERKENNING.md.
import { maakGeblokkeerd } from './geblokkeerd';

export const ah = maakGeblokkeerd('ah', 'Akamai');
