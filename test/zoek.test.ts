import { describe, expect, it } from 'vitest';
import { zoekwoorden } from '../src/db';

describe('zoekwoorden', () => {
  it('splitst, lowercase, filtert korte woorden en LIKE-tekens', () => {
    expect(zoekwoorden('  Sensodyne  Rapid x 100% ')).toEqual(['sensodyne', 'rapid', '100']);
  });
  it('max 6 woorden', () => expect(zoekwoorden('aa bb cc dd ee ff gg hh')).toHaveLength(6));
  it('leeg', () => expect(zoekwoorden(' ')).toEqual([]));
});
