/**
 * Readable evidence for one planet, using the committed source rows.
 *
 * Endpoints below are for drawing the source's signed uncertainty offsets;
 * they do not estimate a confidence level or a statistical disagreement. The
 * dashboard's traced `delta` and `spread` remain the session acts' outputs.
 */
import type { MeasurementRow, PlanetRow, ReferenceRow } from './etl.js';
import type { Absence, Bound } from './absence.js';
import type { ReferenceKind } from './names.js';

export type EvidenceParameter = 'radius' | 'mass';

const ARCHIVE = 'https://exoplanetarchive.ipac.caltech.edu';
const PARAMETER = {
  radius: { value: 'pl_rade', upper: 'pl_radeerr1', lower: 'pl_radeerr2', state: 'radius_state', bound: 'radius_bound', reference: 'radius_ref', unit: 'R⊕' },
  mass: { value: 'pl_bmasse', upper: 'pl_bmasseerr1', lower: 'pl_bmasseerr2', state: 'mass_state', bound: 'mass_bound', reference: 'mass_ref', unit: 'M⊕' },
} as const;

const finite = (value: unknown): number | null => typeof value === 'number' && Number.isFinite(value) ? value : null;

/** Show the supplied number without manufacturing precision or a missing zero. */
export function formatEvidenceNumber(value: number | null): string {
  if (value === null || !Number.isFinite(value)) return '—';
  if (value !== 0 && Math.abs(value) < 0.000001) return value.toExponential(3);
  return value.toLocaleString('en-US', { maximumFractionDigits: 6 });
}

// The named entities present in the committed reference labels, plus HTML's
// basic text entities. Numeric entities cover other Unicode names without DOM.
const ENTITIES: Readonly<Record<string, string>> = {
  amp: '&', quot: '"', apos: "'", lt: '<', gt: '>', nbsp: ' ',
  aacute: 'á', Aacute: 'Á', eacute: 'é', iacute: 'í', oacute: 'ó', uacute: 'ú', yacute: 'ý',
  agrave: 'à', egrave: 'è', ograve: 'ò', acirc: 'â', atilde: 'ã', ntilde: 'ñ',
  auml: 'ä', ouml: 'ö', Ouml: 'Ö', uuml: 'ü', ccedil: 'ç', oslash: 'ø', scaron: 'š', Scaron: 'Š',
};

function plainText(value: string): string {
  return value.replace(/<[^>]*>/g, '').replace(/&(#x[\da-f]+|#\d+|[a-z]+);/gi, (whole, entity: string) => {
    if (!entity.startsWith('#')) return ENTITIES[entity] ?? whole;
    const point = entity[1]?.toLowerCase() === 'x' ? Number.parseInt(entity.slice(2), 16) : Number.parseInt(entity.slice(1), 10);
    return Number.isInteger(point) && point > 0 && point <= 0x10ffff && !(point >= 0xd800 && point <= 0xdfff) ? String.fromCodePoint(point) : whole;
  }).trim();
}

