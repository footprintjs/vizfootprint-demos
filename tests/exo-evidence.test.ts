import { describe, expect, it } from 'vitest';
import { compareEvidenceFigures, evidenceFigure, evidenceForPlanet, resolveEvidenceReference, safeReferenceHref } from '../src/exo/evidence.js';
import { exoTables, type MeasurementRow } from '../src/exo/etl.js';
import { loadExo } from '../src/exo/snapshot.js';
import { TINY_PS, TINY_PSCOMPPARS } from './exoFixture.js';

const tiny = exoTables(TINY_PS, TINY_PSCOMPPARS);
const central = tiny.measurements[0]!;
type RadiusPatch = Partial<Pick<MeasurementRow, 'pl_rade' | 'pl_radeerr1' | 'pl_radeerr2' | 'radius_state' | 'radius_bound'>>;
const measurement = (changes: RadiusPatch): MeasurementRow => ({ ...central, ...changes });

describe('source links preserve reference identity and only open web pages', () => {
  it('resolves publication and archive references through their stable keys', () => {
    const paper = resolveEvidenceReference('PAPER_ONE__2001', tiny.references);
    expect(paper).toMatchObject({ label: 'Paper One et al. 2001', kind: 'publication', href: 'https://ui.adsabs.harvard.edu/abs/2001ApJ...001....1A/abstract' });
    expect(resolveEvidenceReference('CALCULATED_VALUE', tiny.references)).toMatchObject({ kind: 'archive', href: 'https://exoplanetarchive.ipac.caltech.edu/docs/pscp_calc.html' });
    expect(resolveEvidenceReference('NOT_IN_THE_TABLE', tiny.references)).toBeNull();
  });

  it('reads reordered, quoted, multiline anchor attributes and decodes names as text', () => {
    const anchor = `<A target="ref" HREF='https://example.org/paper?a=1&amp;b=2'\n REFSTR = "PAPER_X">&Ouml;zt&uuml;rk &amp; Erdem &#x219; <em>2019</em></A>`;
    expect(resolveEvidenceReference('PAPER_X', [], anchor)).toEqual({
      ref: 'PAPER_X', label: 'Öztürk & Erdem ș 2019', href: 'https://example.org/paper?a=1&b=2', kind: 'publication', note: null,
    });
    expect(resolveEvidenceReference('OTHER_PAPER', [], anchor)).toBeNull();
    expect(resolveEvidenceReference('QUERY', [], '<a refstr=QUERY href=https://example.org/paper?id=123&view=full>Query paper</a>')?.href).toBe('https://example.org/paper?id=123&view=full');
  });

  it('keeps an unsafe reference readable without making its URL clickable', () => {
    const reference = resolveEvidenceReference('BAD', [], '<a refstr=BAD href="javascript:alert(1)">A source &amp; its label</a>');
    expect(reference).toMatchObject({ label: 'A source & its label', href: null, kind: null });
    for (const href of ['javascript:alert(1)', 'data:text/html,<h1>x</h1>', 'file:///tmp/a', 'mailto:x@example.org', '', 'not-a-url', 'https://user:password@example.org/paper']) {
      expect(safeReferenceHref(href)).toBeNull();
    }
    expect(safeReferenceHref('/docs/pscp_calc.html')).toBe('https://exoplanetarchive.ipac.caltech.edu/docs/pscp_calc.html');
    expect(safeReferenceHref('http://example.org/paper')).toBe('http://example.org/paper');
  });

  it('does not mistake a similarly named external domain for an archive host', () => {
    const reference = resolveEvidenceReference('P', [], '<a href=https://notipac.caltech.edu/paper refstr=P>Paper</a>');
    expect(reference?.kind).toBe('publication');
  });
});

