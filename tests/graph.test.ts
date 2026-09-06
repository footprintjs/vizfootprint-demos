/**
 * THE DISEASE CO-OCCURRENCE GRAPH — the rule on a fixture small enough to
 * count by hand, the hierarchy law, the ordering laws, and the byte-stability
 * promise the committed files rest on.
 *
 * Four halves. `diseaseGraph` over hand-made cells: a silence and a dash make
 * no edge, a region row and a total row add NOTHING (they are CDC's sums of
 * the state rows), `source < target` holds, a pair that never co-occurs is no
 * row, a repeated cell is counted rather than merged, and labels with spaces
 * never collide. `graphFiles` twice over the same fold: the same bytes, and
 * the committed `data/nndss/graph` IS what the generator writes over the
 * committed snapshot, through the generator's OWN provenance reader — so a
 * stale regeneration fails here, not in a reader's hands. And the loader:
 * what is read back is the shape the def declares, and a drifted file is
 * refused with its row and column.
 */
import { describe, expect, it } from 'vitest';
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { csvOf, diseaseGraph, graphFiles, graphOf, GRAPH_KINDS, GRAPH_RULE, type DiseaseEdge, type SnapshotProvenance } from '../src/nndss/graph.js';
import type { CellRow, JurisdictionKind } from '../src/nndss/etl.js';
import { GRAPH_DIR, loadGraph, loadGraphAsync, loadSnapshot, SNAPSHOT_CSV, snapshotProvenance } from '../src/nndss/snapshot.js';

/** A cell with only what the fold reads — the rest of CellRow is the ETL's business. */
const cell = (jurisdiction: string, t: string, disease: string, cases: number | null, kind: JurisdictionKind = 'state'): CellRow =>
  ({ jurisdiction, t, disease, cases, kind, week_index: 0, year: 2026, week: 1, report_state: cases === null ? 'unavailable' : 'present', flag: null, ytd: null, ytd_state: 'unknown', prev52_max: null }) as CellRow;

// two areas, two weeks, three diseases — in a deliberately unsorted order — plus CDC's roll-ups of them
const CELLS: readonly CellRow[] = [
  cell('Texas', '2026-01-10', 'Mumps', 2),
  cell('Texas', '2026-01-10', 'Giardiasis', 5),
  cell('Texas', '2026-01-10', 'Anthrax', null), // a silence: never reports
  cell('Texas', '2026-01-17', 'Mumps', 0), // a dash: present, zero — counts toward cases_total, never an edge
  cell('Texas', '2026-01-17', 'Giardiasis', 1),
  cell('Ohio', '2026-01-10', 'Giardiasis', 3),
  cell('Ohio', '2026-01-10', 'Mumps', 4),
  cell('Ohio', '2026-01-17', 'Anthrax', 1),
  cell('Ohio', '2026-01-17', 'Mumps', 1),
  // the hierarchy: a census division and the national row file the SAME events again — set aside, never summed
  cell('West South Central', '2026-01-10', 'Mumps', 2, 'region'),
  cell('Total', '2026-01-10', 'Mumps', 6, 'total'),
  cell('Total', '2026-01-10', 'Anthrax', 40, 'total'), // would make an Anthrax–Mumps edge in Total's week 1 — must not
];

const SNAPSHOT: SnapshotProvenance = { source: 's', dataset: 'd', url: 'u', attribution: 'a', license: 'l', retrievedAt: '2026-09-02T00:00:00.000Z', rows: 12, sha256: 'ab'.repeat(32) };

/** The (source, target) tuple order the module promises — never a joined string, which is a different order once a label has a space. */
const before = (a: DiseaseEdge, b: DiseaseEdge): boolean => a.source < b.source || (a.source === b.source && a.target < b.target);

