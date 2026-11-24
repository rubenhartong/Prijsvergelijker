import { describe, expect, it } from 'vitest';
import { zoekwoorden } from '../src/db';

describe('zoekwoorden', () => {
  it('splitst, lowercase, filtert korte woorden en LIKE-tekens', () => {
    expect(zoekwoorden('  Sensodyne  Rapid x 100% ')).toEqual(['sensodyne', 'rapid', '100']);
  });
  it('max 6 woorden', () => expect(zoekwoorden('aa bb cc dd ee ff gg hh')).toHaveLength(6));
  it('leeg', () => expect(zoekwoorden(' ')).toEqual([]));
});

import { koppelCategorie } from '../src/db';

describe('koppelCategorie', () => {
  const cats = [
    { id: 1, trefwoorden: 'huggies' },
    { id: 2, trefwoorden: 'finish,dreft' },
    { id: 3, trefwoorden: 'sensodyne,proglasur' },
  ];
  it('merk in titel', () => expect(koppelCategorie('Sensodyne mondverzorging gevoeligheid', cats)).toBe(3));
  it('tweede trefwoord', () => expect(koppelCategorie('Alle Dreft vaatwascapsules', cats)).toBe(2));
  it('heel woord', () => expect(koppelCategorie('Finishing spray', cats)).toBeNull());
  it('geen match', () => expect(koppelCategorie('Pampers luiers', cats)).toBeNull());
});

import { hoeveelheidUitTitel } from '../src/db';

describe('hoeveelheidUitTitel', () => {
  it('N x M ml', () => expect(hoeveelheidUitTitel('Sensodyne mondverzorging 5 x 75 ml 2+3 GRATIS*', 'ml')).toBe(375));
  it('ml -> liter', () => expect(hoeveelheidUitTitel('Slimpie siroop 650 ml', 'liter')).toBe(0.65));
  it('stuks', () => expect(hoeveelheidUitTitel('Huggies Pure 2 x 56 stuks', 'doekje')).toBe(112));
  it('onbekend', () => expect(hoeveelheidUitTitel('Sensodyne en Parodontax 2+2 gratis', 'ml')).toBeNull());
});

describe('hoeveelheidUitTitel (huishouden)', () => {
  it('liter uit ml', () => expect(hoeveelheidUitTitel('Allesreiniger 1,5 L', 'liter')).toBe(1.5));
  it('rollen', () => expect(hoeveelheidUitTitel('Toiletpapier 3-laags 12 rollen', 'rol')).toBe(12));
  it('meter', () => expect(hoeveelheidUitTitel('Bakpapier 30 m', 'meter')).toBe(30));
  it('wasbeurten', () => expect(hoeveelheidUitTitel('Wasmiddel kleur 38 wasbeurten', 'wasbeurt')).toBe(38));
  it('zakken', () => expect(hoeveelheidUitTitel('Afvalzakken 60 L trekband 20 stuks', 'zak')).toBe(20));
});

describe('koppelCategorie: langste trefwoord wint', () => {
  const cats = [
    { id: 2, trefwoorden: 'finish,dreft' },
    { id: 11, trefwoorden: 'afwasmiddel' },
  ];
  it('Dreft afwasmiddel -> afwasmiddel', () => expect(koppelCategorie('Dreft afwasmiddel original', cats)).toBe(11));
  it('Dreft platinum -> vaatwas', () => expect(koppelCategorie('Dreft platinum vaatwastabletten', cats)).toBe(2));
});
