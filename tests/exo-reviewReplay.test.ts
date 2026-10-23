import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { EXO_ACT_ORDER, SCATTER_ADDRESS, SHEET_VIEW } from '../src/exo/def.js';
import { exoTables } from '../src/exo/etl.js';
import { DEFAULT_REVIEW, REVIEW_SOURCE_VERSIONS, parseReviewHash, replayReview, serializeReviewHash, type ReviewRecipe } from '../src/exo/reviewReplay.js';
import { loadExo } from '../src/exo/snapshot.js';
import { TINY_PS, TINY_PSCOMPPARS } from './exoFixture.js';

const rawHash = (value: unknown): string => `#review=${encodeURIComponent(JSON.stringify(value))}`;
const fixture = exoTables(TINY_PS, TINY_PSCOMPPARS);
const tinyReview: ReviewRecipe = { ...DEFAULT_REVIEW, planet: 'Demo-1 b', measurementIds: ['Demo-1 b#0', 'Demo-1 b#2'] };

describe('the focused evidence review URL', () => {
  it('pins both committed CSV byte streams, including the order that mints measurement ids', () => {
    const digest = (file: string): string => createHash('sha256').update(readFileSync(new URL(`../data/exo/${file}`, import.meta.url))).digest('hex');
    expect(REVIEW_SOURCE_VERSIONS.ps).toBe(digest('ps.csv'));
    expect(REVIEW_SOURCE_VERSIONS.pscomppars).toBe(digest('pscomppars.csv'));
  });

  it('round-trips only the small reading choices, preserving A/B order and parameter', () => {
    const review: ReviewRecipe = { ...tinyReview, parameter: 'mass', measurementIds: [...tinyReview.measurementIds].reverse() };
    const hash = serializeReviewHash(review);
    expect(hash.length).toBeLessThan(1000);
    expect(parseReviewHash(hash)).toEqual({ ok: true, review });
    expect(serializeReviewHash(review)).toBe(hash);
    expect(Object.keys(JSON.parse(decodeURIComponent(hash.slice('#review='.length))) as object).sort()).toEqual(['measurementIds', 'parameter', 'planet', 'sources', 'v']);
  });

  it('ignores ordinary page anchors and gives a sentence for damaged or oversized recipes', () => {
    expect(parseReviewHash('')).toEqual({ ok: true, review: null });
    expect(parseReviewHash('#sources')).toEqual({ ok: true, review: null });
    for (const hash of ['#review=', '#review=%E0%A4%A', '#review=%7B', `#review=${'x'.repeat(4096)}`]) expect(parseReviewHash(hash)).toMatchObject({ ok: false, sentence: expect.any(String) });
  });

  it.each([
    { ...tinyReview, v: 2 },
    { ...tinyReview, parameter: 'period' },
    { ...tinyReview, planet: '' },
    { ...tinyReview, planet: 'x'.repeat(121) },
    { ...tinyReview, measurementIds: ['Demo-1 b#0', 'Demo-1 b#0'] },
    { ...tinyReview, measurementIds: ['Demo-1 b#0', 'Demo-1 b#1', 'Demo-1 b#2'] },
    { ...tinyReview, measurementIds: [null] },
    { ...tinyReview, commands: [{ verb: 'analyze', source: 'https://example.com' }] },
    { ...tinyReview, sources: { ...tinyReview.sources, at: 'https://example.com' } },
    { ...tinyReview, sources: { ps: 'not-a-hash', pscomppars: tinyReview.sources.pscomppars } },
    null,
  ])('refuses an unrecognized or unbounded recipe: %j', (value) => {
    expect(parseReviewHash(rawHash(value))).toMatchObject({ ok: false, sentence: expect.any(String) });
  });

  it('fails closed when either source version changes', () => {
    for (const name of ['ps', 'pscomppars'] as const) {
      const stale = { ...tinyReview, sources: { ...tinyReview.sources, [name]: '0'.repeat(64) } };
      expect(parseReviewHash(rawHash(stale))).toMatchObject({ ok: false, sentence: expect.stringContaining('different committed archive slice') });
      expect(() => serializeReviewHash(stale)).toThrow('different committed archive slice');
    }
  });

  it('refuses sparse measurement lists before serialization can turn a hole into null', () => {
    const sparse = new Array<string>(2);
    sparse[1] = 'Demo-1 b#0';
    expect(() => serializeReviewHash({ ...tinyReview, measurementIds: sparse })).toThrow('distinct published measurement rows');
    expect(parseReviewHash(rawHash({ ...tinyReview, measurementIds: sparse }))).toMatchObject({ ok: false, sentence: expect.stringContaining('distinct published measurement rows') });
    expect(parseReviewHash(serializeReviewHash(tinyReview))).toEqual({ ok: true, review: tinyReview });
  });
});

