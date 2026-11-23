import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { normalize } from '../src/normalize';
import { plusNaarGeparsed, plusSku, type PlusOffer } from '../src/parsers/plus';

const offer = (sku: string) => JSON.parse(readFileSync(new URL(`./fixtures/plus-offer-${sku}.json`, import.meta.url), 'utf8')) as PlusOffer;
const D = '2026-11-23';

describe('plus', () => {
  it('sku uit url', () => {
    expect(plusSku('https://www.plus.nl/product/slimpie-limonadesiroop-aardbei-fles-650-ml-649828')).toBe('649828');
    expect(plusSku('https://www.plus.nl/product/dreft-platinum-plus-vaatwascapsules-citroen-zak-72-st-897566-897566')).toBe('897566');
  });
  it('geen actie (lege offer)', () => {
    expect(plusNaarGeparsed({ Price: '3.49' }, offer('649828'), D)).toEqual({ prijs: 3.49, normale_prijs: null, actie_label: null });
  });
  it('gratis bezorging is geen prijsactie', () => {
    expect(plusNaarGeparsed({ Price: '15.49' }, offer('682631'), D).actie_label).toBeNull();
  });
  it('2+3 GRATIS -> per tablet bij 5 zakken', () => {
    const g = plusNaarGeparsed({ Price: '18.99' }, offer('163552'), D);
    expect(g.actie_label).toBe('2+3 GRATIS');
    const n = normalize({ ...g, stuks_per_verpakking: 25, eenheid: 'tablet' })!;
    expect(n.min_aantal).toBe(5);
    expect(n.prijs_per_eenheid).toBeCloseTo((2 * 18.99) / 125, 5);
  });
  it('3 VOOR 9.99 -> per 100 ml bij 3 tubes', () => {
    const g = plusNaarGeparsed({ Price: '5.79' }, offer('380307'), D);
    const n = normalize({ ...g, stuks_per_verpakking: 75, eenheid: 'ml' })!;
    expect(n.min_aantal).toBe(3);
    expect(n.effectieve_prijs_totaal).toBe(9.99);
  });
  it('verlopen actie telt niet', () => {
    expect(plusNaarGeparsed({ Price: '18.99' }, offer('163552'), '2026-11-25').actie_label).toBeNull();
  });
  it('geen prijs -> fout', () => {
    expect(() => plusNaarGeparsed({ Price: '0.0' }, undefined, D)).toThrow(/geen prijs/);
  });
});
