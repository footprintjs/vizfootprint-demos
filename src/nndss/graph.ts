/**
 * THE DISEASE CO-OCCURRENCE GRAPH — a node-link shape FOLDED FROM THE CELLS, ONCE.
 *
 * Two tables and a rule. `nodes` is one row per disease with the figures a
 * mark can carry; `edges` is one row per unordered pair of diseases that
 * ever reported cases in the same jurisdiction-week, weighted by how many
 * such jurisdiction-weeks there were. The rule is `GRAPH_RULE`, and it is
 * written into the graph's provenance so a reader never has to open this
 * file to know what an edge means.
 *
 * The hierarchy law (`GRAPH_KINDS`): only the LEAF reporting areas are walked.
 * CDC files each state's count again under its census division and again
 * under the national rows, so a fold over every kind would count one event
 * up to four times and quote a `cases_total` that is CDC's figure for
 * nothing. The rows set aside are counted, never silently dropped.
 *
 * The law is the library's fold law ("one pass, many recorders"): the leaf
 * cells are walked ONCE and every figure is collected on the way — the
 * disease list by the library's `distinct`, the per-disease tallies, the
 * per-jurisdiction-week reporting sets and the repeated-cell counter by
 * recorders of the same shape written here. Nothing reads the rows twice;
 * `result()` is pure over what was seen.
 *
 * Determinism is a contract, not a hope: nodes are in lexical disease order,
 * an edge's `source` sorts before its `target`, edges are in (source, target)
 * order, and nothing here reads a clock. `scripts/graph-generate.ts` writes
 * the outputs, `tests/graph.test.ts` proves two runs are the same bytes.
 *
 * **This module runs in a browser** (the same rule as `etl.ts`): the node half
 * — reading and writing the committed files — lives in `snapshot.ts`.
 *
 * First customers: the generator, the def (`nodes` / `edges` tables and the
 * two relations), the `/api/rows` door.
 */
import { distinct, foldOnce, type RowRecorder } from 'vizfootprint/data';
import type { CellRow, JurisdictionKind } from './etl.js';

// ── the data ──────────────────────────────────────────────────────────────────

/** One disease: the graph's node, keyed by its NNDSS label. */
export interface DiseaseNode {
  readonly disease: string;
  /** Cases summed over every PRESENT cell (a dash is a present zero; a silence adds nothing). */
  readonly cases_total: number;
  /** Distinct reporting areas with at least one cell of cases > 0. */
  readonly jurisdictions_reporting: number;
  /** Distinct MMWR weeks with at least one cell of cases > 0, in any area. */
  readonly weeks_reporting: number;
  // WHY: an interface has no implicit index signature — without this a node is not a `Row` for `DataSourceDef.rows`, nor the record `csvOf` takes
  readonly [k: string]: string | number;
}

/** One unordered pair of diseases that co-occurred: the graph's edge. */
export interface DiseaseEdge {
  /** The lexically smaller disease of the pair. */
  readonly source: string;
  /** The lexically greater disease of the pair. */
  readonly target: string;
  /** How many jurisdiction-weeks reported cases > 0 for BOTH. */
  readonly weight: number;
  /** Distinct reporting areas in which the pair co-occurred at least once. */
  readonly jurisdictions: number;
  // WHY: the same as on `DiseaseNode` — the index signature is what makes an edge a `Row` for the def and a record for `csvOf`
  readonly [k: string]: string | number;
}

export interface NndssGraph {
  readonly nodes: readonly DiseaseNode[];
  readonly edges: readonly DiseaseEdge[];
}

/** What the fold saw, beside the graph — the honest counters the provenance carries. */
export interface DiseaseGraphFold extends NndssGraph {
  readonly counts: {
    /** Cells handed in, every kind. */
    readonly cells: number;
    /** Cells set aside because their area is not a leaf (`GRAPH_KINDS`): CDC's region and total roll-ups. */
    readonly rollups: number;
    /** Leaf cells whose (jurisdiction, week, disease) was already seen — the ETL promises one row per cell; this says whether the input kept it. */
    readonly repeats: number;
    /** Leaf cells with cases > 0 — the ones that can make an edge. */
    readonly reporting: number;
  };
}