describe('replaying the real declared work into a fresh session', () => {
  it('reruns five declared acts before selecting the planet; cached derived rows stay unfiltered', async () => {
    const tables = loadExo();
    const opened = await replayReview(tables, DEFAULT_REVIEW);
    expect(opened.ok).toBe(true);
    if (!opened.ok) throw new Error(opened.sentence);
    const { surface } = opened;
    const records = surface.session.log.records;
    expect(records.map((record) => record.viewId)).toEqual([...EXO_ACT_ORDER.map((act) => `analysis:${act.id}`), SCATTER_ADDRESS]);
    expect(surface.actRefusals).toEqual([]);
    expect(surface.derived.refused).toBeNull();
    expect(surface.derived.rows.length).toBeGreaterThan(1000);
    expect(surface.derived.rows.some((row) => row['pl_name'] !== DEFAULT_REVIEW.planet)).toBe(true);
    expect(surface.session.clausesFor(SHEET_VIEW)).toMatchObject([{ from: SCATTER_ADDRESS, clause: { kind: 'point', field: 'pl_name', value: DEFAULT_REVIEW.planet } }]);
    const window = await surface.session.viewQuery({ table: 'measurements', viewId: SHEET_VIEW, limit: 100 });
    expect(window.ok).toBe(true);
    if (!window.ok) throw new Error(window.rejected);
    expect(window.rows).toHaveLength(tables.measurements.filter((row) => row.pl_name === DEFAULT_REVIEW.planet).length);
    expect(window.rows.every((row) => row['pl_name'] === DEFAULT_REVIEW.planet)).toBe(true);
    expect(window.rows.filter((row) => DEFAULT_REVIEW.measurementIds.includes(String(row['measurement_id']))).map((row) => row['ref'])).toEqual(['O_DONOVAN_ET_AL__2006', 'HOLMAN_ET_AL__2007']);
  });

  it('reopening a review makes a new six-commit session instead of merging history', async () => {
    const first = await replayReview(fixture, tinyReview);
    const second = await replayReview(fixture, { ...tinyReview, parameter: 'mass' });
    expect(first.ok && second.ok).toBe(true);
    if (!first.ok || !second.ok) throw new Error('fixture replay failed');
    expect(first.surface.session).not.toBe(second.surface.session);
    expect(first.surface.session.log.records).toHaveLength(6);
    expect(second.surface.session.log.records).toHaveLength(6);
    expect(second.review.parameter).toBe('mass');
    expect(second.surface.session.log.records.at(-1)?.cause?.intent).toContain('mass evidence review');
  });

  it('refuses nonexistent planets, foreign row ids, and stale source pins before any session is returned', async () => {
    expect(await replayReview(fixture, { ...tinyReview, planet: 'No such planet' })).toMatchObject({ ok: false, sentence: expect.stringContaining('no planet named') });
    expect(await replayReview(fixture, { ...tinyReview, measurementIds: ['Demo-2 b#0'] })).toMatchObject({ ok: false, sentence: expect.stringContaining('absent from this planet') });
    expect(await replayReview(fixture, { ...tinyReview, sources: { ...tinyReview.sources, ps: '0'.repeat(64) } })).toMatchObject({ ok: false, sentence: expect.stringContaining('different committed archive slice') });
  });

  it('keeps a selected bound or missing parameter as evidence instead of fabricating a measurement', async () => {
    const replayed = await replayReview(fixture, { ...tinyReview, parameter: 'mass', measurementIds: ['Demo-1 b#1'] });
    expect(replayed.ok).toBe(true);
    if (!replayed.ok) throw new Error(replayed.sentence);
    const row = fixture.measurements.find((measurement) => measurement.measurement_id === replayed.review.measurementIds[0]);
    expect(row).toMatchObject({ mass_state: 'not-measured', pl_bmasse: null, radius_state: 'limit' });
  });
});