describe('diseaseGraph — the rule, counted by hand', () => {
  const g = diseaseGraph(CELLS);

  it('one node per disease in lexical order, with cases over present LEAF cells and the areas and weeks that reported', () => {
    expect(GRAPH_KINDS).toEqual(['state']);
    expect(g.nodes).toEqual([
      { disease: 'Anthrax', cases_total: 1, jurisdictions_reporting: 1, weeks_reporting: 1 }, // Total's 40 adds nothing
      { disease: 'Giardiasis', cases_total: 9, jurisdictions_reporting: 2, weeks_reporting: 2 },
      { disease: 'Mumps', cases_total: 7, jurisdictions_reporting: 2, weeks_reporting: 2 }, // the Texas dash adds 0 and reports nowhere; the region and Total rows add nothing
    ]);
  });

  it('one edge per pair that co-occurred, weighted by jurisdiction-weeks and areas; a silence, a dash and a roll-up make none; an absent pair is no row', () => {
    expect(g.edges).toEqual([
      // Ohio wk2 only — Total's week-1 Anthrax + Mumps is set aside
      { source: 'Anthrax', target: 'Mumps', weight: 1, jurisdictions: 1 },
      // Texas wk1, Ohio wk1 — Texas wk2 has Mumps at 0, so it does not count
      { source: 'Giardiasis', target: 'Mumps', weight: 2, jurisdictions: 2 },
    ]);
    // Anthrax × Giardiasis never shared a reporting jurisdiction-week: no edge, not a zero
    expect(g.edges.some((e) => e.source === 'Anthrax' && e.target === 'Giardiasis')).toBe(false);
  });

  it('source < target on every edge, and edges in (source, target) order', () => {
    for (const e of g.edges) expect(e.source < e.target).toBe(true);
    for (let i = 1; i < g.edges.length; i++) expect(before(g.edges[i - 1]!, g.edges[i]!)).toBe(true);
  });

  it('counts what it read: every cell, the roll-ups set aside, the repeats, and the leaf cells that could make an edge', () => {
    expect(g.counts).toEqual({ cells: 12, rollups: 3, repeats: 0, reporting: 7 });
  });

  it('is the same graph whatever order the cells arrive in', () => {
    const shuffled = [...CELLS].reverse();
    expect(diseaseGraph(shuffled)).toEqual(g);
  });

  it('a disease that only ever reported silences is still a node, with zeros', () => {
    const only = diseaseGraph([cell('Texas', '2026-01-10', 'Anthrax', null)]);
    expect(only.nodes).toEqual([{ disease: 'Anthrax', cases_total: 0, jurisdictions_reporting: 0, weeks_reporting: 0 }]);
    expect(only.edges).toEqual([]);
  });

  it('a disease seen only in roll-ups is not a node: the graph is over the leaves', () => {
    expect(diseaseGraph([cell('Total', '2026-01-10', 'Anthrax', 40, 'total')])).toEqual({ nodes: [], edges: [], counts: { cells: 1, rollups: 1, repeats: 0, reporting: 0 } });
  });

  it('a repeated cell is COUNTED, never silently merged: the tallies sum it twice, the pair weighs it once, and counts.repeats says so', () => {
    const twice = diseaseGraph([cell('Texas', '2026-01-10', 'Mumps', 3), cell('Texas', '2026-01-10', 'Mumps', 3), cell('Texas', '2026-01-10', 'Giardiasis', 1)]);
    expect(twice.nodes.find((n) => n.disease === 'Mumps')?.cases_total).toBe(6);
    expect(twice.edges).toEqual([{ source: 'Giardiasis', target: 'Mumps', weight: 1, jurisdictions: 1 }]);
    expect(twice.counts).toEqual({ cells: 3, rollups: 0, repeats: 1, reporting: 3 });
  });

  it('labels with spaces never collide: "A B"+"C" and "A"+"B C" are two pairs, and the edge order is the tuple order', () => {
    const spaced = diseaseGraph(['A B', 'C', 'A', 'B C'].map((d) => cell('Texas', '2026-01-10', d, 1)));
    expect(spaced.edges).toEqual([
      { source: 'A', target: 'A B', weight: 1, jurisdictions: 1 },
      { source: 'A', target: 'B C', weight: 1, jurisdictions: 1 },
      { source: 'A', target: 'C', weight: 1, jurisdictions: 1 },
      { source: 'A B', target: 'B C', weight: 1, jurisdictions: 1 },
      { source: 'A B', target: 'C', weight: 1, jurisdictions: 1 },
      { source: 'B C', target: 'C', weight: 1, jurisdictions: 1 },
    ]);
    for (let i = 1; i < spaced.edges.length; i++) expect(before(spaced.edges[i - 1]!, spaced.edges[i]!)).toBe(true);
    // the joined-string order is NOT the tuple order here — which is why the test above compares tuples
    const joined = spaced.edges.map((e) => `${e.source} ${e.target}`);
    expect(joined).not.toEqual([...joined].sort());
  });
});