/** The columns of each file, in the order they are written. */
export const NODE_COLUMNS: readonly (keyof DiseaseNode & string)[] = ['disease', 'cases_total', 'jurisdictions_reporting', 'weeks_reporting'];
export const EDGE_COLUMNS: readonly (keyof DiseaseEdge & string)[] = ['source', 'target', 'weight', 'jurisdictions'];

/**
 * The kinds of reporting area the fold walks — the leaves only.
 * WHY: a region row is CDC's sum of its states and a total row the sum of everything, so walking them
 * beside the states counts one state-week event up to four times; `series` may show a region's row
 * because it shows ONE kind at a time, but a sum across kinds is CDC's figure for nothing.
 */
export const GRAPH_KINDS: readonly JurisdictionKind[] = ['state'];

/** The rule, in one sentence — written into PROVENANCE.json so the meaning of an edge travels with the data. */
export const GRAPH_RULE =
  'over the leaf reporting areas only (kind = state — CDC\'s region and total rows are its sums of these rows and are not walked): one edge per unordered pair of diseases that reported cases > 0 in the same jurisdiction-week at least once; weight = the number of such jurisdiction-weeks, jurisdictions = the distinct reporting areas among them; a pair with no such jurisdiction-week is no edge';

/** The ordering law, in one sentence. */
export const GRAPH_ORDER =
  'nodes in lexical disease order; on every edge source < target lexically; edges in (source, target) order — lexical is JavaScript string order (UTF-16 code units)';

/** The fields the graph's provenance copies from the snapshot's own. */
export interface SnapshotProvenance {
  readonly source: string;
  readonly dataset: string;
  readonly url: string;
  readonly attribution: string;
  readonly license: string;
  readonly retrievedAt: string;
  readonly rows: number;
  /** SHA-256 of the snapshot's bytes — the one content-bound field, so a graph over an edited snapshot cannot claim the same derivation. */
  readonly sha256: string;
}

// ── the recorders ─────────────────────────────────────────────────────────────

/** A cell reports when CDC printed a positive count — a dash (0) and every silence do not. */
const reports = (cell: CellRow): boolean => cell.cases !== null && cell.cases > 0;

/** A cell of a leaf reporting area — the only cells the fold walks (`GRAPH_KINDS`). */
const isLeaf = (cell: CellRow): boolean => GRAPH_KINDS.includes(cell.kind);

/**
 * Joins the parts of a compound key.
 * WHY: a space would collide — "A B"+"C" and "A"+"B C" both spell "A B C" — and NNDSS labels carry
 * spaces and commas; NUL is the one character a CSV cell cannot hold, written escaped so the file stays text.
 */
const KEY_SEPARATOR = '\u0000';
const keyOf = (...parts: readonly string[]): string => parts.join(KEY_SEPARATOR);

interface Tally {
  cases: number;
  readonly areas: Set<string>;
  readonly weeks: Set<string>;
}

/** Per disease: cases over present cells, and the areas and weeks that reported — only diseases with a present cell get an entry. */
function tallies(): RowRecorder<ReadonlyMap<string, Tally>> {
  const byDisease = new Map<string, Tally>();
  return {
    step: (row) => {
      const cell = row as CellRow;
      if (cell.cases === null) return;
      let t = byDisease.get(cell.disease);
      if (t === undefined) {
        t = { cases: 0, areas: new Set(), weeks: new Set() };
        byDisease.set(cell.disease, t);
      }
      t.cases += cell.cases;
      if (reports(cell)) {
        t.areas.add(cell.jurisdiction);
        t.weeks.add(cell.t);
      }
    },
    result: () => byDisease,
  };
}

interface Reporting {
  readonly jurisdiction: string;
  readonly diseases: Set<string>;
}

