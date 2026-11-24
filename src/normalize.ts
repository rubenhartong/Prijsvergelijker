// Normalisatie van een actie naar effectieve prijs per eenheid.
//
// Uitgangspunten
// - `prijs` is de schapprijs per verpakking zoals de winkel die toont.
// - `normale_prijs` is de prijs zonder actie (als bekend). Is die er niet, dan
//   is `prijs` ook de normale prijs.
// - Voor multi-buy acties ("1+1 gratis", "2 voor €5", "2e halve prijs", ...)
//   rekenen we met de normale prijs als basis.
// - Bij een onbekend label wordt het label ruw opgeslagen en geldt de prijs
//   zonder actie (normale_prijs ?? prijs).
// - Zonder label maar met prijs < normale_prijs geldt de getoonde prijs
//   (een stille "nu €y"-korting).

export type Eenheid = 'doekje' | 'tablet' | 'ml' | 'liter' | 'rol' | 'wasbeurt' | 'zak' | 'meter' | 'stuk';

export const EENHEDEN: Eenheid[] = ['doekje', 'tablet', 'ml', 'liter', 'rol', 'wasbeurt', 'zak', 'meter', 'stuk'];

/** Leesbare eenheid waarop de prijs per eenheid is gebaseerd. */
export const EENHEID_LABEL: Record<Eenheid, string> = {
  doekje: 'per doekje', tablet: 'per tablet', ml: 'per 100 ml', liter: 'per liter', rol: 'per rol',
  wasbeurt: 'per wasbeurt', zak: 'per zak', meter: 'per meter', stuk: 'per stuk',
};

/** Aantal decimalen om een prijs per eenheid te tonen (goedkope eenheden krijgen meer). */
export function decimalen(eenheid: Eenheid): number {
  return eenheid === 'ml' || eenheid === 'liter' ? 2 : eenheid === 'doekje' || eenheid === 'tablet' ? 4 : 3;
}

/**
 * Aantal wasbeurten uit een verpakkingstekst ("Wasmiddel 38 wasbeurten", "1,2 L - 24 scoops").
 * Geeft null als het niet te lezen is (dan geldt listing.stuks_per_verpakking).
 */
export function wasbeurtenUitTekst(tekst: string | null | undefined): number | null {
  const m = (tekst ?? '').toLowerCase().match(/(\d{1,3})\s*(?:wasbeurten|wasbeurt|was(?:sen)?|scoops|doseringen|doses)\b/);
  const n = m ? Number(m[1]) : NaN;
  return n > 0 && n < 500 ? n : null;
}

export type ActieType =
  | 'geen'
  | 'x_plus_y_gratis'
  | 'x_voor_y'
  | 'tweede_halve_prijs'
  | 'tweede_procent'
  | 'procent'
  | 'nu_prijs'
  | 'onbekend';

export interface Actie {
  type: ActieType;
  min_aantal: number;
  /** totaalprijs voor min_aantal verpakkingen gegeven basisprijs */
  totaal: (basis: number) => number;
  /** voor nu_prijs: het genoemde bedrag */
  bedrag?: number;
}

export interface NormalizeInput {
  prijs: number | null;
  normale_prijs?: number | null;
  actie_label?: string | null;
  stuks_per_verpakking: number;
  eenheid: Eenheid;
}

export interface NormalizeResult {
  actie_type: ActieType;
  min_aantal: number;
  effectieve_prijs_totaal: number;
  prijs_per_eenheid: number;
}

/** Hoeveel "eenheden" (waarop de prijs per eenheid is gebaseerd) zitten er in een hoeveelheid. */
export function eenhedenIn(hoeveelheid: number, eenheid: Eenheid): number {
  // ml rekent per 100 ml; alle andere eenheden per 1 (stuk, rol, wasbeurt, zak, meter, liter).
  return eenheid === 'ml' ? hoeveelheid / 100 : hoeveelheid;
}

/** Parse een Nederlands bedrag: "€ 5,99", "5.99", "5,-", "€5" -> 5.99 / 5 */
export function parseBedrag(s: string): number | null {
  const m = s.replace(/\s+/g, '').match(/(\d+)(?:[.,](\d{1,2}|-{1,2}))?/);
  if (!m) return null;
  const heel = Number(m[1]);
  const dec = m[2] && /^\d+$/.test(m[2]) ? Number(m[2].padEnd(2, '0')) / 100 : 0;
  return Math.round((heel + dec) * 100) / 100;
}

const BEDRAG = String.raw`(?:€|eur(?:o)?)?\s*(\d+(?:[.,](?:\d{1,2}|-{1,2}))?)\s*(?:€|eur(?:o)?)?`;