describe('graphFiles — the bytes', () => {
  const fold = diseaseGraph(CELLS);

  it('writes the columns in order, quotes only what must be quoted, ends every file with one newline', () => {
    const files = graphFiles(fold, SNAPSHOT, 'scripts/graph-generate.ts');
    expect(files['nodes.csv']).toBe('disease,cases_total,jurisdictions_reporting,weeks_reporting\nAnthrax,1,1,1\nGiardiasis,9,2,2\nMumps,7,2,2\n');
    expect(files['edges.csv']).toBe('source,target,weight,jurisdictions\nAnthrax,Mumps,1,1\nGiardiasis,Mumps,2,2\n');
    expect(csvOf([{ name: 'Measles, Imported', n: 1 }, { name: 'say "hi"', n: 2 }], ['name', 'n'])).toBe('name,n\n"Measles, Imported",1\n"say ""hi""",2\n');
  });

  it("the provenance carries the snapshot's own fields and digest, the kinds walked, the rule in one sentence, the counts, the generator — and no clock", () => {
    const p = JSON.parse(graphFiles(fold, SNAPSHOT, 'scripts/graph-generate.ts')['PROVENANCE.json']) as Record<string, unknown>;
    expect(p['derivedFrom']).toEqual({ file: 'data/nndss/snapshot.csv', ...SNAPSHOT });
    expect(p['kinds']).toEqual(['state']);
    expect(p['rule']).toBe(GRAPH_RULE);
    expect(GRAPH_RULE).toMatch(/^over the leaf reporting areas only \(kind = state/);
    expect(p['counts']).toEqual({ nodes: 3, edges: 2, cellsRead: 12, cellsSetAside: 3, cellsWalked: 9, cellsRepeated: 0, cellsReporting: 7 });
    expect(p['generator']).toBe('scripts/graph-generate.ts');
    expect(Object.keys(p)).not.toContain('generatedAt');
    expect(JSON.stringify(p)).not.toMatch(/generatedAt|builtAt|wroteAt/);
  });

  it('two runs are the same bytes', () => {
    expect(graphFiles(diseaseGraph(CELLS), SNAPSHOT, 'g')).toEqual(graphFiles(diseaseGraph([...CELLS]), SNAPSHOT, 'g'));
  });

  it("the committed data/nndss/graph IS the generator's output over the committed snapshot, through the generator's own provenance reader", () => {
    const files = graphFiles(diseaseGraph(loadSnapshot().cells), snapshotProvenance(), 'scripts/graph-generate.ts');
    for (const name of ['nodes.csv', 'edges.csv', 'PROVENANCE.json'] as const) {
      expect(readFileSync(new URL(name, GRAPH_DIR), 'utf8')).toBe(files[name]);
    }
  });
});

describe('snapshotProvenance — the one reader of the fetcher\'s record', () => {
  it('repeats the seven fields and binds the derivation to the snapshot\'s bytes with a SHA-256 — clock-free, so two reads agree', () => {
    const p = snapshotProvenance();
    expect(p.sha256).toMatch(/^[0-9a-f]{64}$/);
    expect(p.rows).toBe(loadSnapshot().cells.length);
    expect(snapshotProvenance()).toEqual(p);
    // a different snapshot is a different digest, whatever its row count says
    const dir = mkdtempSync(join(tmpdir(), 'nndss-graph-'));
    const edited = join(dir, 'snapshot.csv');
    writeFileSync(edited, readFileSync(SNAPSHOT_CSV, 'utf8').replace(/\n[^\n]*$/, '\nx\n'));
    expect(snapshotProvenance(pathToFileURL(edited)).sha256).not.toBe(p.sha256);
  });

  it('refuses a fetcher record that lost a field, naming it', () => {
    const dir = mkdtempSync(join(tmpdir(), 'nndss-provenance-'));
    const record = join(dir, 'PROVENANCE.json');
    writeFileSync(record, JSON.stringify({ source: 's', dataset: 'd', url: 'u', attribution: 'a', license: 'l', retrievedAt: 'r', rows: 'many' }));
    expect(() => snapshotProvenance(SNAPSHOT_CSV, pathToFileURL(record))).toThrow('data/nndss/PROVENANCE.json: "rows" is not a number — re-run npm run data:fetch');
    writeFileSync(record, JSON.stringify({ source: 's', dataset: 'd', url: 'u', attribution: 'a', license: 'l', rows: 1 }));
    expect(() => snapshotProvenance(SNAPSHOT_CSV, pathToFileURL(record))).toThrow('data/nndss/PROVENANCE.json: "retrievedAt" is not a string — re-run npm run data:fetch');
  });
});

describe("loadGraph — the files read back in the def's shape", () => {
  it('fifteen diseases, keyed and numeric; every edge names two of them, source < target', () => {
    const g = loadGraph();
    expect(g.nodes).toHaveLength(15);
    const diseases = new Set(g.nodes.map((n) => n.disease));
    expect(g.nodes.map((n) => n.disease)).toEqual([...diseases].sort());
    for (const n of g.nodes) expect([typeof n.cases_total, typeof n.jurisdictions_reporting, typeof n.weeks_reporting]).toEqual(['number', 'number', 'number']);
    for (const e of g.edges) {
      expect(diseases.has(e.source) && diseases.has(e.target)).toBe(true);
      expect(e.source < e.target).toBe(true);
      expect(e.weight).toBeGreaterThan(0);
    }
  });

  it('the committed figures are over the leaf areas: no node counts more cases than the snapshot\'s state rows carry', () => {
    const states = loadSnapshot().cells.filter((c) => c.kind === 'state');
    const byDisease = new Map<string, number>();
    for (const c of states) if (c.cases !== null) byDisease.set(c.disease, (byDisease.get(c.disease) ?? 0) + c.cases);
    for (const n of loadGraph().nodes) expect(n.cases_total).toBe(byDisease.get(n.disease));
  });

  it('through the carrier: the same graph, and what the file system vouched for about each file', async () => {
    const { graph, sources } = await loadGraphAsync();
    expect(graph).toEqual(loadGraph());
    expect(sources['graph/nodes.csv']).toMatchObject({ format: 'csv', via: 'file', rows: 15 });
    expect(sources['graph/edges.csv']).toMatchObject({ format: 'csv', via: 'file', rows: graph.edges.length });
    expect(sources['graph/nodes.csv'].at).toMatch(/graph\/nodes\.csv$/);
  });

  it('refuses a drifted file by row and column, naming what was there', () => {
    expect(() => graphOf({ nodes: [{ disease: 'Mumps', cases_total: 'many', jurisdictions_reporting: 1, weeks_reporting: 1 }], edges: [] })).toThrow(
      'data/nndss/graph/nodes.csv row 1: "cases_total" is string "many", not a number — regenerate with npm run graph:generate',
    );
    expect(() => graphOf({ nodes: [], edges: [{ source: 'A', weight: 1, jurisdictions: 1 }] })).toThrow('data/nndss/graph/edges.csv row 1: "target" is missing, not a string');
  });
});
