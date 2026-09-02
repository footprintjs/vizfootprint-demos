import { describe, expect, it } from 'vitest';
import { ABSENCE_FIELD, ABSENCE_STATES, cellOf } from '../src/nndss/absence.js';

/**
 * CDC's flags onto the vocabulary. The point of every case: a silence keeps
 * its kind, and nothing unclassifiable becomes a confident zero.
 */
describe('cellOf — a number is present; a dash is a reported zero', () => {
  it('reads a numeric column as present, whether the API sent a number or a numeric string', () => {
    expect(cellOf(12, undefined)).toEqual({ value: 12, state: 'present', flag: null });
    expect(cellOf('3.0', undefined)).toEqual({ value: 3, state: 'present', flag: null });
  });

  it('a dash is "no reported cases" — a real zero, not a silence', () => {
    expect(cellOf(undefined, '-')).toEqual({ value: 0, state: 'present', flag: '-' });
  });
});

describe('cellOf — the silences keep their kind', () => {
  it('N and NN are not-configured (not reportable there / not nationally notifiable)', () => {
    expect(cellOf(undefined, 'N').state).toBe('not-configured');
    expect(cellOf(undefined, 'NN').state).toBe('not-configured');
  });

  it('U is unavailable — the jurisdiction could not send it, or CDC could not process it', () => {
    expect(cellOf(undefined, 'U')).toEqual({ value: null, state: 'unavailable', flag: 'U' });
  });

  it('NP is withheld — CDC has the number and chose not to print it; neither of the other silences', () => {
    expect(cellOf(undefined, 'NP').state).toBe('withheld');
  });

  it('NC, an unknown flag, and an empty cell are all unknown — never a zero', () => {
    expect(cellOf(undefined, 'NC').state).toBe('unknown');
    expect(cellOf(undefined, 'ZZ').state).toBe('unknown');
    expect(cellOf(undefined, undefined)).toEqual({ value: null, state: 'unknown', flag: null });
    expect(cellOf('', '')).toEqual({ value: null, state: 'unknown', flag: null });
  });
});

describe('the vocabulary', () => {
  it('is the canonical four plus the one app word, with unknown present, on one declared column', () => {
    expect([...ABSENCE_STATES]).toEqual(['present', 'not-configured', 'unavailable', 'withheld', 'unknown']);
    expect(ABSENCE_FIELD).toBe('report_state');
  });
});