describe('reported uncertainty, bounds, and missing cells remain different facts', () => {
  it('uses the signed asymmetric offsets for endpoints without assuming a sigma level', () => {
    const figure = evidenceFigure(measurement({ pl_rade: 2, pl_radeerr1: 0.3, pl_radeerr2: -0.1 }));
    expect(figure).toMatchObject({ value: 2, state: 'present', upperError: 0.3, lowerError: -0.1, lower: 1.9, upper: 2.3, uncertainty: 'reported' });
    expect(figure.uncertaintyLabel).toBe('+0.3 / −0.1 R⊕ (as reported)');
    expect(figure.uncertaintyLabel).not.toMatch(/sigma|σ|68%|confidence/i);
  });

  it('does not turn an empty uncertainty into zero, including a one-sided error', () => {
    const missing = evidenceFigure(measurement({ pl_radeerr1: null, pl_radeerr2: null }));
    expect(missing).toMatchObject({ value: 2, lower: null, upper: null, uncertainty: 'missing' });
    expect(missing.uncertaintyLabel).toContain('not reported');
    const partial = evidenceFigure(measurement({ pl_radeerr1: 0.1, pl_radeerr2: null }));
    expect(partial).toMatchObject({ upper: 2.1, lower: null, uncertainty: 'partial' });
    expect(partial.uncertaintyLabel).toContain('lower uncertainty not reported');
  });

  it('preserves an actually reported zero pair and declines unexpected signs', () => {
    expect(evidenceFigure(measurement({ pl_radeerr1: 0, pl_radeerr2: 0 }))).toMatchObject({ lower: 2, upper: 2, upperError: 0, lowerError: 0, uncertainty: 'reported' });
    expect(evidenceFigure(measurement({ pl_radeerr1: -0.1, pl_radeerr2: 0.1 }))).toMatchObject({ lower: null, upper: null, upperError: -0.1, lowerError: 0.1, uncertainty: 'invalid' });
  });

  it('shows the number and direction of a bound without a centered error bar', () => {
    const upper = evidenceFigure(measurement({ pl_rade: 2.4, radius_state: 'limit', radius_bound: 'upper' }));
    expect(upper).toMatchObject({ value: 2.4, lower: null, upper: null, uncertainty: 'not-applicable' });
    expect(upper.valueLabel).toBe('≤ 2.4 R⊕ (upper bound)');
    const lower = evidenceFigure(measurement({ pl_rade: 1.3, radius_state: 'limit', radius_bound: 'lower' }));
    expect(lower.valueLabel).toBe('≥ 1.3 R⊕ (lower bound)');
  });

  it('keeps missing and unknown source values visible and never invents a number', () => {
    const missing = evidenceFigure(measurement({ pl_rade: null, radius_state: 'not-measured', pl_radeerr1: null, pl_radeerr2: null }));
    expect(missing).toMatchObject({ value: null, lower: null, upper: null, valueLabel: 'Not reported' });
    expect(evidenceFigure(measurement({ pl_rade: null, radius_state: 'unknown' })).valueLabel).toBe('Unknown value');
  });

  it('attributes absent composite errors to the snapshot cut, not to the cited paper', () => {
    const figure = evidenceFigure(tiny.planets[0]!);
    expect(figure).toMatchObject({ value: 2.1, upperError: null, lowerError: null, uncertainty: 'not-in-snapshot' });
    expect(figure.uncertaintyLabel).toBe('Composite uncertainty is not included in this snapshot');
  });

  it('keeps mass units and source mass provenance separate from radius', () => {
    const evidence = evidenceForPlanet('Demo-2 b', tiny.measurements, tiny.planets, tiny.references, 'mass');
    expect(evidence.rows[0]?.figure).toMatchObject({ value: 300, unit: 'M⊕', state: 'present', lower: 290, upper: 310 });
    expect(evidence.rows[0]?.measurement.mass_kind).toBe('Msini');
    expect(evidence.composite?.reference?.ref).toBe('PAPER_TWO__2005');
  });
});

