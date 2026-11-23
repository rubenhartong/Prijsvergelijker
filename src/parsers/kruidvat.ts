// Kruidvat: 403 (Akamai) vanaf Cloudflare.
// Listings staan op scrape_methode='thuis'. Zie VERKENNING.md.
import { maakGeblokkeerd } from './geblokkeerd';

export const kruidvat = maakGeblokkeerd('kruidvat', 'Akamai');
