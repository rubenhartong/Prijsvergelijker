// Plus: de productpagina is een OutSystems-app zonder prijs in de HTML. De site haalt de
// data zelf op via twee anonieme "screenservices"-aanroepen; die gebruiken wij ook:
//   1. DataActionGetProductDetailsAndAgeInfo -> ProductOut.Overview.Price ("3.49")
//   2. DataActionGetPromotionOffer           -> Offer.DisplayInfo_Label ("2+3 GRATIS", "3 VOOR 9.99")
// Dat zijn 2 verzoeken per listing (plus 1 voor de moduleversie per Worker-instantie).
//
// Versies: `moduleVersion` komt uit /moduleservices/moduleversioninfo. De `apiVersion` per
// data-actie staat in de JS-bundel van de productpagina. Wijzigt die na een Plus-release,
// dan zoeken we de nieuwe versie automatisch op in de bundel (2 extra verzoeken, alleen dan).
import { BROWSER_HEADERS } from '../fetcher';
import { eurNaarGetal, ParseFout, type Geparsed, type Parser } from './types';

const BASIS = 'https://www.plus.nl';
const PAD = 'screenservices/ECP_Product_CW/ProductDetails/PDPContent/';
const BUNDEL = '/ECOP/scripts/ECP_Product_CW.ProductDetails.PDPContent.mvc.js';
// Publiek, voor alle anonieme bezoekers gelijk (staat in /scripts/OutSystems.js).
const ANONIEM_CSRF = 'T6C+9iB49TLra4jEsMeSckDMNhQ=';

type Actie = 'DataActionGetProductDetailsAndAgeInfo' | 'DataActionGetPromotionOffer';
const versies: { module?: string; api: Record<Actie, string> } = {
  api: {
    DataActionGetProductDetailsAndAgeInfo: 'TIMRoYZ6I2gwIxYu4Xk+Jg',
    DataActionGetPromotionOffer: 'pRmIEBbjlwOG2dJVuRaytA',
  },
};

export function plusSku(url: string): string | null {
  const m = new URL(url).pathname.match(/-(\d+)\/?$/);
  return m ? m[1] : null;
}

async function getJson(pad: string) {
  const r = await fetch(BASIS + pad, { headers: BROWSER_HEADERS, signal: AbortSignal.timeout(15000) });
  if (!r.ok) throw new ParseFout(`plus: HTTP ${r.status} op ${pad}`);
  return r.json();
}

async function moduleVersie(vers = false): Promise<string> {
  if (!versies.module || vers) {
    const j = (await getJson('/moduleservices/moduleversioninfo')) as { versionToken?: string };
    if (!j.versionToken) throw new ParseFout('plus: geen versionToken');
    versies.module = j.versionToken;
  }
  return versies.module;
}

/** Zoek de actuele apiVersions op in de JS-bundel (alleen na een versiewijziging). */
async function verversApiVersies() {
  const mi = (await getJson('/moduleservices/moduleinfo')) as { manifest?: { urlVersions?: Record<string, string> } };
  const v = mi.manifest?.urlVersions?.[BUNDEL];
  if (!v) throw new ParseFout('plus: PDP-bundel niet gevonden in manifest');
  const r = await fetch(BASIS + BUNDEL + v, { headers: BROWSER_HEADERS, signal: AbortSignal.timeout(15000) });
  const js = await r.text();
  for (const actie of Object.keys(versies.api) as Actie[]) {
    const m = js.match(new RegExp(`callDataAction\\("${actie}", "[^"]+", "([^"]+)"`));
    if (m) versies.api[actie] = m[1];
  }
}

export interface PlusOffer {
  IsFreeDeliveryOffer?: boolean;
  DisplayInfo_Label?: string;
  StartDate?: string;
  EndDate?: string;
  PriceOriginal_Product?: string;
  NewPrice?: string;
}

async function roep(actie: Actie, sku: string, poging = 0): Promise<Record<string, unknown>> {
  const body = JSON.stringify({
    versionInfo: { moduleVersion: await moduleVersie(poging > 0), apiVersion: versies.api[actie] },
    viewName: 'MainFlow.ProductDetailsPage',
    screenData: { variables: { SKU: sku } },
  });
  const r = await fetch(BASIS + '/' + PAD + actie, {
    method: 'POST',
    headers: { ...BROWSER_HEADERS, accept: 'application/json', 'content-type': 'application/json; charset=UTF-8', 'x-csrftoken': ANONIEM_CSRF },
    body,
    signal: AbortSignal.timeout(15000),
  });
  if (r.status === 403 || r.status === 429) throw new ParseFout(`plus: HTTP ${r.status}`);
  const j = (await r.json().catch(() => ({}))) as {
    data?: Record<string, unknown>;
    exception?: { message?: string };
    versionInfo?: { hasModuleVersionChanged?: boolean; hasApiVersionChanged?: boolean };
  };
  const gewijzigd = j.versionInfo?.hasModuleVersionChanged || j.versionInfo?.hasApiVersionChanged;
  if ((gewijzigd || j.exception) && poging === 0) {
    if (j.versionInfo?.hasApiVersionChanged || j.exception) await verversApiVersies();
    return roep(actie, sku, 1);
  }
  if (j.exception) throw new ParseFout(`plus: ${j.exception.message ?? 'fout'} (${actie})`);
  if (!j.data) throw new ParseFout(`plus: leeg antwoord (${actie})`);
  return j.data;
}

/** Pure vertaling van de twee API-antwoorden naar een waarneming (getest). */
export function plusNaarGeparsed(overview: { Price?: string } | undefined, offer: PlusOffer | undefined, vandaag: string): Geparsed {
  const prijs = eurNaarGetal(overview?.Price ?? null);
  if (!prijs) throw new ParseFout('plus: geen prijs (product niet meer leverbaar?)');
  let label: string | null = null;
  let normale: number | null = null;
  let nu = prijs;
  const actief = offer && offer.StartDate && offer.EndDate && offer.StartDate <= vandaag && vandaag <= offer.EndDate;
  // "Gratis bezorging bij €13" is geen prijsactie.
  if (actief && !offer.IsFreeDeliveryOffer) {
    label = offer.DisplayInfo_Label?.trim() || null;
    const nieuw = eurNaarGetal(offer.NewPrice ?? null);
    const orig = eurNaarGetal(offer.PriceOriginal_Product ?? null);
    if (nieuw && nieuw < prijs) {
      nu = nieuw;
      normale = orig ?? prijs;
    }
  }
  return { prijs: nu, normale_prijs: normale, actie_label: label };
}

async function haal(url: string): Promise<Geparsed> {
  const sku = plusSku(url);
  if (!sku) throw new ParseFout('plus: geen SKU in URL');
  const details = await roep('DataActionGetProductDetailsAndAgeInfo', sku);
  const overview = (details.ProductOut as { Overview?: { Price?: string } } | undefined)?.Overview;
  const promo = await roep('DataActionGetPromotionOffer', sku);
  const vandaag = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Amsterdam' }).format(new Date());
  return plusNaarGeparsed(overview, promo.Offer as PlusOffer | undefined, vandaag);
}

export const plus: Parser = {
  winkel: 'plus',
  haal,
  parse: () => {
    throw new ParseFout('plus: gebruik haal()');
  },
};
