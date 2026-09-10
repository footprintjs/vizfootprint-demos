/**
 * THE EXOPLANET ETL — three tables out of the archive's two, and not one
 * derived number among them.
 *
 * These pin what Layer 1 promises: that the archive's limit flags become the
 * four absence words and nothing else; that a `limit` KEEPS its number; that a
 * reference is keyed by the archive's own key and not by the HTML anchor it
 * ships inside (the anchor is not unique, and the fixture spells one reference
 * two ways on purpose); that the composite's provenance is read per parameter,
 * so a number the archive calculated is never reported as a publication's; and
 * that the ids the ETL mints are a function of the committed row order.
 *
 * The last suite reads the REAL committed slice and holds it to
 * `data/exo/PROVENANCE.json` — the file `npm run exo:generate` wrote from this
 * same ETL. That is the guard that matters: the numbers this repository prints
 * are the numbers the snapshot parses to, and a re-fetch that changed either
 * one fails here rather than on a page.
 */
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { exoTables, MEASUREMENT_ID_MARKER, yearOf } from '../src/exo/etl.js';
import { figureOf } from '../src/exo/absence.js';
import { parseReference, referenceKindOf } from '../src/exo/names.js';
import { loadExo, SLICE_PROVENANCE } from '../src/exo/snapshot.js';
import { ONE, ONE_AGAIN, TINY_PS, TINY_PSCOMPPARS } from './exoFixture.js';

const tiny = exoTables(TINY_PS, TINY_PSCOMPPARS);

describe('the limit flag becomes a word, and a bound keeps its number', () => {
  it('words all four combinations the archive can publish', () => {
    expect(figureOf(2, 0)).toEqual({ value: 2, state: 'present', bound: null });
    expect(figureOf(2.4, 1)).toEqual({ value: 2.4, state: 'limit', bound: 'upper' });
    expect(figureOf(2.4, -1)).toEqual({ value: 2.4, state: 'limit', bound: 'lower' });
    expect(figureOf(null, null)).toEqual({ value: null, state: 'not-measured', bound: null });
    // a bound with no number: the archive would be saying "this is a limit" and giving no limit
    expect(figureOf(null, 1)).toEqual({ value: null, state: 'unknown', bound: null });
  });

  it('the bounded radius is on the row, with its number and its direction', () => {
    const bounded = tiny.measurements.find((m) => m.radius_state === 'limit');
    expect(bounded).toMatchObject({ pl_rade: 2.4, radius_bound: 'upper', mass_state: 'not-measured', pl_bmasse: null });
  });

  it('counts the states over the fixture, radius and mass apart', () => {
    expect(tiny.counts.measurementRadius).toEqual({ present: 2, limit: 1, 'not-measured': 1, unknown: 0 });
    expect(tiny.counts.measurementMass).toEqual({ present: 3, limit: 0, 'not-measured': 1, unknown: 0 });
  });
});

describe('a reference is keyed by the archive\'s key, never by its anchor', () => {
  it('takes the three facts out of the anchor and invents none', () => {
    expect(parseReference(ONE)).toEqual({ refstr: 'PAPER_ONE__2001', label: 'Paper One et al. 2001', href: 'https://ui.adsabs.harvard.edu/abs/2001ApJ...001....1A/abstract' });
    // the same key, spelled a second way — the label is trimmed, and the key is the same key
    expect(parseReference(ONE_AGAIN)?.refstr).toBe('PAPER_ONE__2001');
    expect(parseReference('not an anchor')).toBeNull();
  });

  it('the archive speaking is not a publication, and the href is what says so', () => {
    expect(referenceKindOf('https://ui.adsabs.harvard.edu/abs/2001ApJ...001....1A/abstract')).toBe('publication');
    expect(referenceKindOf('/docs/pscp_calc.html')).toBe('archive');
    expect(referenceKindOf('https://exofop.ipac.caltech.edu/tess/view_toi.php')).toBe('archive');
  });

  it('folds two anchors of one reference into ONE row, and says which table cites it', () => {
    // four references, not five: the two spellings of Paper One are one reference
    expect(tiny.references.map((r) => r.ref)).toEqual(['CALCULATED_VALUE', 'PAPER_ONE__2001', 'PAPER_THREE__2010', 'PAPER_TWO__2005']);
    expect(tiny.counts.referencesWithSeveralAnchors).toBe(1);
    expect(Object.fromEntries(tiny.references.map((r) => [r.ref, r.cited_in]))).toEqual({
      // the measurements cite it AND the composite takes its mass from it
      PAPER_ONE__2001: 'both',
      PAPER_TWO__2005: 'both',
      // the composite's accepted radius for Demo-2 b cites a paper no confirmed measurement row does
      PAPER_THREE__2010: 'composite',
      CALCULATED_VALUE: 'composite',
    });
  });

  it('a year is parsed from the citing row\'s pubdate, and is null when there is no date to parse', () => {
    expect(yearOf('2001-01')).toBe(2001);
    expect(yearOf('')).toBeNull();
    const byRef = new Map(tiny.references.map((r) => [r.ref, r]));
    expect(byRef.get('PAPER_ONE__2001')).toMatchObject({ pub_year: 2001, pl_pubdate: '2001-01' });
    // the composite publishes no pubdate at all, so a reference only it points at has no year
    expect(byRef.get('PAPER_THREE__2010')).toMatchObject({ pub_year: null, pl_pubdate: null });
    // …and the typed-in gloss reaches the row it belongs to, while a publication needs none
    expect(byRef.get('CALCULATED_VALUE')?.note).toMatch(/own calculation/);
    expect(byRef.get('PAPER_ONE__2001')?.note).toBeNull();
  });
});

