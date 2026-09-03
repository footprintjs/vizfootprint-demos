/**
 * The dashboard's derivations (`web/src/derive.ts`) — the laws the cockpit's
 * honesty rests on, each one a defect this suite now pins:
 *
 *   · a commit's intent names the field the gesture was ACTUALLY on;
 *   · a link the person switched OFF moves nothing;
 *   · the bars are counted in one pass, whatever the number of bars;
 *   · a capped axis says so, and never lies about the total;
 *   · a note's beat anchor resolves by tag ID (and still by name).
 *
 * The selections are built with the library's own `selectionForView`, over a
 * real link graph — the same call `App.tsx` makes — so an "off" link here is
 * off for exactly the reason it is off on screen.
 */
import { describe, expect, it } from 'vitest';
import { selectionForView, keepPredicate, type LinkEdgeView, type LinkGraphView, type SelectionView } from 'vizfootprint-ui';
import {
  arrivesFrom,
  beatCommitId,
  capNote,
  categoryCounts,
  categorySums,
  columnVocabulary,
  emitIntent,
  noteRefs,
  pickedFrom,
  type Row,
} from '../web/src/derive.js';

// one live clause: the diseases bar holds "Pertussis" on the disease column
const PICKED_DISEASE: SelectionView = { viewId: 'diseases', kind: 'point', field: 'disease', value: 'Pertussis', commitId: 'c1' };
const PICKED_KIND: SelectionView = { viewId: 'kinds', kind: 'point', field: 'kind', value: 'region', commitId: 'c2' };

/** One edge of the graph, spelled the way the wire spells it. */
const edge = (source: string, target: string, response: LinkEdgeView['response']): LinkEdgeView => ({
  id: `${source}->${target}`,
  source,
  target,
  kind: 'point',
  response,
  origin: 'edited',
});
/** The materialized link graph the demo reads (`state.links`). */
const graph = (...edges: readonly LinkEdgeView[]): LinkGraphView => ({ default: 'crossfilter', views: [], edges });

const CELLS: Row[] = [
  { jurisdiction: 'Texas', kind: 'state', disease: 'Pertussis', cases: 10, report_state: 'present' },
  { jurisdiction: 'Texas', kind: 'state', disease: 'Measles', cases: 4, report_state: 'present' },
  { jurisdiction: 'Ohio', kind: 'state', disease: 'Pertussis', cases: 7, report_state: 'present' },
  { jurisdiction: 'Ohio', kind: 'state', disease: 'Measles', cases: null, report_state: 'unavailable' },
  { jurisdiction: 'Midwest', kind: 'region', disease: 'Pertussis', cases: 21, report_state: 'present' },
  { jurisdiction: 'Nowhere', kind: null, disease: 'Pertussis', cases: 1, report_state: 'withheld' },
];

describe('emitIntent — defect 2: the log must not record a false cause', () => {
  it('names the field the emission is on, not one written at build time', () => {
    // the disease bar, re-encoded to jurisdictions: a click picks TEXAS
    expect(emitIntent('pick', { encoding: { field: 'jurisdiction' } })).toBe('pick jurisdiction');
    expect(emitIntent('pick', { encoding: { field: 'disease' } })).toBe('pick disease');
    expect(emitIntent('brush', { encoding: { field: 't' } })).toBe('brush t');
  });

  it('names BOTH fields of a compound cell gesture', () => {
    expect(emitIntent('select', { encoding: { fields: ['price', 'category'] } })).toBe('select price and category');
  });

  it('an emission naming no field leaves the verb alone rather than inventing a subject', () => {
    expect(emitIntent('select', { encoding: {} })).toBe('select');
  });
});

