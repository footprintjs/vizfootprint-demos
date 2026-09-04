/**
 * THE FRONT DOOR — the landing page's rule (`web/src/front.ts`) and the door
 * that feeds it (`GET /api/summary`).
 *
 * One law, held in all three states the page can be in: **the way in exists
 * only when the server has answered with every figure the page prints.** The
 * demo's subject is a dashboard that says what it knows and what it could not
 * honour, so the page in front of it must not be the one that quotes a number
 * from memory or offers a door into an empty room.
 *
 * `frontDoor` is a pure function for exactly this reason — the rule lives
 * outside the render, where it can be tested (the same reason `derive.ts`
 * exists).
 */
import { describe, expect, it } from 'vitest';
import { API_ORIGIN, SUMMARY_DOOR, frontDoor, readableInstant } from '../web/src/front.js';
import { summaryOf } from '../server/doors.js';
import type { Desk } from '../server/doors.js';
import { DASHBOARD_WORDS, NNDSS_VIEWS } from '../src/nndss/def.js';
import { ABSENCE_FIELD, ABSENCE_STATES } from '../src/nndss/absence.js';

/** A whole answer from the door, with any part of it overridden. */
const answer = (over: Record<string, unknown> = {}): Record<string, unknown> => ({
  rows: 90_300,
  diseases: 12,
  weeks: 86,
  jurisdictions: 70,
  views: 9,
  absence: { field: 'report_state', states: ['present', 'withheld'] },
  words: { title: 'NNDSS weekly desk', caption: 'every silence kept as a silence' },
  mode: 'mock',
  snapshot: { retrievedAt: '2026-09-04T03:17:12.429Z', rows: 90_300 },
  ...over,
});

describe('still reading — there is nothing to open yet', () => {
  it('offers NO way in, and says what it is waiting for', () => {
    const door = frontDoor({ status: 'reading' });
    expect(door.state).toBe('reading');
    expect(door.enter).toBeNull(); // the whole law in one assertion: no door before the answer
    expect(door.state === 'reading' && door.waitingFor).toContain(SUMMARY_DOOR);
  });
});

describe('ready — the figures are the payload, never constants', () => {
  it('reads every number off the wire, and moves when the wire moves', () => {
    const first = frontDoor({ status: 'answered', body: answer() });
    expect(first.state).toBe('ready');
    if (first.state !== 'ready') throw new Error('unreachable');
    expect(first.figures.map((f) => [f.from, f.value])).toEqual([
      ['rows', 90_300],
      ['diseases', 12],
      ['weeks', 86],
      ['jurisdictions', 70],
      ['views', 9],
    ]);
    expect(first.figures.map((f) => f.shown)).toContain('90,300');

    // a DIFFERENT snapshot: every figure follows it. Nothing on the page survived the change.
    const second = frontDoor({ status: 'answered', body: answer({ rows: 7, diseases: 1, weeks: 2, jurisdictions: 3, views: 4 }) });
    if (second.state !== 'ready') throw new Error('unreachable');
    expect(second.figures.map((f) => f.value)).toEqual([7, 1, 2, 3, 4]);
    expect(second.figures.map((f) => f.shown)).toEqual(['7', '1', '2', '3', '4']);
  });

  it('borrows the dashboard\'s own declared words rather than writing a headline', () => {
    const door = frontDoor({ status: 'answered', body: answer({ words: { title: 'A desk by another name', caption: 'and its own summary' } }) });
    if (door.state !== 'ready') throw new Error('unreachable');
    expect(door.title).toBe('A desk by another name');
    expect(door.caption).toBe('and its own summary');
    expect(door.vocabulary).toEqual(['present', 'withheld']);
    expect(door.analyst).toContain('scripted'); // mode: mock, said in words
    expect(door.snapshotRead).toBe('2026-09-04 03:17 UTC'); // the instant the source layer vouched for, read as a person reads it
  });

  it('follows the snapshot\'s own read time, and never invents one', () => {
    const other = frontDoor({ status: 'answered', body: answer({ snapshot: { retrievedAt: '2025-01-04T00:00:00.000Z' } }) });
    expect(other.state === 'ready' && other.snapshotRead).toBe('2025-01-04 00:00 UTC');
    const none = frontDoor({ status: 'answered', body: answer({ snapshot: null }) });
    expect(none.state === 'ready' && none.snapshotRead).toBeNull();
    expect(readableInstant('not an instant')).toBe('not an instant'); // handed back, never turned into a plausible date
  });

  it('opens the door — the ONE state that may', () => {
    const door = frontDoor({ status: 'answered', body: answer() });
    expect(door.enter).not.toBeNull();
    expect(door.enter?.label).toBe('Open the dashboard');
  });
});