/** Per jurisdiction-week: the diseases that reported there — the raw material of an edge. */
function reporting(): RowRecorder<{ readonly groups: ReadonlyMap<string, Reporting>; readonly reportingCells: number }> {
  const groups = new Map<string, Reporting>();
  let reportingCells = 0;
  return {
    step: (row) => {
      const cell = row as CellRow;
      if (!reports(cell)) return;
      reportingCells++;
      const k = keyOf(cell.jurisdiction, cell.t);
      let g = groups.get(k);
      if (g === undefined) {
        g = { jurisdiction: cell.jurisdiction, diseases: new Set() };
        groups.set(k, g);
      }
      g.diseases.add(cell.disease);
    },
    result: () => ({ groups, reportingCells }),
  };
}

/** How many cells repeat a (jurisdiction, week, disease) already seen — an honesty counter, never a silent merge: a repeated row is summed twice above and weighed once below. */
function repeats(): RowRecorder<number> {
  const seen = new Set<string>();
  let repeated = 0;
  return {
    step: (row) => {
      const cell = row as CellRow;
      const k = keyOf(cell.jurisdiction, cell.t, cell.disease);
      if (seen.has(k)) repeated++;
      else seen.add(k);
    },
    result: () => repeated,
  };
}

// ── the fold ──────────────────────────────────────────────────────────────────

const pairKey = (a: string, b: string): string => keyOf(a, b);

/** Every pair's weight and area set, keyed source<target — from the reporting groups, never from the rows again. */
function pairWeights(groups: ReadonlyMap<string, Reporting>): ReadonlyMap<string, { weight: number; readonly areas: Set<string> }> {
  const pairs = new Map<string, { weight: number; readonly areas: Set<string> }>();
  for (const g of groups.values()) {
    const ds = [...g.diseases].sort(); // WHY: the source < target law — sorting inside the group makes every pair land under one key
    for (let i = 0; i < ds.length; i++) {
      for (let j = i + 1; j < ds.length; j++) {
        const k = pairKey(ds[i]!, ds[j]!);
        let p = pairs.get(k);
        if (p === undefined) {
          p = { weight: 0, areas: new Set() };
          pairs.set(k, p);
        }
        p.weight++;
        p.areas.add(g.jurisdiction);
      }
    }
  }
  return pairs;
}

/** The graph, by `GRAPH_KINDS`, `GRAPH_RULE` and `GRAPH_ORDER`, from one walk over the leaf cells. */
export function diseaseGraph(cells: readonly CellRow[]): DiseaseGraphFold {
  const leaves = cells.filter(isLeaf);
  const seen = foldOnce(leaves, { diseases: distinct('disease'), tallies: tallies(), reporting: reporting(), repeats: repeats() });
  // every disease is a node, including one that only ever reported silences — its zeros are the honest figure
  const diseases = seen.diseases.values.map(String).sort();
  const nodes: DiseaseNode[] = diseases.map((disease) => {
    const t = seen.tallies.get(disease);
    return { disease, cases_total: t?.cases ?? 0, jurisdictions_reporting: t?.areas.size ?? 0, weeks_reporting: t?.weeks.size ?? 0 };
  });
  const pairs = pairWeights(seen.reporting.groups);
  const edges: DiseaseEdge[] = [];
  // WHY: walking the sorted disease list pairwise, not the map, is what fixes the edge ORDER — a Map remembers insertion order, which is the rows' order
  for (let i = 0; i < diseases.length; i++) {
    for (let j = i + 1; j < diseases.length; j++) {
      const p = pairs.get(pairKey(diseases[i]!, diseases[j]!));
      if (p === undefined) continue; // weight 0: no edge
      edges.push({ source: diseases[i]!, target: diseases[j]!, weight: p.weight, jurisdictions: p.areas.size });
    }
  }
  return { nodes, edges, counts: { cells: cells.length, rollups: cells.length - leaves.length, repeats: seen.repeats, reporting: seen.reporting.reportingCells } };
}

// ── the files ─────────────────────────────────────────────────────────────────