describe('pickedFrom / arrivesFrom — defect 7: a link set to "none" is ignored', () => {
  it('reads the clause when it REACHES the view (a filter edge)', () => {
    const sel = selectionForView([PICKED_DISEASE], 'map', 'intersect', graph(edge('diseases', 'map', 'filter')));
    expect(pickedFrom(sel, 'diseases', 'disease', 'Measles')).toBe('Pertussis');
  });

  it('does NOT read it when the link is off — the map keeps its default', () => {
    const off = selectionForView([PICKED_DISEASE], 'map', 'intersect', graph(edge('diseases', 'map', 'none')));
    expect(pickedFrom(off, 'diseases', 'disease', 'Measles'), 'a link the person turned off moves nothing').toBe('Measles');
    // and the fold agrees — the value and the predicate can never disagree again
    expect(keepPredicate(off)(CELLS[1]!)).toBe(true);

    // no edge at all is the same answer
    const none = selectionForView([PICKED_DISEASE], 'map', 'intersect', graph());
    expect(pickedFrom(none, 'diseases', 'disease', 'Measles')).toBe('Measles');
  });

  it('a clause that arrives to HIGHLIGHT does not hard-filter the view either', () => {
    const bright = selectionForView([PICKED_DISEASE], 'map', 'intersect', graph(edge('diseases', 'map', 'highlight')));
    expect(pickedFrom(bright, 'diseases', 'disease', 'Measles')).toBe('Measles');
  });

  it('the clause must be ON the field asked for — a re-encoded bar names a STATE, not a disease', () => {
    const onJurisdiction: SelectionView = { viewId: 'diseases', kind: 'point', field: 'jurisdiction', value: 'Texas', commitId: 'c9' };
    const sel = selectionForView([onJurisdiction], 'map', 'intersect', graph(edge('diseases', 'map', 'filter')));
    expect(pickedFrom(sel, 'diseases', 'disease', 'Pertussis'), '"Texas" is not a disease').toBe('Pertussis');
  });

  it('a view reads its OWN clause (the source names what it picked)', () => {
    const own = selectionForView([PICKED_DISEASE], 'diseases', 'intersect', graph());
    expect(pickedFrom(own, 'diseases', 'disease', 'Measles')).toBe('Pertussis');
  });

  it('a non-string point value falls back rather than being stringified', () => {
    const numeric: SelectionView = { viewId: 'diseases', kind: 'point', field: 'disease', value: 42, commitId: 'c8' };
    const sel = selectionForView([numeric], 'diseases', 'intersect', graph());
    expect(pickedFrom(sel, 'diseases', 'disease', 'Pertussis')).toBe('Pertussis');
  });

  it('arrivesFrom answers "has an area been chosen HERE?" through the same door', () => {
    const on = selectionForView([PICKED_KIND], 'trend', 'intersect', graph(edge('kinds', 'trend', 'filter')));
    expect(arrivesFrom(on, ['kinds', 'table', 'map'])).toBe(true);
    expect(arrivesFrom(on, ['table', 'map'])).toBe(false);
    const off = selectionForView([PICKED_KIND], 'trend', 'intersect', graph(edge('kinds', 'trend', 'none')));
    expect(arrivesFrom(off, ['kinds', 'table', 'map'])).toBe(false);
  });

  it('an IS-NULL clause is live, a cleared one is not', () => {
    const isNull = selectionForView([{ viewId: 'kinds', kind: 'point', field: 'kind', value: null, commitId: 'c3' }], 'kinds', 'intersect', graph());
    expect(arrivesFrom(isNull, ['kinds']), 'null means IS NULL — a real clause, but not an area chosen').toBe(false);
  });
});

describe('categoryCounts / categorySums — defect 8: one pass, not one pass per bar', () => {
  const keepAll = (): boolean => true;

  it('counts every category in one pass and keeps a DECLARED vocabulary (zeros included)', () => {
    const counts = categoryCounts(CELLS, 'kind', keepAll, ['state', 'region', 'total']);
    expect(counts).toEqual([
      { category: 'state', count: 4 },
      { category: 'region', count: 1 },
      { category: 'total', count: 0 }, // declared, never reported — the zero is honest
    ]);
  });

  it('a null is an absence, not a category — it never gets a bar', () => {
    const counts = categoryCounts(CELLS, 'kind', keepAll);
    expect(counts.map((c) => c.category)).toEqual(['state', 'region']); // the `kind: null` row is not a bar
  });

  it('honours the keep-predicate, and gives the same answer as the filter-per-bar it replaced', () => {
    const keep = (r: Row): boolean => r['jurisdiction'] === 'Texas';
    const fast = categoryCounts(CELLS, 'disease', keep);
    const slow = ['Pertussis', 'Measles'].map((category) => ({
      category,
      count: CELLS.filter((r) => String(r['disease']) === category && keep(r)).length,
    }));
    expect(fast).toEqual(slow);
  });

  it('sums a measure in one pass, skipping absent values (a silence is never a zero)', () => {
    const sums = categorySums(CELLS, 'disease', 'cases', (r) => r['kind'] === 'state');
    expect(sums.get('Pertussis')).toBe(17); // 10 + 7
    expect(sums.get('Measles')).toBe(4); // the null cell adds nothing…
    expect(categorySums(CELLS, 'disease', 'cases', (r) => r['jurisdiction'] === 'Ohio').get('Measles')).toBeUndefined(); // …and alone, leaves no bar at all
  });
});