/** Only web links are clickable; a root-relative archive link gets its origin. */
export function safeReferenceHref(value: unknown): string | null {
  if (typeof value !== 'string' || value.trim() === '') return null;
  const href = value.trim().replace(/&amp;/gi, '&');
  // Do not reinterpret an arbitrary string or a non-web scheme as a relative URL.
  if (!/^https?:\/\//i.test(href) && !href.startsWith('/')) return null;
  try {
    const url = new URL(href, ARCHIVE);
    if (!['http:', 'https:'].includes(url.protocol) || url.username !== '' || url.password !== '') return null;
    return url.href;
  } catch {
    return null;
  }
}

interface AnchorReference { readonly ref: string; readonly label: string; readonly href: string }

/** Quoted/unquoted attributes in any order; raw archive HTML is never rendered. */
function referenceFromAnchor(anchor: unknown): AnchorReference | null {
  if (typeof anchor !== 'string') return null;
  const match = /<a\b((?:[^>"']|"[^"]*"|'[^']*')*)>([\s\S]*?)<\/a\s*>/i.exec(anchor);
  if (!match) return null;
  const attributes = new Map<string, string>();
  const pattern = /(?:^|\s)(refstr|href)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'<>`]+))/gi;
  for (const attribute of match[1]!.matchAll(pattern)) attributes.set(attribute[1]!.toLowerCase(), attribute[2] ?? attribute[3] ?? attribute[4] ?? '');
  const ref = attributes.get('refstr')?.trim();
  const href = attributes.get('href');
  return ref && href !== undefined ? { ref, href, label: plainText(match[2] ?? '') } : null;
}

export interface EvidenceReference {
  readonly ref: string;
  readonly label: string;
  /** Null for an unsafe or unavailable URL; the reference text can still show. */
  readonly href: string | null;
  readonly kind: ReferenceKind | null;
  readonly note: string | null;
}

/** Resolve the table's stable reference key, with the row's raw anchor as fallback. */
export function resolveEvidenceReference(refKey: string | null | undefined, references: readonly ReferenceRow[], rawAnchor?: unknown): EvidenceReference | null {
  const found = refKey ? references.find((reference) => reference.ref === refKey) : undefined;
  if (found) return { ref: found.ref, label: plainText(found.label), href: safeReferenceHref(found.href), kind: found.kind, note: found.note };
  const parsed = referenceFromAnchor(rawAnchor);
  // A disagreeing key is not permission to silently link a different paper.
  if (!parsed || (refKey && parsed.ref !== refKey)) return null;
  const href = safeReferenceHref(parsed.href);
  const host = href === null ? null : new URL(href).hostname;
  const kind = host === null ? null : host === 'ipac.caltech.edu' || host.endsWith('.ipac.caltech.edu') ? 'archive' : 'publication';
  return { ref: parsed.ref, label: parsed.label, href, kind, note: null };
}

export type EvidenceUncertainty = 'reported' | 'partial' | 'missing' | 'invalid' | 'not-applicable' | 'not-in-snapshot';

export interface EvidenceFigure {
  readonly parameter: EvidenceParameter;
  readonly unit: 'R⊕' | 'M⊕';
  readonly value: number | null;
  readonly state: Absence;
  readonly bound: Bound | null;
  /** The archive's signed offsets, preserved (err1 positive, err2 negative). */
  readonly upperError: number | null;
  readonly lowerError: number | null;
  /** Endpoints exist only for valid supplied offsets on a central value. */
  readonly lower: number | null;
  readonly upper: number | null;
  readonly uncertainty: EvidenceUncertainty;
  readonly valueLabel: string;
  readonly uncertaintyLabel: string;
}

/**
 * Missing uncertainties stay missing. A bound never becomes a central value
 * with error bars. Composite errors were not selected into this snapshot.
 */
export function evidenceFigure(row: MeasurementRow | PlanetRow, parameter: EvidenceParameter = 'radius'): EvidenceFigure {
  const fields = PARAMETER[parameter];
  const value = finite(row[fields.value]);
  const state = row[fields.state];
  const bound = row[fields.bound];
  const upperError = finite(row[fields.upper]);
  const lowerError = finite(row[fields.lower]);
  const basic = { parameter, unit: fields.unit, value, state, bound, upperError, lowerError };
  const number = `${formatEvidenceNumber(value)} ${fields.unit}`;
  if (state === 'not-measured' || value === null) return {
    ...basic, lower: null, upper: null, uncertainty: 'not-applicable',
    valueLabel: state === 'unknown' ? 'Unknown value' : 'Not reported', uncertaintyLabel: 'No central value to compare',
  };
  if (state === 'limit') return {
    ...basic, lower: null, upper: null, uncertainty: 'not-applicable',
    valueLabel: bound === 'upper' ? `≤ ${number} (upper bound)` : bound === 'lower' ? `≥ ${number} (lower bound)` : `${number} (bound)`,
    uncertaintyLabel: 'A bound, not a central measurement; no uncertainty interval drawn',
  };
  if (state !== 'present') return {
    ...basic, lower: null, upper: null, uncertainty: 'not-applicable', valueLabel: `${number} (unknown state)`, uncertaintyLabel: 'No central-value comparison',
  };
  if (!('measurement_id' in row)) return {
    ...basic, lower: null, upper: null, uncertainty: 'not-in-snapshot', valueLabel: number, uncertaintyLabel: 'Composite uncertainty is not included in this snapshot',
  };
  if ((upperError !== null && upperError < 0) || (lowerError !== null && lowerError > 0)) return {
    ...basic, lower: null, upper: null, uncertainty: 'invalid', valueLabel: number, uncertaintyLabel: 'Reported uncertainty signs are unexpected; no interval drawn',
  };
  const lower = lowerError === null ? null : value + lowerError;
  const upper = upperError === null ? null : value + upperError;
  if (upperError === null && lowerError === null) return {
    ...basic, lower, upper, uncertainty: 'missing', valueLabel: number, uncertaintyLabel: 'Uncertainty not reported in this source row',
  };
  const plus = upperError === null ? 'upper uncertainty not reported' : `+${formatEvidenceNumber(upperError)}`;
  const minus = lowerError === null ? 'lower uncertainty not reported' : `−${formatEvidenceNumber(Math.abs(lowerError))}`;
  return {
    ...basic, lower, upper, uncertainty: upperError !== null && lowerError !== null ? 'reported' : 'partial', valueLabel: number,
    uncertaintyLabel: `${plus} / ${minus} ${fields.unit} (as reported)`,
  };
}

export type EvidenceComparisonPosition = 'within-reported-interval' | 'below-reported-interval' | 'above-reported-interval' | 'uncertainty-missing' | 'not-comparable';
export interface EvidenceComparison { readonly position: EvidenceComparisonPosition; readonly label: string }

/** Position of the composite marker within one source interval; no sigma test. */
export function compareEvidenceFigures(measurement: EvidenceFigure, composite: EvidenceFigure | null): EvidenceComparison {
  if (measurement.parameter !== composite?.parameter || measurement.state !== 'present' || composite.state !== 'present' || measurement.value === null || composite.value === null) return {
    position: 'not-comparable', label: 'A central value is missing or bounded; no central-value comparison',
  };
  if (measurement.uncertainty !== 'reported' || measurement.lower === null || measurement.upper === null) return {
    position: 'uncertainty-missing', label: 'No complete reported uncertainty interval for this source row',
  };
  if (composite.value < measurement.lower) return { position: 'below-reported-interval', label: 'Composite marker is below this reported interval' };
  if (composite.value > measurement.upper) return { position: 'above-reported-interval', label: 'Composite marker is above this reported interval' };
  return { position: 'within-reported-interval', label: 'Composite marker falls within this reported interval' };
}

export interface EvidenceMeasurement {
  readonly measurement: MeasurementRow;
  readonly id: string;
  readonly reference: EvidenceReference | null;
  readonly figure: EvidenceFigure;
  readonly comparison: EvidenceComparison;
  /** The same key as the composite source; this does not prove independence. */
  readonly isCompositeSource: boolean;
}

export interface PlanetEvidence {
  readonly planet: PlanetRow | null;
  readonly parameter: EvidenceParameter;
  readonly composite: { readonly figure: EvidenceFigure; readonly reference: EvidenceReference | null } | null;
  readonly rows: readonly EvidenceMeasurement[];
  readonly counts: { readonly solutions: number; readonly references: number; readonly reported: number; readonly bounds: number; readonly missing: number; readonly unknown: number; readonly withUncertainty: number };
}

/** Select a planet without dropping bounds, empty parameter cells, or references. */
export function evidenceForPlanet(name: string, measurements: readonly MeasurementRow[], planets: readonly PlanetRow[], references: readonly ReferenceRow[], parameter: EvidenceParameter = 'radius'): PlanetEvidence {
  const planet = planets.find((row) => row.pl_name === name) ?? null;
  const ref = planet?.[PARAMETER[parameter].reference] ?? null;
  const composite = planet === null ? null : { figure: evidenceFigure(planet, parameter), reference: resolveEvidenceReference(ref, references) };
  const rows = measurements.filter((row) => row.pl_name === name).map((measurement): EvidenceMeasurement => {
    const figure = evidenceFigure(measurement, parameter);
    // Best-mass fields can represent true mass, M·sin(i), or a model. Their
    // numerical intervals do not compare the same quantity merely because
    // both are expressed in Earth masses. Missing provenance establishes no
    // equivalence either; retain the rows but decline the comparison.
    const sameMassKind = measurement.mass_kind !== null && measurement.mass_kind.trim() !== '' && measurement.mass_kind === planet?.mass_kind;
    const comparison: EvidenceComparison = parameter === 'mass' && !sameMassKind
      ? { position: 'not-comparable', label: 'Mass provenance differs or is missing; no like-for-like interval comparison' }
      : compareEvidenceFigures(figure, composite?.figure ?? null);
    return {
      measurement, id: measurement.measurement_id,
      reference: resolveEvidenceReference(measurement.ref, references, measurement.pl_refname), figure,
      comparison,
      isCompositeSource: ref !== null && measurement.ref === ref,
    };
  });
  return {
    planet, parameter, composite, rows,
    counts: {
      solutions: rows.length,
      references: new Set(rows.map((row) => row.reference?.ref).filter((key): key is string => key !== undefined)).size,
      reported: rows.filter((row) => row.figure.state === 'present' && row.figure.value !== null).length,
      bounds: rows.filter((row) => row.figure.state === 'limit' && row.figure.value !== null).length,
      missing: rows.filter((row) => row.figure.state === 'not-measured').length,
      unknown: rows.filter((row) => row.figure.state === 'unknown').length,
      withUncertainty: rows.filter((row) => row.figure.uncertainty === 'reported').length,
    },
  };
}