describe('a selected planet compares attributed intervals without claiming significance', () => {
  it('positions a composite marker against the actual asymmetric interval', () => {
    const source = evidenceFigure(measurement({ pl_rade: 2, pl_radeerr1: 0.3, pl_radeerr2: -0.1 }));
    const composite = (value: number) => evidenceFigure({ ...tiny.planets[0]!, pl_rade: value });
    expect(compareEvidenceFigures(source, composite(2.1)).position).toBe('within-reported-interval');
    expect(compareEvidenceFigures(source, composite(1.9)).position).toBe('within-reported-interval');
    expect(compareEvidenceFigures(source, composite(1.8)).position).toBe('below-reported-interval');
    expect(compareEvidenceFigures(source, composite(2.4)).position).toBe('above-reported-interval');
    expect(compareEvidenceFigures(source, composite(2.4)).label).not.toMatch(/significan|inconsistent|sigma|σ/i);
  });

  it('does not compare a bound, incomplete interval, missing composite, or different parameter', () => {
    const composite = evidenceFigure(tiny.planets[0]!);
    expect(compareEvidenceFigures(evidenceFigure(tiny.measurements[1]!), composite).position).toBe('not-comparable');
    expect(compareEvidenceFigures(evidenceFigure(measurement({ pl_radeerr1: null })), composite).position).toBe('uncertainty-missing');
    expect(compareEvidenceFigures(evidenceFigure(central), null).position).toBe('not-comparable');
    expect(compareEvidenceFigures(evidenceFigure(central, 'mass'), composite).position).toBe('not-comparable');
    expect(compareEvidenceFigures(evidenceFigure(central), evidenceFigure({ ...tiny.planets[0]!, radius_state: 'limit', radius_bound: 'upper' })).position).toBe('not-comparable');
  });

  it('retains each solution while counting distinct reference keys', () => {
    const evidence = evidenceForPlanet('Demo-1 b', tiny.measurements, tiny.planets, tiny.references);
    expect(evidence.counts).toEqual({ solutions: 3, references: 2, reported: 2, bounds: 1, missing: 0, unknown: 0, withUncertainty: 2 });
    expect(evidence.rows.map((row) => row.id)).toEqual(['Demo-1 b#0', 'Demo-1 b#1', 'Demo-1 b#2']);
    expect(evidence.composite?.reference).toMatchObject({ ref: 'CALCULATED_VALUE', kind: 'archive' });
    expect(evidence.rows.every((row) => !row.isCompositeSource)).toBe(true);
    expect(evidenceForPlanet('Absent b', tiny.measurements, tiny.planets, tiny.references)).toMatchObject({ planet: null, composite: null, rows: [], counts: { solutions: 0 } });
  });

  it('declines interval comparisons when either mass provenance is missing', () => {
    const measuredWithoutKind = { ...tiny.measurements[0]!, mass_kind: null };
    const compositeWithoutKind = { ...tiny.planets[0]!, mass_kind: null };
    for (const [source, composite] of [
      [measuredWithoutKind, tiny.planets[0]!],
      [tiny.measurements[0]!, compositeWithoutKind],
      [measuredWithoutKind, compositeWithoutKind],
    ] as const) {
      const evidence = evidenceForPlanet('Demo-1 b', [source], [composite], tiny.references, 'mass');
      expect(evidence.rows[0]?.comparison).toEqual({ position: 'not-comparable', label: 'Mass provenance differs or is missing; no like-for-like interval comparison' });
      expect(evidence.rows[0]?.figure.value).toBe(5);
    }
  });

  it('does not compare 14 Her b minimum-mass intervals to its true-mass composite', () => {
    const tables = loadExo();
    const evidence = evidenceForPlanet('14 Her b', tables.measurements, tables.planets, tables.references, 'mass');
    expect(evidence.planet?.mass_kind).toBe('Mass');
    expect(evidence.composite?.figure.value).toBe(2828.6728223);
    const minimumMasses = evidence.rows.filter((row) => row.measurement.mass_kind === 'Msini');
    expect(minimumMasses.length).toBeGreaterThan(0);
    expect(minimumMasses.every((row) => row.comparison.position === 'not-comparable')).toBe(true);
    // Keep both the reported minimum masses and their uncertainty availability.
    expect(minimumMasses[0]?.figure).toMatchObject({ value: 1554.12, state: 'present', uncertainty: 'missing' });
    const reportedInterval = minimumMasses.find((row) => row.figure.uncertainty === 'reported');
    expect(reportedInterval?.figure.lower).toEqual(expect.any(Number));
    expect(reportedInterval?.figure.upper).toEqual(expect.any(Number));
    const sameQuantity = evidence.rows.find((row) => row.isCompositeSource);
    expect(sameQuantity?.measurement.mass_kind).toBe('Mass');
    expect(sameQuantity?.comparison.position).toBe('within-reported-interval');
  });

  it('pins the TrES-2 b example to actual committed rows and a named composite source', () => {
    const tables = loadExo();
    const evidence = evidenceForPlanet('TrES-2 b', tables.measurements, tables.planets, tables.references);
    expect(evidence.counts).toEqual({ solutions: 26, references: 26, reported: 19, bounds: 0, missing: 7, unknown: 0, withUncertainty: 19 });
    expect(evidence.composite?.figure.value).toBe(15.24424);
    expect(evidence.composite?.reference).toMatchObject({ ref: 'STASSUN_ET_AL__2017', label: 'Stassun et al. 2017', href: 'https://ui.adsabs.harvard.edu/abs/2017AJ....153..136S/abstract' });
    const sameSource = evidence.rows.filter((row) => row.isCompositeSource);
    expect(sameSource.map((row) => row.id)).toEqual(['TrES-2 b#19']);
    expect(sameSource[0]?.figure).toMatchObject({ value: 15.24424, upperError: 0.89672, lowerError: -0.89672 });
    expect(evidence.rows.find((row) => row.measurement.ref === 'KIPPING__AMP__BAKOS_2011')?.reference?.label).toBe('Kipping & Bakos 2011');
    // The panel reads source rows; it does not create a second untraced delta.
    expect(evidence.rows.every((row) => !('delta' in row))).toBe(true);
  });
});