describe('columnVocabulary / capNote — defect 8: a 900-value column is not a bar chart', () => {
  const wide: Row[] = Array.from({ length: 900 }, (_, i) => ({ id: `v${String(i)}` }));

  it('caps the drawn values but never the count it reports', () => {
    const v = columnVocabulary(wide, 'id', 60);
    expect(v.values).toHaveLength(60);
    expect(v.values[0]).toBe('v0'); // first-seen order
    expect(v.total).toBe(900);
    expect(v.capped).toBe(true);
    expect(capNote(v, 'id')).toBe('showing the first 60 of 900 id values');
    // …and when fewer bars than that reached the screen (a category with no
    // reported cell gets none), it says the DRAWN count, not the cap
    expect(capNote(v, 'id', 50)).toBe('showing 50 of 900 id values — the axis takes the first 60, and 10 of those have no cell to draw');
    expect(capNote(v, 'id', 60)).toBe('showing the first 60 of 900 id values');
  });

  it('says nothing when the cap does not bite', () => {
    const v = columnVocabulary(CELLS, 'disease');
    expect(v).toEqual({ values: ['Pertussis', 'Measles'], total: 2, capped: false });
    expect(capNote(v, 'disease')).toBe(null);
    expect(capNote(v, 'disease', 1), 'the cap is what this line is about — a silence is the caption\'s business').toBe(null);
  });

  it('a null value is never a category', () => {
    expect(columnVocabulary(CELLS, 'kind').values).toEqual(['state', 'region']);
  });
});

describe('beatCommitId — defect 9: a note links a tag by ID, not by name', () => {
  const CHECKPOINTS = [
    { id: 't1', label: 'the spike week', commitId: 'c7', ts: 1 },
    { label: 'an older beat', commitId: 'c3', ts: 2 }, // a wire that predates tag ids
  ];

  it('resolves the tag ID a note actually carries', () => {
    expect(beatCommitId(CHECKPOINTS, 't1')).toBe('c7');
  });

  it('still resolves a NAME, so notes written before tag ids keep working', () => {
    expect(beatCommitId(CHECKPOINTS, 'an older beat')).toBe('c3');
    expect(beatCommitId(CHECKPOINTS, 'the spike week')).toBe('c7');
  });

  it('an id wins over a same-named label, and an unknown ref resolves to nothing (a click that does nothing, never a wrong seek)', () => {
    expect(beatCommitId([{ id: 't2', label: 't1', commitId: 'cA', ts: 1 }, { id: 't1', label: 'x', commitId: 'cB', ts: 2 }], 't1')).toBe('cB');
    expect(beatCommitId(CHECKPOINTS, 't9')).toBe(null);
    expect(beatCommitId([{ id: 't1', label: 'floating', commitId: null, ts: 1 }], 't1')).toBe(null);
  });
});

describe('noteRefs — defect 10: a reply that cites a BEAT keeps the citation', () => {
  it('carries commit refs AND beat refs into the note', () => {
    expect(
      noteRefs([
        { span: [0, 3], commit: 'c7', label: '#c7' },
        { span: [5, 9], beat: 't1', label: 'the spike week' },
      ]),
    ).toEqual([
      { span: [0, 3], commit: 'c7', label: '#c7' },
      { span: [5, 9], beat: 't1', label: 'the spike week' },
    ]);
  });

  it('drops a ref that anchors nothing, and leaves absent keys ABSENT (never undefined on the wire)', () => {
    const out = noteRefs([{ span: [0, 1] }, { span: [2, 3], beat: 't2' }]);
    expect(out).toHaveLength(1);
    expect(Object.keys(out[0]!)).toEqual(['span', 'beat']);
    expect(noteRefs(undefined)).toEqual([]);
  });
});