describe('the server is not answering — say so, and offer nothing', () => {
  it('names where the server should be, and keeps the door shut', () => {
    const door = frontDoor({ status: 'unreachable', because: 'nothing answered /api/summary — Failed to fetch' });
    expect(door.state).toBe('unreachable');
    expect(door.enter).toBeNull(); // no dead button
    if (door.state !== 'unreachable') throw new Error('unreachable');
    expect(door.because).toContain('Failed to fetch');
    expect(door.heading).toBe('The demo server is not answering.');
    expect(door.advice).toContain(API_ORIGIN); // where it should be, and how to start it
    expect(door.advice).toContain('npm run serve');
  });

  it('a server that REPLIED is not called silent — the two faults send a reader to different places', () => {
    const replied = frontDoor({ status: 'unreachable', because: '/api/summary answered 405 Method Not Allowed', answered: true });
    if (replied.state !== 'unreachable') throw new Error('unreachable');
    expect(replied.heading).toContain('answered, but not with');
    expect(replied.advice).toContain('older build');
    expect(replied.advice).not.toContain('It should be listening on'); // the server IS up; sending them to start it is the wrong errand
    expect(replied.advice).toContain('Restart it');
    expect(replied.enter).toBeNull();
  });

  it('an answer that is not a summary is treated as no answer, not as a blank page of zeroes', () => {
    for (const body of ['<!doctype html>', null, 42, ['rows']]) {
      const door = frontDoor({ status: 'answered', body });
      expect(door.state).toBe('unreachable');
      expect(door.enter).toBeNull();
    }
  });

  it('a summary that came back SHORT names what was missing and still opens nothing', () => {
    const door = frontDoor({ status: 'answered', body: answer({ weeks: undefined, words: { title: 'desk' } }) });
    expect(door.state).toBe('unreachable');
    expect(door.enter).toBeNull();
    if (door.state !== 'unreachable') throw new Error('unreachable');
    expect(door.because).toContain('a count of weeks');
    expect(door.because).toContain('its declared summary');
  });

  it('a count that is not a whole number is missing, never rounded or zeroed', () => {
    for (const rows of [null, '90300', 1.5, -1, Number.NaN]) {
      const door = frontDoor({ status: 'answered', body: answer({ rows }) });
      expect(door.state).toBe('unreachable');
      expect(door.state === 'unreachable' && door.because).toContain('a count of rows');
    }
  });
});

describe('GET /api/summary — the figures are lengths of the real tables', () => {
  /** A desk holding tables of known size — enough to prove the door COUNTS rather than reports. */
  const deskWith = (sizes: { cells: number; diseases: number; weeks: number; jurisdictions: number }): Desk =>
    ({
      mode: 'mock',
      provenance: { 'snapshot.csv': { format: 'csv', via: 'file', version: 'v1', retrievedAt: '2026-09-04T03:17:12.429Z', rows: sizes.cells } },
      surface: {
        tables: {
          cells: new Array(sizes.cells).fill({}),
          diseases: new Array(sizes.diseases).fill('a disease'),
          weeks: new Array(sizes.weeks).fill('2025-01-04'),
          jurisdictions: new Array(sizes.jurisdictions).fill({}),
        },
      },
    }) as unknown as Desk;

  it('counts what is loaded, and follows it', () => {
    expect(summaryOf(deskWith({ cells: 5, diseases: 2, weeks: 3, jurisdictions: 4 }))).toMatchObject({
      rows: 5,
      diseases: 2,
      weeks: 3,
      jurisdictions: 4,
      views: NNDSS_VIEWS.length,
      mode: 'mock',
      snapshot: { retrievedAt: '2026-09-04T03:17:12.429Z', rows: 5 },
    });
    expect(summaryOf(deskWith({ cells: 1, diseases: 1, weeks: 1, jurisdictions: 1 }))).toMatchObject({ rows: 1, diseases: 1, weeks: 1, jurisdictions: 1 });
  });

  it('hands over the declared words and the absence vocabulary, as declared', () => {
    expect(summaryOf(deskWith({ cells: 1, diseases: 1, weeks: 1, jurisdictions: 1 }))).toMatchObject({
      words: { title: DASHBOARD_WORDS.title, caption: DASHBOARD_WORDS.caption },
      absence: { field: ABSENCE_FIELD, states: ABSENCE_STATES },
    });
  });

  it('a desk with no snapshot provenance says null, never an invented time', () => {
    const desk = { mode: 'live', provenance: {}, surface: { tables: { cells: [], diseases: [], weeks: [], jurisdictions: [] } } } as unknown as Desk;
    expect(summaryOf(desk)).toMatchObject({ rows: 0, snapshot: null, mode: 'live' });
  });

  // the page and the door agree: what the door sends is what the page can open on
  it('the door\'s own answer opens the page', () => {
    const door = frontDoor({ status: 'answered', body: summaryOf(deskWith({ cells: 90_300, diseases: 12, weeks: 86, jurisdictions: 70 })) });
    expect(door.state).toBe('ready');
    expect(door.enter).not.toBeNull();
  });
});
