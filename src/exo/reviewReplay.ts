/**
 * A small, public review recipe. The URL names one planet, up to two published
 * rows, a parameter, and the committed source versions. It carries no data,
 * arbitrary commands, source URLs, agent state, or executable analyses.
 *
 * Reopening a recipe builds a NEW real session: the five declared acts run in
 * dependency order, their unfiltered derived rows are cached by the surface,
 * then the planet selection lands through the library's dispatch door. The
 * parameter and A/B rows are the evidence review's local reading choices; this
 * recipe does not claim to restore every chart gesture or branch of the desk.
 */
import fetched from '../../data/exo/FETCH.json';
import { SCATTER_ADDRESS } from './def.js';
import type { ExoTables } from './etl.js';
import { openExoSurfaceAsync, type ExoSurface } from './session.js';

export type ReviewParameter = 'radius' | 'mass';

export interface ReviewSourceVersions {
  readonly ps: string;
  readonly pscomppars: string;
}

export interface ReviewRecipe {
  readonly v: 1;
  readonly planet: string;
  readonly parameter: ReviewParameter;
  /** A and B, in that order. A planet with fewer publications can name fewer rows. */
  readonly measurementIds: readonly string[];
  readonly sources: ReviewSourceVersions;
}

export type ParsedReview =
  | { readonly ok: true; readonly review: ReviewRecipe | null }
  | { readonly ok: false; readonly sentence: string };

export type ReplayedReview =
  | { readonly ok: true; readonly review: ReviewRecipe; readonly surface: ExoSurface }
  | { readonly ok: false; readonly sentence: string };

type ValidatedReview =
  | { readonly ok: true; readonly review: ReviewRecipe }
  | { readonly ok: false; readonly sentence: string };

const HASH_PREFIX = '#review=';
const MAX_HASH_LENGTH = 4096;
const SHA256 = /^[a-f0-9]{64}$/;

function versionFor(table: string): string {
  const version = fetched.tables.find((source) => source.table === table)?.sha256;
  if (version === undefined || !SHA256.test(version)) throw new Error(`the committed fetch record has no SHA-256 for ${table}`);
  return version;
}

/** Read from the download record, so a new committed slice invalidates older row ids. */
export const REVIEW_SOURCE_VERSIONS: ReviewSourceVersions = Object.freeze({ ps: versionFor('ps'), pscomppars: versionFor('pscomppars') });

export const DEFAULT_REVIEW: ReviewRecipe = Object.freeze({
  v: 1,
  planet: 'TrES-2 b',
  parameter: 'radius',
  measurementIds: Object.freeze(['TrES-2 b#0', 'TrES-2 b#1']),
  sources: REVIEW_SOURCE_VERSIONS,
});

const refused = (sentence: string): { readonly ok: false; readonly sentence: string } => ({ ok: false, sentence });

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function hasExactly(value: Record<string, unknown>, keys: readonly string[]): boolean {
  return Object.keys(value).length === keys.length && keys.every((key) => Object.hasOwn(value, key));
}

function named(value: unknown, limit: number): value is string {
  return typeof value === 'string' && value.length > 0 && value.length <= limit && value.trim() === value && !/[\u0000-\u001f\u007f]/.test(value);
}

/** The URL is an untrusted boundary. Only this fixed vocabulary can reach boot. */
function validateReview(value: unknown): ValidatedReview {
  if (!isRecord(value) || !hasExactly(value, ['v', 'planet', 'parameter', 'measurementIds', 'sources'])) return refused('This review link does not contain the expected review fields.');
  if (value['v'] !== 1) return refused('This review link uses an unsupported recipe version.');
  if (!named(value['planet'], 120)) return refused('This review link has no valid planet name.');
  if (value['parameter'] !== 'radius' && value['parameter'] !== 'mass') return refused('This review link must choose radius or mass.');
  const ids = value['measurementIds'];
  if (!Array.isArray(ids) || ids.length > 2 || !Array.from(ids).every((id) => named(id, 160)) || new Set(ids).size !== ids.length) return refused('This review link must name at most two distinct published measurement rows.');
  const sources = value['sources'];
  if (!isRecord(sources) || !hasExactly(sources, ['ps', 'pscomppars']) || typeof sources['ps'] !== 'string' || typeof sources['pscomppars'] !== 'string' || !SHA256.test(sources['ps']) || !SHA256.test(sources['pscomppars'])) return refused('This review link has no valid source fingerprints.');
  if (sources['ps'] !== REVIEW_SOURCE_VERSIONS.ps || sources['pscomppars'] !== REVIEW_SOURCE_VERSIONS.pscomppars) return refused('This review link refers to a different committed archive slice. Its row ids cannot be replayed against this version.');
  // Construct a fresh object in one order. No unknown property travels onward.
  return {
    ok: true,
    review: {
      v: 1,
      planet: value['planet'],
      parameter: value['parameter'],
      measurementIds: [...ids] as string[],
      sources: { ps: sources['ps'], pscomppars: sources['pscomppars'] },
    },
  };
}

/** A stable, bounded hash. The host can attach it to its current page URL. */
export function serializeReviewHash(review: ReviewRecipe): string {
  const validated = validateReview(review);
  if (!validated.ok) throw new Error(validated.sentence);
  const hash = `${HASH_PREFIX}${encodeURIComponent(JSON.stringify(validated.review))}`;
  if (hash.length > MAX_HASH_LENGTH) throw new Error('This review is too large for a share link.');
  return hash;
}

/** Unrelated anchors are ignored; malformed or stale review links give a sentence. */
export function parseReviewHash(hash: string): ParsedReview {
  if (!hash.startsWith(HASH_PREFIX)) return { ok: true, review: null };
  if (hash.length > MAX_HASH_LENGTH) return refused('This review link is too large to open.');
  let value: unknown;
  try {
    value = JSON.parse(decodeURIComponent(hash.slice(HASH_PREFIX.length))) as unknown;
  } catch {
    return refused('This review link is not a readable review recipe.');
  }
  return validateReview(value);
}

/**
 * Replay only the declared five-act boot and one planet select. Never replay
 * untrusted commit logs into the desk, and never merge with a visitor's session.
 */
export async function replayReview(tables: ExoTables, review: ReviewRecipe): Promise<ReplayedReview> {
  const validated = validateReview(review);
  if (!validated.ok) return validated;
  const recipe = validated.review;
  if (!tables.planets.some((planet) => planet.pl_name === recipe.planet)) return refused(`The committed slice has no planet named ${recipe.planet}.`);
  const rows = new Set(tables.measurements.filter((row) => row.pl_name === recipe.planet).map((row) => row.measurement_id));
  if (recipe.measurementIds.some((id) => !rows.has(id))) return refused('A selected measurement row is absent from this planet in the committed slice.');
  try {
    const surface = await openExoSurfaceAsync(tables);
    if (surface.actRefusals.length > 0) return refused(`The review could not rebuild its declared analyses: ${surface.actRefusals.join('; ')}`);
    const selected = await surface.session.dispatch({
      verb: 'select',
      viewId: SCATTER_ADDRESS,
      field: 'pl_name',
      value: recipe.planet,
      cause: { requestedBy: 'user', computedBy: 'user', intent: `replay the published ${recipe.parameter} evidence review for ${recipe.planet}` },
    });
    if (!selected.ok) return refused(selected.rejection.detail);
    return { ok: true, review: recipe, surface };
  } catch (error) {
    return refused(`The review could not be replayed: ${error instanceof Error ? error.message : String(error)}`);
  }
}
