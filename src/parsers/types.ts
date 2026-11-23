import type { PageResult } from '../fetcher';

/** Wat een parser uit een productpagina haalt. */
export interface Geparsed {
  prijs: number | null;
  normale_prijs?: number | null;
  actie_label?: string | null;
}

export interface Parser {
  winkel: string;
  /** Optioneel: andere URL ophalen dan de listing-URL (bv. een JSON-endpoint). */
  bronUrl?: (url: string) => string;
  extraHeaders?: Record<string, string>;
  parse: (page: PageResult) => Geparsed;
}

export class ParseFout extends Error {}

export function eurNaarGetal(s: string | number | null | undefined): number | null {
  if (s == null) return null;
  if (typeof s === 'number') return Number.isFinite(s) && s > 0 ? s : null;
  const m = s.replace(/\s/g, '').match(/(\d+)(?:[.,](\d{1,2}))?/);
  if (!m) return null;
  const n = Number(m[1]) + (m[2] ? Number(m[2].padEnd(2, '0')) / 100 : 0);
  return n > 0 ? Math.round(n * 100) / 100 : null;
}

export function stripTags(s: string): string {
  return s.replace(/<[^>]+>/g, ' ').replace(/&nbsp;|&#160;/g, ' ').replace(/&euro;/g, '€').replace(/&amp;/g, '&').replace(/\s+/g, ' ').trim();
}
