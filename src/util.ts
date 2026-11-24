// Jumbo is bewust verwijderd (2026-11-24). Niet: Dirk, Trekpleister, DA.
export const WINKELS = ['picnic', 'ah', 'plus', 'kruidvat', 'etos', 'action', 'hema', 'bol', 'amazon'] as const;
export type Winkel = (typeof WINKELS)[number];

/** Datum (YYYY-MM-DD) en uur in Europe/Amsterdam. */
export function nlNu(d = new Date()): { datum: string; uur: number } {
  const p = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Europe/Amsterdam',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(d);
  const g = (t: string) => p.find((x) => x.type === t)!.value;
  return { datum: `${g('year')}-${g('month')}-${g('day')}`, uur: Number(g('hour')) };
}

export function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data, null, 2), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8' },
  });
}

export class HttpError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

/** Constante-tijd vergelijking van de API-sleutel. */
export function sleutelOk(req: Request, key: string | undefined): boolean {
  if (!key) return false;
  const h = req.headers.get('authorization') ?? '';
  const given = h.startsWith('Bearer ') ? h.slice(7) : req.headers.get('x-api-key') ?? '';
  if (given.length !== key.length) return false;
  let diff = 0;
  for (let i = 0; i < key.length; i++) diff |= given.charCodeAt(i) ^ key.charCodeAt(i);
  return diff === 0;
}
