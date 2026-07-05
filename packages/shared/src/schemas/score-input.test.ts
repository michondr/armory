import { describe, expect, it } from 'vitest';
import { expandScoreTokens, parseRingValues, parseZones, zonePoints } from './score-input.js';

describe('expandScoreTokens', () => {
  it('splits on whitespace and commas', () => {
    expect(expandScoreTokens('10 10 9')).toEqual(['10', '10', '9']);
    expect(expandScoreTokens('10, 9 , 9')).toEqual(['10', '9', '9']);
  });

  it('expands NxTOKEN repeats', () => {
    expect(expandScoreTokens('3x10 2x9')).toEqual(['10', '10', '10', '9', '9']);
    expect(expandScoreTokens('2xA C M')).toEqual(['A', 'A', 'C', 'M']);
    expect(expandScoreTokens('2xA 1xC 1xM')).toEqual(['A', 'A', 'C', 'M']);
  });

  it('is case-insensitive on the x', () => {
    expect(expandScoreTokens('2XA')).toEqual(['A', 'A']);
  });

  it('handles empty input', () => {
    expect(expandScoreTokens('   ')).toEqual([]);
  });
});

describe('parseRingValues', () => {
  it('parses individual numbers', () => {
    expect(parseRingValues('10 10 9 9 8')).toEqual([10, 10, 9, 9, 8]);
  });

  it('parses multiplier syntax equivalently to individual values', () => {
    expect(parseRingValues('3x10 2x9')).toEqual([10, 10, 10, 9, 9]);
    expect(parseRingValues('3x10 2x9')).toEqual(parseRingValues('10 10 10 9 9'));
  });

  it('supports decimals', () => {
    expect(parseRingValues('2x9.5')).toEqual([9.5, 9.5]);
  });

  it('ignores non-numeric tokens', () => {
    expect(parseRingValues('10 A 9')).toEqual([10, 9]);
  });
});

describe('parseZones', () => {
  it('parses individual zones (alpha/charlie/delta/miss)', () => {
    expect(parseZones('A A C M')).toEqual(['A', 'A', 'C', 'M']);
  });

  it('parses multiplier syntax', () => {
    expect(parseZones('2xA C M')).toEqual(['A', 'A', 'C', 'M']);
    expect(parseZones('2xA 1xC 1xM')).toEqual(['A', 'A', 'C', 'M']);
  });

  it('uppercases and ignores numeric tokens', () => {
    expect(parseZones('a c 10')).toEqual(['A', 'C']);
  });
});

describe('zonePoints', () => {
  it('maps IPSC zones (miss = -10)', () => {
    expect(zonePoints('A')).toBe(5);
    expect(zonePoints('C')).toBe(3);
    expect(zonePoints('D')).toBe(1);
    expect(zonePoints('M')).toBe(-10);
  });

  it('is case-insensitive and defaults unknown zones to 0', () => {
    expect(zonePoints('a')).toBe(5);
    expect(zonePoints('Z')).toBe(0);
  });
});