describe('the composite is an assembly, and every parameter says where it came from', () => {
  it('reads the reflinks per parameter — a calculated radius beside a published mass', () => {
    const [one, two] = tiny.planets;
    expect(one).toMatchObject({ pl_name: 'Demo-1 b', pl_rade: 2.1, radius_ref: 'CALCULATED_VALUE', radius_ref_kind: 'archive', pl_bmasse: 5.2, mass_ref: 'PAPER_ONE__2001', mass_ref_kind: 'publication' });
    expect(two).toMatchObject({ pl_name: 'Demo-2 b', radius_ref: 'PAPER_THREE__2010', radius_ref_kind: 'publication', mass_kind: 'Msini' });
    expect(tiny.counts.calculatedRadii).toBe(1);
    expect(tiny.counts.calculatedMasses).toBe(0);
  });

  it('the composite disagrees with every published radius of Demo-1 b, and both are kept', () => {
    const published = tiny.measurements.filter((m) => m.pl_name === 'Demo-1 b' && m.radius_state === 'present').map((m) => m.pl_rade);
    expect(published).toEqual([2, 2.2]);
    // 2.1 is the archive's own number and it is not either of them: that is the demo
    expect(tiny.planets[0]?.pl_rade).toBe(2.1);
  });
});

describe('the ids are minted from the committed row order', () => {
  it('numbers a planet\'s rows from zero, in file order', () => {
    expect(tiny.measurements.map((m) => m.measurement_id)).toEqual([`Demo-1 b${MEASUREMENT_ID_MARKER}0`, `Demo-1 b${MEASUREMENT_ID_MARKER}1`, `Demo-1 b${MEASUREMENT_ID_MARKER}2`, `Demo-2 b${MEASUREMENT_ID_MARKER}0`]);
  });

  it('counts what the archive itself never settled: a planet with no default row', () => {
    expect(tiny.counts.planetsWithoutDefault).toBe(1);
    expect(tiny.counts.planetsWithOneMeasurement).toBe(1);
    expect(tiny.counts.mostMeasurementsForOnePlanet).toBe(3);
  });

  it('keeps the raw anchor beside the key — the receipt, so nothing is taken on trust', () => {
    expect(tiny.measurements[0]?.pl_refname).toBe(ONE);
    expect(tiny.measurements[2]?.pl_refname).toBe(ONE_AGAIN);
    expect(tiny.measurements[0]?.ref).toBe(tiny.measurements[2]?.ref);
  });
});

describe('the committed slice parses to the numbers its provenance prints', () => {
  const provenance = JSON.parse(readFileSync(SLICE_PROVENANCE, 'utf8')) as { readonly tables: Record<string, number>; readonly counts: Record<string, unknown> };
  const tables = loadExo();

  it('one row per published measurement, per planet, and per reference', () => {
    expect(tables.measurements.length).toBe(20_598);
    expect(tables.planets.length).toBe(6_360);
    expect(tables.references.length).toBe(2_403);
    // …and the provenance file prints those same three numbers
    expect(provenance.tables).toEqual({ measurements: tables.measurements.length, planets: tables.planets.length, references: tables.references.length });
  });

  it('every count in the provenance is the count this ETL reports over the same bytes', () => {
    expect(provenance.counts).toEqual(JSON.parse(JSON.stringify(tables.counts)));
  });

  it('the archive wrote a quarter of the composite\'s radii and nearly half its masses itself', () => {
    expect(tables.counts.calculatedRadii).toBe(1_608);
    expect(tables.counts.calculatedMasses).toBe(2_977);
    expect(tables.counts.compositeMassKinds['M-R relationship']).toBe(2_974);
  });

  it('no row of the slice is `unknown` — the word is declared and the archive never publishes one', () => {
    expect(tables.counts.measurementRadius.unknown).toBe(0);
    expect(tables.counts.measurementMass.unknown).toBe(0);
    expect(tables.counts.compositeRadius.unknown).toBe(0);
    expect(tables.counts.compositeMass.unknown).toBe(0);
  });

  it('every planet is in both tables — the relation has no orphans in either direction', () => {
    const composite = new Set(tables.planets.map((p) => p.pl_name));
    const measured = new Set(tables.measurements.map((m) => m.pl_name));
    expect([...measured].filter((n) => !composite.has(n))).toEqual([]);
    expect([...composite].filter((n) => !measured.has(n))).toEqual([]);
  });
});
