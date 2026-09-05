/**
 * The dashboard's derivations (`web/src/derive.ts`) — the laws the cockpit's
 * honesty rests on, each one a defect this suite now pins:
 *
 *   · a commit's intent names the field the gesture was ACTUALLY on;
 *   · a link the person switched OFF moves nothing;
 *   · the bars are counted in one pass, whatever the number of bars;
 *   · a capped axis says so, and never lies about the total;
 *   · a note's bookmark anchor resolves by tag ID (and still by name);
 *   · what an answer NAMED and could not honour is said out loud, and the two
 *     reasons are said differently;
 *   · what a STORY SECTION cited and could not show is said the same way, with
 *     its three reasons told apart.
 *
 * The selections are built with the library's own `selectionForView`, over a
 * real link graph — the same call `App.tsx` makes — so an "off" link here is
 * off for exactly the reason it is off on screen.
 */
import { describe, expect, it } from 'vitest';
import { selectionForView, keepPredicate, type LinkEdgeView, type LinkGraphView, type SelectionView } from 'vizfootprint-ui';
import {
  arrivesFrom,
  capNote,
  categoryCounts,
  categorySums,
  columnVocabulary,
  emitIntent,
  droppedOf,
  noteRefs,
  pickedFrom,
  whyDroppedNote,
  storyDroppedNote,
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

describe('noteRefs — defect 10: a reply that cites a BEAT keeps the citation', () => {
  it('carries commit refs AND bookmark refs into the note', () => {
    expect(
      noteRefs([
        { span: [0, 3], commit: 'c7', label: '#c7' },
        { span: [5, 9], bookmark: 't1', label: 'the spike week' },
      ]),
    ).toEqual([
      { span: [0, 3], commit: 'c7', label: '#c7' },
      { span: [5, 9], bookmark: 't1', label: 'the spike week' },
    ]);
  });

  it('drops a ref that anchors nothing, and leaves absent keys ABSENT (never undefined on the wire)', () => {
    const out = noteRefs([{ span: [0, 1] }, { span: [2, 3], bookmark: 't2' }]);
    expect(out).toHaveLength(1);
    expect(Object.keys(out[0]!)).toEqual(['span', 'bookmark']);
    expect(noteRefs(undefined)).toEqual([]);
  });
});

describe('what an answer NAMED and could not honour is said, and the two reasons are DIFFERENT facts', () => {
  it('an off-branch commit says the log holds it — somewhere these words never stood', () => {
    expect(whyDroppedNote([{ id: 'c12', reason: 'off-branch' }])).toBe('named and not honoured — c12 is on another branch');
    expect(whyDroppedNote([{ id: 'c12', reason: 'off-branch' }, { id: 'c13', reason: 'off-branch' }])).toBe(
      'named and not honoured — c12, c13 are on another branch',
    );
  });

  it('an unverified commit says the log does not hold it — a different place to look', () => {
    expect(whyDroppedNote([{ id: 'ghost', reason: 'unverified' }])).toBe('named and not honoured — this log does not hold ghost');
  });

  it('both reasons in one answer stay TOLD APART — the whole point of the disclosure', () => {
    const note = whyDroppedNote([
      { id: 'c12', reason: 'off-branch' },
      { id: 'ghost', reason: 'unverified' },
    ]);
    expect(note).toBe('named and not honoured — c12 is on another branch; this log does not hold ghost');
    // and a third, unreadable reason joins them without contaminating either
    expect(whyDroppedNote([{ id: 'c12', reason: 'off-branch' }, { id: 'ghost', reason: 'unverified' }, { id: 'c9', reason: '?' }])).toBe(
      'named and not honoured — c12 is on another branch; this log does not hold ghost; c9, for a reason these words cannot read',
    );
    // and it neither offers a repair nor cites the commit it just declined to vouch for
    expect(note).not.toMatch(/seek|bring over|fix|click/i);
  });

  it('a reason NEITHER value covers names the commit, says the reason is unreadable, and STOPS', () => {
    const note = whyDroppedNote([{ id: 'c9', reason: 'something-new' }]);
    expect(note).toBe('named and not honoured — c9, for a reason these words cannot read');
    // the failure this disclosure exists to prevent is a GUESS, and a malformed
    // row is where one would be cheapest — so the clause claims nothing about
    // where the commit is, in either direction
    expect(note).not.toMatch(/branch|does not hold|not in|missing/i);
  });

  it('nothing to disclose costs nothing to say', () => {
    expect(whyDroppedNote(undefined)).toBeUndefined();
    expect(whyDroppedNote([])).toBeUndefined();
  });

  it('reads the disclosure off an untrusted tool result, and refuses to invent one', () => {
    expect(droppedOf({ ok: true, dropped: [{ id: 'c12', kind: 'basis', reason: 'off-branch' }] })).toEqual([{ id: 'c12', reason: 'off-branch' }]);
    expect(droppedOf({ ok: true })).toBeUndefined(); // an answer with nothing to disclose omits the key
    expect(droppedOf(undefined)).toBeUndefined();
    expect(droppedOf(null)).toBeUndefined();
    expect(droppedOf({ dropped: 'c12' })).toBeUndefined(); // not a list
    expect(droppedOf({ dropped: [null, 7, { id: 'c12' }, { reason: 'off-branch' }] })).toBeUndefined(); // no readable row
    expect(droppedOf({ dropped: [{ id: 'c12', reason: 'off-branch' }, { id: 7 }] })).toEqual([{ id: 'c12', reason: 'off-branch' }]);
  });
});

describe('what a STORY cited and could not show is said, and the three reasons are DIFFERENT facts', () => {
  it('a citation on another path says the session holds it — on a lineage this story does not tell', () => {
    expect(storyDroppedNote([{ reason: 'off-path', commit: '9', label: 'the detour' }])).toBe('cited and not shown — "the detour" (9) is on another path');
    expect(storyDroppedNote([{ reason: 'off-path', commit: '9' }, { reason: 'off-path', bookmark: 'b3', label: 'Elsewhere' }])).toBe(
      'cited and not shown — 9, "Elsewhere" (b3) are on another path',
    );
  });

  it('a citation past the last bookmark says so — it is on THIS lineage, and a bookmark there would tell it', () => {
    expect(storyDroppedNote([{ reason: 'untold', commit: '8', label: 'later' }])).toBe('cited and not shown — "later" (8) is past the last bookmark');
  });

  it('a citation the session no longer holds is a different place to look again', () => {
    expect(storyDroppedNote([{ reason: 'not-held', saved: 'p9', label: 'coastal' }])).toBe('cited and not shown — this session no longer holds "coastal" (p9)');
  });

  it('all three in one section stay TOLD APART — the whole point of the disclosure', () => {
    const note = storyDroppedNote([
      { reason: 'off-path', commit: '9', label: 'the detour' },
      { reason: 'untold', commit: '8' },
      { reason: 'not-held', bookmark: 'b9', label: 'forgotten' },
    ]);
    expect(note).toBe('cited and not shown — "the detour" (9) is on another path; 8 is past the last bookmark; this session no longer holds "forgotten" (b9)');
    // and it neither offers a repair nor links what it just declined to vouch for
    expect(note).not.toMatch(/seek|bring over|fix|click|go to/i);
  });

  it('a reason NONE of the three covers names the citation, says the reason is unreadable, and STOPS', () => {
    const note = storyDroppedNote([{ reason: 'something-new', commit: 'c9' }]);
    expect(note).toBe('cited and not shown — c9, for a reason these words cannot read');
    // a malformed row is where a guess would be cheapest, so the clause claims nothing about WHERE it is
    expect(note).not.toMatch(/path|bookmark|no longer|does not hold|missing/i);
    // and it joins the readable ones without contaminating them
    expect(storyDroppedNote([{ reason: 'off-path', commit: '9' }, { reason: '?', commit: 'c9' }])).toBe(
      'cited and not shown — 9 is on another path; c9, for a reason these words cannot read',
    );
  });

  it('an empty label is the ID alone — an anchor that showed no words gets none put in its mouth', () => {
    expect(storyDroppedNote([{ reason: 'not-held', bookmark: 'b9', label: '' }])).toBe('cited and not shown — this session no longer holds b9');
  });

  it('nothing to disclose costs nothing to say', () => {
    expect(storyDroppedNote(undefined)).toBeUndefined();
    expect(storyDroppedNote([])).toBeUndefined();
  });
});
