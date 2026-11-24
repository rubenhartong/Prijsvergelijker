import { describe, expect, it } from 'vitest';
import { normalize, parseActie, parseBedrag } from '../src/normalize';

const doekjes = { stuks_per_verpakking: 56, eenheid: 'doekje' as const };

describe('parseBedrag', () => {
  it.each([
    ['€ 5,99', 5.99],
    ['5.99', 5.99],
    ['5,-', 5],
    ['€5', 5],
    ['10,5', 10.5],
  ])('%s -> %s', (s, v) => expect(parseBedrag(s)).toBe(v));
});

describe('parseActie', () => {
  it.each([
    ['1+1 gratis', 'x_plus_y_gratis', 2],
    ['2 + 1 GRATIS', 'x_plus_y_gratis', 3],
    ['3+2 gratis', 'x_plus_y_gratis', 5],
    ['2e gratis', 'x_plus_y_gratis', 2],
    ['2 voor €5', 'x_voor_y', 2],
    ['3 voor 10,00', 'x_voor_y', 3],
    ['2 voor 7 euro', 'x_voor_y', 2],
    ['2e halve prijs', 'tweede_halve_prijs', 2],
    ['2de halve prijs', 'tweede_halve_prijs', 2],
    ['2e = 50% korting', 'tweede_procent', 2],
    ['2e voor 70% korting', 'tweede_procent', 2],
    ['tweede artikel 25% korting', 'tweede_procent', 2],
    ['25% korting', 'procent', 1],
    ['-30%', 'procent', 1],
    ['nu €3,99', 'nu_prijs', 1],
    ['Nu 2.49', 'nu_prijs', 1],
    ['', 'geen', 1],
    [null, 'geen', 1],
    ['Bonus volume voordeel', 'onbekend', 1],
    ['op=op', 'onbekend', 1],
  ])('%s -> %s (min %s)', (label, type, min) => {
    const a = parseActie(label as string | null);
    expect(a.type).toBe(type);
    expect(a.min_aantal).toBe(min);
  });
});

describe('normalize', () => {
  it('zonder actie', () => {
    const r = normalize({ prijs: 2.8, ...doekjes })!;
    expect(r.min_aantal).toBe(1);
    expect(r.effectieve_prijs_totaal).toBe(2.8);
    expect(r.prijs_per_eenheid).toBeCloseTo(0.05, 5);
  });

  it('x+y gratis rekent met normale prijs bij minimaal aantal', () => {
    const r = normalize({ prijs: 2.8, actie_label: '1+1 gratis', ...doekjes })!;
    expect(r.min_aantal).toBe(2);
    expect(r.effectieve_prijs_totaal).toBe(2.8);
    expect(r.prijs_per_eenheid).toBeCloseTo(2.8 / 112, 5);
  });

  it('2+1 gratis', () => {
    const r = normalize({ prijs: 3, actie_label: '2+1 gratis', ...doekjes })!;
    expect(r.min_aantal).toBe(3);
    expect(r.effectieve_prijs_totaal).toBe(6);
    expect(r.prijs_per_eenheid).toBeCloseTo(6 / 168, 5);
  });

  it('x voor €y', () => {
    const r = normalize({ prijs: 3.49, actie_label: '2 voor €5', ...doekjes })!;
    expect(r.min_aantal).toBe(2);
    expect(r.effectieve_prijs_totaal).toBe(5);
    expect(r.prijs_per_eenheid).toBeCloseTo(5 / 112, 5);
  });

  it('2e halve prijs', () => {
    const r = normalize({ prijs: 4, actie_label: '2e halve prijs', ...doekjes })!;
    expect(r.min_aantal).toBe(2);
    expect(r.effectieve_prijs_totaal).toBe(6);
  });

  it('2e = z% korting', () => {
    const r = normalize({ prijs: 10, actie_label: '2e = 70% korting', stuks_per_verpakking: 40, eenheid: 'tablet' })!;
    expect(r.min_aantal).toBe(2);
    expect(r.effectieve_prijs_totaal).toBe(13);
    expect(r.prijs_per_eenheid).toBeCloseTo(13 / 80, 5);
  });

  it('z% korting op normale prijs, ook als schapprijs al afgeprijsd is', () => {
    const r = normalize({ prijs: 7.5, normale_prijs: 10, actie_label: '25% korting', stuks_per_verpakking: 40, eenheid: 'tablet' })!;
    expect(r.effectieve_prijs_totaal).toBe(7.5);
    expect(r.prijs_per_eenheid).toBeCloseTo(0.1875, 5);
  });

  it('nu €y', () => {
    const r = normalize({ prijs: 5, actie_label: 'nu €3,99', stuks_per_verpakking: 75, eenheid: 'ml' })!;
    expect(r.effectieve_prijs_totaal).toBe(3.99);
    expect(r.prijs_per_eenheid).toBeCloseTo(3.99 / 0.75, 4); // per 100 ml
  });

  it('onbekend label: prijs zonder actie', () => {
    const r = normalize({ prijs: 3, normale_prijs: 4, actie_label: 'Superdeal!!', ...doekjes })!;
    expect(r.actie_type).toBe('onbekend');
    expect(r.min_aantal).toBe(1);
    expect(r.effectieve_prijs_totaal).toBe(4);
  });

  it('geen label maar wel afgeprijsd: getoonde prijs', () => {
    const r = normalize({ prijs: 3, normale_prijs: 4, ...doekjes })!;
    expect(r.effectieve_prijs_totaal).toBe(3);
  });

  it('ml-categorie rekent per 100 ml', () => {
    const r = normalize({ prijs: 4.5, stuks_per_verpakking: 75, eenheid: 'ml' })!;
    expect(r.prijs_per_eenheid).toBeCloseTo(6, 5);
  });

  it('liter-categorie rekent per liter', () => {
    const r = normalize({ prijs: 2.9, stuks_per_verpakking: 0.58, eenheid: 'liter' })!;
    expect(r.prijs_per_eenheid).toBeCloseTo(5, 5);
  });

  it('geen prijs -> null', () => {
    expect(normalize({ prijs: null, ...doekjes })).toBeNull();
  });
});

import { wasbeurtenUitTekst } from '../src/normalize';

describe('wasbeurtenUitTekst', () => {
  it.each([
    ['Ariel vloeibaar wasmiddel 38 wasbeurten', 38],
    ['1,2 L - 24 scoops', 24],
    ['Omo capsules 40 doseringen', 40],
    ['wasverzachter 1 liter', null],
    [null, null],
  ])('%s -> %s', (t, n) => expect(wasbeurtenUitTekst(t as string | null)).toBe(n));
});

describe('ruis in labels', () => {
  it.each(['99 voor € 9.00', '1 voor 9.00', '12+12 gratis'])('%s -> onbekend', (l) => expect(parseActie(l).type).toBe('onbekend'));
});
