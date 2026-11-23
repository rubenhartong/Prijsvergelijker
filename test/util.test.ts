import { describe, expect, it } from 'vitest';
import { nlNu } from '../src/util';

describe('nlNu (cron-poort 06:00 NL-tijd)', () => {
  it('winter: 05:00 UTC = 06:00 NL', () => expect(nlNu(new Date('2026-11-24T05:00:00Z'))).toEqual({ datum: '2026-11-24', uur: 6 }));
  it('winter: 04:55 UTC = 05:55 NL (overslaan)', () => expect(nlNu(new Date('2026-11-24T04:55:00Z')).uur).toBe(5));
  it('zomer: 04:00 UTC = 06:00 NL', () => expect(nlNu(new Date('2026-07-01T04:00:00Z')).uur).toBe(6));
  it('zomer: 05:30 UTC = 07:30 NL (overslaan)', () => expect(nlNu(new Date('2026-07-01T05:30:00Z')).uur).toBe(7));
  it('datum volgt NL, niet UTC', () => expect(nlNu(new Date('2026-11-23T23:30:00Z')).datum).toBe('2026-11-24'));
});