/** One CSV field, quoted only when it must be — the same spelling `data/nndss/fetch.mjs` writes the snapshot in (a missing cell is empty). */
const csvField = (v: unknown): string => {
  if (v === undefined || v === null) return '';
  const s = String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

/** Rows as CSV: one header, the named columns in order, a trailing newline. */
export function csvOf<R extends Readonly<Record<string, string | number>>>(rows: readonly R[], columns: readonly (keyof R & string)[]): string {
  const lines = [columns.join(',')];
  for (const r of rows) lines.push(columns.map((c) => csvField(r[c])).join(','));
  return lines.join('\n') + '\n';
}

/** The three files the generator writes, as text — no clock is read, so the same graph is the same bytes. */
export function graphFiles(fold: DiseaseGraphFold, snapshot: SnapshotProvenance, generator: string): Readonly<Record<'nodes.csv' | 'edges.csv' | 'PROVENANCE.json', string>> {
  const provenance = {
    derivedFrom: { file: 'data/nndss/snapshot.csv', ...snapshot },
    kinds: GRAPH_KINDS,
    rule: GRAPH_RULE,
    order: GRAPH_ORDER,
    columns: { nodes: NODE_COLUMNS, edges: EDGE_COLUMNS },
    counts: {
      nodes: fold.nodes.length,
      edges: fold.edges.length,
      cellsRead: fold.counts.cells,
      cellsSetAside: fold.counts.rollups,
      cellsWalked: fold.counts.cells - fold.counts.rollups,
      cellsRepeated: fold.counts.repeats,
      cellsReporting: fold.counts.reporting,
    },
    generator,
    regenerate: 'npm run graph:generate',
    // WHY: the byte-stability promise — a stamp of when the generator ran would make two runs over one snapshot differ for no reason a reader can use
    note: 'Derived data: no wall-clock stamp, so two runs over the same snapshot write the same bytes. Regenerate after data:fetch; never edit by hand.',
  };
  return {
    'nodes.csv': csvOf(fold.nodes, NODE_COLUMNS),
    'edges.csv': csvOf(fold.edges, EDGE_COLUMNS),
    'PROVENANCE.json': JSON.stringify(provenance, null, 2) + '\n',
  };
}

// ── reading the files back ────────────────────────────────────────────────────

/** A row's cell as the type the column promises, or the sentence saying what was there instead. */
function cellAs<T extends 'string' | 'number'>(file: string, i: number, row: Record<string, unknown>, column: string, type: T): T extends 'string' ? string : number {
  const v = row[column];
  if (typeof v !== type || (type === 'number' && !Number.isFinite(v))) {
    throw new Error(`data/nndss/graph/${file} row ${String(i + 1)}: "${column}" is ${v === undefined ? 'missing' : `${typeof v} ${JSON.stringify(v)}`}, not a ${type} — regenerate with npm run graph:generate`);
  }
  return v as T extends 'string' ? string : number;
}

/** The two committed tables, narrowed to their declared shapes — a file that drifted from the generator is refused by row and column. */
export function graphOf(rows: { readonly nodes: readonly Record<string, unknown>[]; readonly edges: readonly Record<string, unknown>[] }): NndssGraph {
  const nodes = rows.nodes.map((r, i) => ({
    disease: cellAs('nodes.csv', i, r, 'disease', 'string'),
    cases_total: cellAs('nodes.csv', i, r, 'cases_total', 'number'),
    jurisdictions_reporting: cellAs('nodes.csv', i, r, 'jurisdictions_reporting', 'number'),
    weeks_reporting: cellAs('nodes.csv', i, r, 'weeks_reporting', 'number'),
  }));
  const edges = rows.edges.map((r, i) => ({
    source: cellAs('edges.csv', i, r, 'source', 'string'),
    target: cellAs('edges.csv', i, r, 'target', 'string'),
    weight: cellAs('edges.csv', i, r, 'weight', 'number'),
    jurisdictions: cellAs('edges.csv', i, r, 'jurisdictions', 'number'),
  }));
  return { nodes, edges };
}