/** Herken een actielabel. Geeft `onbekend` terug als het niet te duiden is. */
export function parseActie(labelRaw: string | null | undefined): Actie {
  const label = (labelRaw ?? '')
    .toLowerCase()
    .replace(/ /g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  if (!label) return { type: 'geen', min_aantal: 1, totaal: (b) => b };

  let m: RegExpMatchArray | null;

  // "1+1 gratis", "2 + 1 gratis", "3+2"
  if ((m = label.match(/(\d+)\s*\+\s*(\d+)(?:\s*gratis)?/))) {
    const x = Number(m[1]);
    const y = Number(m[2]);
    // max 10 stuks: grotere getallen zijn ruis van de pagina (bv. "99 voor")
    if (x > 0 && y > 0 && x + y <= 10) return { type: 'x_plus_y_gratis', min_aantal: x + y, totaal: (b) => x * b };
  }

  // "2e gratis" / "tweede gratis" == 1+1
  if (/(?:^|\s)(?:2e|2de|tweede)\s*(?:artikel|stuk)?\s*gratis/.test(label)) {
    return { type: 'x_plus_y_gratis', min_aantal: 2, totaal: (b) => b };
  }

  // "2e halve prijs"
  if (/(?:2e|2de|tweede)\s*(?:artikel|stuk)?\s*(?:voor\s*de\s*)?halve\s*prijs/.test(label)) {
    return { type: 'tweede_halve_prijs', min_aantal: 2, totaal: (b) => 1.5 * b };
  }

  // "2e = 50% korting", "2e voor 70% korting", "2e artikel 25% korting"
  if ((m = label.match(/(?:2e|2de|tweede)\s*(?:artikel|stuk)?\s*(?:=|voor|aan)?\s*(\d+(?:[.,]\d+)?)\s*%\s*(?:korting)?/))) {
    const z = Number(m[1].replace(',', '.'));
    if (z > 0 && z <= 100) return { type: 'tweede_procent', min_aantal: 2, totaal: (b) => b * (2 - z / 100) };
  }

  // "2 voor €5", "3 voor 10,00", "2 voor 5 euro"
  if ((m = label.match(new RegExp(String.raw`(\d+)\s*(?:stuks\s*)?voor\s*` + BEDRAG)))) {
    const x = Number(m[1]);
    const y = parseBedrag(m[2]);
    if (x > 1 && x <= 10 && y !== null && y > 0) return { type: 'x_voor_y', min_aantal: x, totaal: () => y };
  }

  // "25% korting", "-25%"
  if ((m = label.match(/^-?\s*(\d+(?:[.,]\d+)?)\s*%(?:\s*korting)?$/)) || (m = label.match(/(\d+(?:[.,]\d+)?)\s*%\s*korting/))) {
    const z = Number(m[1].replace(',', '.'));
    if (z > 0 && z < 100) return { type: 'procent', min_aantal: 1, totaal: (b) => b * (1 - z / 100) };
  }

  // "nu €3,99", "nu 3.99", "voor €3,99"
  if ((m = label.match(new RegExp(String.raw`^(?:nu|voor|actieprijs)\s*(?:voor\s*)?` + BEDRAG + '$')))) {
    const y = parseBedrag(m[1]);
    if (y !== null && y > 0) return { type: 'nu_prijs', min_aantal: 1, totaal: () => y, bedrag: y };
  }

  return { type: 'onbekend', min_aantal: 1, totaal: (b) => b };
}

const rond = (n: number, d = 4) => Math.round(n * 10 ** d) / 10 ** d;

/**
 * Bereken effectieve prijs bij het minimale aantal voor de actie.
 * Geeft null terug als er geen bruikbare prijs is.
 */
export function normalize(input: NormalizeInput): NormalizeResult | null {
  const { prijs, stuks_per_verpakking, eenheid } = input;
  const normaal = input.normale_prijs ?? null;
  if ((prijs == null || !(prijs > 0)) && (normaal == null || !(normaal > 0))) return null;
  if (!(stuks_per_verpakking > 0)) return null;

  const actie = parseActie(input.actie_label);
  // basis voor multi-buy: de normale prijs; zonder normale prijs de schapprijs
  const basis = normaal && normaal > 0 ? normaal : (prijs as number);

  let totaal: number;
  let min = actie.min_aantal;
  switch (actie.type) {
    case 'geen':
      // zonder label: laagste van getoonde prijs en normale prijs (stille korting)
      totaal = prijs && prijs > 0 ? Math.min(prijs, basis) : basis;
      break;
    case 'onbekend':
      totaal = basis; // regel: onbekend label -> prijs zonder actie
      break;
    default:
      totaal = actie.totaal(basis);
  }
  if (!(totaal > 0)) return null;

  const eenheden = eenhedenIn(stuks_per_verpakking, eenheid) * min;
  return {
    actie_type: actie.type,
    min_aantal: min,
    effectieve_prijs_totaal: rond(totaal, 2),
    prijs_per_eenheid: rond(totaal / eenheden, 5),
  };
}
