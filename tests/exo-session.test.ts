/**
 * THE EXOPLANET SURFACE — five acts, landed, and what they leave behind.
 *
 * This is the test that matters for the demo's claim. Nothing about a spread, a
 * disagreement or a delta is in the committed CSVs; all of it is the output of
 * acts this def declares and this surface dispatches. So these pin:
 *
 *   - that all five land, in order, as commits on the log;
 *   - that the aggregate mints a TABLE, one row per planet with a published
 *     radius — a count that is NOT the planet count, and the difference is the
 *     silence the histogram's caption has to name;
 *   - that the two derives write onto that minted table;
 *   - that the bring-over carries the composite's accepted radius across the
 *     declared relation, and the delta subtracts it — checked against ONE named
 *     planet whose numbers a person can look up;
 *   - that a bound answers NOTHING, because the delta's own declaration says so;
 *   - and that the built dashboard's data checks are clean.
 *
 * It runs over the REAL committed slice: 20,598 rows through five acts is what
 * the page does on entry, and a test over a fixture would not have caught the
 * one thing worth catching here.
 */
import { describe, expect, it } from 'vitest';
import { edgesFrom, edgesInto, layerAddress } from 'vizfootprint/def';
import { exportFromSession } from 'vizfootprint/session';
import { createSessionView, sessionSource } from 'vizfootprint-ui';
import { ACCEPTED_RADIUS_COLUMN, BY_YEAR_ADDRESS, BY_YEAR_VIEW, DELTA_COLUMN, DISAGREES_COLUMN, EXO_ACT_ORDER, EXO_VIEWS, RADII_PER_PLANET, SCATTER_ADDRESS, SHEET_VIEW, SPREAD_ADDRESS, SPREAD_COLUMN, SPREAD_VIEW, exoDef } from '../src/exo/def.js';
import { SPREAD_BUCKET } from '../src/exo/session.js';
import { buildExoSurfaceAsync } from '../src/exo/surface.js';
import { exoRows } from '../src/exo/rows.js';
import { loadExo } from '../src/exo/snapshot.js';

/** ONE planet a person can look up: three published radii in the slice, and a composite that matches none of them exactly. */
const PLANET = 'TRAPPIST-1 e';

const tables = loadExo();
/**
 * The name a reader sees the histogram called in the library's own sentence —
 * READ OFF THE DEF, never retyped: `ReachingClause.fromLabel` resolves the
 * declared label at the acting address, and the acting address is the layer.
 */
const SPREAD_LAYER_LABEL = exoDef(tables).encodings?.find((e) => e.viewId === SPREAD_VIEW)?.layers?.[0]?.label;
const surface = await buildExoSurfaceAsync(tables);

describe('the five acts land as commits, and nothing refuses', () => {
  it('refuses nothing, and the data checks are clean', async () => {
    expect(surface.actRefusals).toEqual([]);
    expect(await surface.dashboard.lintData()).toEqual([]);
  });

  it('every act is on the log, in the order the def declares them', () => {
    // an analyze commit is recorded under `analysis:<id>` — the log's own spelling
    const analyses = surface.session.log.records.filter((c) => c.viewId.startsWith('analysis:'));
    expect(analyses.map((c) => c.viewId)).toEqual(EXO_ACT_ORDER.map((a) => `analysis:${a.id}`));
    expect(analyses.length).toBe(EXO_ACT_ORDER.length);
    // the cause's intent is the def's own sentence, so the ledger and the definition cannot drift
    expect(analyses.map((c) => c.cause?.intent)).toEqual(EXO_ACT_ORDER.map((a) => a.intent));
  });
});

describe('the aggregate mints a table the data does not have', () => {
  it('one row per planet WITH a published radius — fewer than the planets, and that gap is the silence', () => {
    const rows = surface.derived.rows;
    expect(surface.derived.refused).toBeNull();
    const withRadius = new Set(tables.measurements.filter((m) => m.radius_state === 'present').map((m) => m.pl_name));
    expect(rows.length).toBe(withRadius.size);
    // …and it is NOT the planet count: the planets with no published radius are in no bar at all
    expect(rows.length).toBeLessThan(tables.planets.length);
    expect(tables.planets.length - rows.length).toBeGreaterThan(0);
  });

  it('carries the four measures and the two derived columns on every row', () => {
    const row = surface.derived.rows.find((r) => r['pl_name'] === PLANET);
    expect(row).toBeDefined();
    expect(Object.keys(row ?? {}).sort()).toEqual(['disagrees', 'pl_name', 'r_max', 'r_min', 'radii', 'refs', 'spread'].sort());
  });

  it('the spread is the largest published radius minus the smallest, and `disagrees` is that width above zero', () => {
    const published = tables.measurements.filter((m) => m.pl_name === PLANET && m.radius_state === 'present').map((m) => Number(m.pl_rade));
    expect(published.length).toBeGreaterThan(1);
    const row = surface.derived.rows.find((r) => r['pl_name'] === PLANET);
    expect(row?.['radii']).toBe(published.length);
    expect(row?.['r_min']).toBe(Math.min(...published));
    expect(row?.['r_max']).toBe(Math.max(...published));
    expect(Number(row?.[SPREAD_COLUMN])).toBeCloseTo(Math.max(...published) - Math.min(...published), 10);
    expect(row?.[DISAGREES_COLUMN]).toBe(Math.max(...published) > Math.min(...published));
  });

  it('every planet in the minted table disagrees with itself, or has exactly one radius', () => {
    // a fact about the DATA, read off the act's own output: a planet with one published
    // radius cannot disagree, and one with several almost always does
    const single = surface.derived.rows.filter((r) => r['radii'] === 1);
    expect(single.every((r) => r[DISAGREES_COLUMN] === false && r[SPREAD_COLUMN] === 0)).toBe(true);
    const several = surface.derived.rows.filter((r) => Number(r['radii']) > 1);
    expect(several.length).toBeGreaterThan(1000);
  });
});

describe('the bring-over and the delta put the two numbers side by side', () => {
  /** The whole table at the cursor — `viewId: null` is "no clause at all", the only honest way to read every row. */
  const wholeTable = async (): Promise<readonly Record<string, unknown>[]> => {
    const window = await surface.session.viewQuery({ table: 'measurements', viewId: null, limit: tables.measurements.length });
    expect(window.ok).toBe(true);
    return window.ok ? window.rows : [];
  };

  it('carries the accepted radius onto every measurement row, under the name the library produces', async () => {
    const rows = (await wholeTable()).filter((r) => r['pl_name'] === PLANET);
    expect(rows.length).toBeGreaterThan(2);
    const accepted = tables.planets.find((p) => p.pl_name === PLANET)?.pl_rade;
    expect(typeof accepted).toBe('number');
    expect(rows.every((r) => r[ACCEPTED_RADIUS_COLUMN] === accepted)).toBe(true);
  });

  it('the delta is this publication\'s radius minus the accepted one — and NOTHING where the radius is not a measurement', async () => {
    const rows = (await wholeTable()).filter((r) => r['pl_name'] === PLANET);
    const accepted = Number(tables.planets.find((p) => p.pl_name === PLANET)?.pl_rade);
    for (const row of rows) {
      if (row['radius_state'] === 'present') expect(Number(row[DELTA_COLUMN])).toBeCloseTo(Number(row['pl_rade']) - accepted, 10);
      else expect(row[DELTA_COLUMN]).toBeNull();
    }
    // at least one publication really does disagree with the accepted value
    expect(rows.some((r) => typeof r[DELTA_COLUMN] === 'number' && r[DELTA_COLUMN] !== 0)).toBe(true);
  });

  it('a BOUND keeps its number and still gets no delta — the declaration says so, not a law nobody can see', async () => {
    const bounded = tables.measurements.find((m) => m.radius_state === 'limit');
    expect(bounded?.pl_rade).toBeTypeOf('number');
    const row = (await wholeTable()).find((r) => r['measurement_id'] === bounded?.measurement_id);
    expect(row?.['pl_rade']).toBe(bounded?.pl_rade);
    expect(row?.[DELTA_COLUMN]).toBeNull();
  });
});

describe('the declared link is what fills the sheet', () => {
  it('a planet picked on the scatter is whose publications the sheet lists — and clearing it gives them all back', async () => {
    const cause = { requestedBy: 'user' as const, computedBy: 'user' as const, intent: `read every published value for ${PLANET}` };
    const picked = await surface.session.dispatch({ verb: 'select', viewId: SCATTER_ADDRESS, field: 'pl_name', value: PLANET, cause });
    expect(picked.ok).toBe(true);
    const sheet = await surface.session.viewQuery({ viewId: SHEET_VIEW, table: 'measurements', limit: 100 });
    expect(sheet.ok).toBe(true);
    const rows = sheet.ok ? sheet.rows : [];
    expect(rows.length).toBeGreaterThan(2);
    expect(new Set(rows.map((r) => r['pl_name']))).toEqual(new Set([PLANET]));
    // the sheet reads its window through the LINK GRAPH, and the link that delivered it is the declared one
    expect(sheet.ok && sheet.clauses.some((c) => c.from === SCATTER_ADDRESS && c.response === 'filter')).toBe(true);
    await surface.session.dispatch({ verb: 'select', viewId: SCATTER_ADDRESS, field: 'pl_name', value: null, cause: { ...cause, intent: 'clear the planet' } });
    const all = await surface.session.viewQuery({ viewId: SHEET_VIEW, table: 'measurements', limit: 5 });
    expect(all.ok && all.count).toBe(tables.measurements.length);
  });
});

describe('the histogram over a table an ACT mints — refused before it, landing after it', () => {
  it('the boot collects the library\'s own refusal, and it names the act as the repair', () => {
    // the sentence is the library's, kept verbatim: the view, the table, and the act to perform
    expect(surface.mintedTableRefusal).toBe(`view "${SPREAD_ADDRESS}" draws "${RADII_PER_PLANET}", which the act "radiiPerPlanet" mints — it has not landed on this path`);
    // it landed NOTHING: the log a reader walks holds the five acts and no sixth commit
    expect(surface.session.log.records.filter((r) => r.viewId === SPREAD_ADDRESS)).toEqual([]);
  });

  it('the same gesture LANDS once the act has, and the sheet NARROWS its clause instead of dying on it', async () => {
    const gesture = { verb: 'filter' as const, viewId: SPREAD_ADDRESS, field: 'radii', range: [...SPREAD_BUCKET] as [number, number] };
    const landed = await surface.session.dispatch({ ...gesture, cause: { requestedBy: 'user' as const, computedBy: 'user' as const, intent: 'the planets with one published radius' } });
    expect(landed.ok).toBe(true);

    // The demo declares NO edge out of the histogram, so the crossfilter default carries the
    // bucket to the sheet — and the clause names `radii`, which `measurements` has not got.
    // This used to be the break the demo worked around with ten `response: 'none'` edges: the
    // engine refused the WHOLE read. It now narrows the one clause it cannot judge and reports it.
    const reaching = surface.session.clausesFor(SHEET_VIEW);
    expect(reaching.map((c) => c.from)).toEqual([SPREAD_ADDRESS]);

    const sheet = await surface.session.viewQuery({ viewId: SHEET_VIEW, table: 'measurements', limit: 3 });
    expect(sheet.ok).toBe(true);
    // it filtered NOTHING: every row of the table is still in the window's count
    expect(sheet.ok && sheet.count).toBe(tables.measurements.length);
    // …and the clause is still LISTED, narrowed, naming the column and the DECLARED label of the
    // acting layer — so a reader is told what was ignored rather than left with a silent full table
    const narrowed = sheet.ok ? sheet.clauses.find((c) => c.from === SPREAD_ADDRESS) : undefined;
    expect(narrowed?.narrowed?.column).toBe('radii');
    expect(narrowed?.narrowed?.reason).toBe('table "measurements" has no column "radii" — a sentence about a column these rows do not have is not a claim about these rows');
    expect(narrowed?.fromLabel).toBe(SPREAD_LAYER_LABEL);
    // Those two are the whole of what the sheet's own status line prints — the library's grid
    // composes `the selection from <fromLabel> filtered nothing here \u00b7 <reason>` from them
    // (`vizfootprint-ui` · `narrowedSaid`, reachable only through the Sheet the desk renders, which
    // is why the composition itself cannot be pinned from here). `src/exo/README.md` quotes the
    // finished line; these two assertions are what keep that quote from rotting.

    // AND THE EXPORT WALKS. This is the door the demo LOST when the read was refused outright:
    // a receipt is a read, so a clause it cannot judge must narrow there too, not kill it.
    const exported = await exportFromSession(surface.session, { table: 'measurements', viewId: SHEET_VIEW, format: 'csv' });
    expect(exported.ok).toBe(true);
    expect(exported.ok && exported.receipt.exported.rows).toBe(tables.measurements.length);
    // the receipt carries the narrowing too — and deliberately not the declared label, which a
    // def can rename (`vizfootprint` · `src/session/export.ts`)
    const onReceipt = exported.ok ? exported.receipt.clauses?.find((c) => c.from === SPREAD_ADDRESS) : undefined;
    expect(onReceipt?.narrowed?.column).toBe('radii');
    expect(onReceipt?.fromLabel).toBeUndefined();

    await surface.session.dispatch({ ...gesture, range: null, cause: { requestedBy: 'user' as const, computedBy: 'user' as const, intent: 'clear the bucket' } });
  });

  it('the overview SAYS where the brush filtered nothing — per consumer, in the def\'s own names — and the two doors agree on which (packets AH, AH2)', async () => {
    const gesture = { verb: 'filter' as const, viewId: SPREAD_ADDRESS, field: 'radii', range: [...SPREAD_BUCKET] as [number, number] };
    const cause = { requestedBy: 'user' as const, computedBy: 'user' as const, intent: 'the planets with one published radius' };
    expect((await surface.session.dispatch({ ...gesture, cause })).ok).toBe(true);

    // ONE live selection, from the histogram's layer — the address the brush landed at
    const { activeSelections } = await surface.session.overview();
    expect(activeSelections.map((s) => s.viewId)).toEqual([SPREAD_ADDRESS]);
    const narrowedFor = activeSelections[0]?.narrowedFor;

    // THE OBJECT, VERBATIM — printed once off the real desk after this gesture, then pinned (packet AH; re-pinned
    // under AJ, "the frame is its layers", packet AH2). WHY these TWO consumers and no view id among them: a
    // layered view with no view-level `initial` is a FRAME on the link map, not a node that reads rows, so the
    // crossfilter default mints no edge into `mass_radius` or `by_year` and no clause ever arrives there — the
    // only readers are the layer over `planets` and the sheet over `measurements`. (Before AJ the two frames
    // stood as nodes over the default table and answered for `measurements`, a table neither chart draws — the
    // very sentence AJ closed.) `by_year~references` is absent for a different reason, pinned below: the map
    // DECLINED that edge. The reason is the library's own sentence (`unjudgeableWords`, quoted, never re-worded),
    // and the label is the consumer's DECLARED name by the library's one resolver (`vizfootprint` ·
    // `src/session/layers.ts` · `labelAt`: a layer's `label`, else the view's actor label) — the def's words,
    // never a name a tier resolved for itself. Absent everywhere the clause was judged, so `spread` and
    // `spread~buckets` have no entry either.
    const reason = (table: string): string => `table "${table}" has no column "radii" — a sentence about a column these rows do not have is not a claim about these rows`;
    expect(narrowedFor).toEqual({
      [SCATTER_ADDRESS]: { column: 'radii', reason: reason('planets'), label: 'Planets, as the composite table accepts them' },
      [SHEET_VIEW]: { column: 'radii', reason: reason('measurements'), label: 'Every published value' },
    });
    expect(Object.keys(narrowedFor ?? {})).toEqual([SCATTER_ADDRESS, SHEET_VIEW]);

    // …and every one of those labels IS the def's declaration at that address, read off the def rather than
    // retyped — a layer's own `label`, a view's actor `label` — so the literal above cannot outlive a rename.
    const def = exoDef(tables);
    const declared = new Map<string, string | undefined>(EXO_VIEWS.map((viewId) => [viewId, def.actors?.[viewId]?.label]));
    for (const e of def.encodings ?? []) for (const l of e.layers ?? []) declared.set(layerAddress(e.viewId, l.layerId), l.label);
    for (const [address, at] of Object.entries(narrowedFor ?? {})) expect(at.label, address).toBe(declared.get(address));

    // THE TWO DOORS AGREE (the AG review's law, on real data): the set of consumers the OVERVIEW names is
    // exactly the set of addresses on the map that the graph SENDS this clause to (`clausesFor`, never
    // narrowed — a pure function of the graph) AND whose READ door reports it `narrowed` (`viewQuery`, the
    // engine's judgement at that table). Every address the def declares is walked — the views and their layers.
    const addresses = [...declared.keys()];
    const narrowedAtRead: string[] = [];
    for (const address of addresses) {
      const sent = surface.session.clausesFor(address).some((c) => c.from === SPREAD_ADDRESS);
      const window = await surface.session.viewQuery({ viewId: address, limit: 1 });
      expect(window.ok, address).toBe(true);
      const narrowed = window.ok && window.clauses.some((c) => c.from === SPREAD_ADDRESS && c.narrowed !== undefined);
      if (sent && narrowed) narrowedAtRead.push(address);
    }
    expect(new Set(Object.keys(narrowedFor ?? {}))).toEqual(new Set(narrowedAtRead));

    // THE WIRE. This desk has no served door — `server/` holds the CDC and grid desks only — and its one host
    // is the static page, which hands the studio desk an IN-PROCESS session view (`web/site/exo/entry.tsx` ·
    // `createSessionView(sessionSource(session))`). So the wire to pin is that adapter: the selection it hands
    // the desk carries `narrowedFor` byte-identical to the session's, entry by entry, label included
    // (`vizfootprint-ui` · `sessionView.ts` · `narrowedForOf`). It is the same `mapSelections` a polled
    // `/api/state` would pass through, so a served twin, if one is ever built, inherits this proof.
    const view = createSessionView(sessionSource(surface.session), { as: 'user' });
    await view.refresh();
    const served = view.getState().selections;
    expect(served.map((s) => s.viewId)).toEqual([SPREAD_ADDRESS]);
    expect(JSON.stringify(served[0]?.narrowedFor)).toBe(JSON.stringify(narrowedFor));

    await surface.session.dispatch({ ...gesture, range: null, cause: { ...cause, intent: 'clear the bucket' } });
  });

  it('the bar chart never hears the bucket — the map DECLINED that edge, and says why in its own words (packet AH2)', async () => {
    const gesture = { verb: 'filter' as const, viewId: SPREAD_ADDRESS, field: 'radii', range: [...SPREAD_BUCKET] as [number, number] };
    const cause = { requestedBy: 'user' as const, computedBy: 'user' as const, intent: 'the planets with one published radius' };
    expect((await surface.session.dispatch({ ...gesture, cause })).ok).toBe(true);

    // NOTHING reaches the years — not at the layer, and not at the frame either (a frame is not a node)
    expect(surface.session.clausesFor(BY_YEAR_ADDRESS)).toEqual([]);
    expect(surface.session.clausesFor(BY_YEAR_VIEW)).toEqual([]);

    // WHY: the crossfilter default reaches only an address whose table the clause COULD be judged at, and no
    // relation joins `radii_per_planet` (minted by the aggregate act) and `references`, nor do they share a
    // column — so the reach law declined the edge and RECORDED it under `links.declined` (`vizfootprint/links`
    // · `materialize.ts`), with the sentence `unreachableWords` composes. Pinned verbatim, because that sentence
    // is the one honest reading of why the bar chart stands still under the brush: it never filtered anything
    // by it, rather than filtering and being narrowed.
    const { links } = await surface.session.overview();
    const declined = links.declined?.find((d) => d.source === SPREAD_ADDRESS && d.target === BY_YEAR_ADDRESS);
    expect(declined).toEqual({
      id: `${SPREAD_ADDRESS}:interval→${BY_YEAR_ADDRESS}`,
      source: SPREAD_ADDRESS,
      kind: 'interval',
      target: BY_YEAR_ADDRESS,
      reason: `view "${SPREAD_ADDRESS}" draws table "${RADII_PER_PLANET}" and view "${BY_YEAR_ADDRESS}" draws table "references" — no relation joins those tables and they share no column, so nothing this edge carries could be judged there`,
    });
    // …and the map carries NO edge, minted or declared, between the histogram's layer and the years, either way
    expect(links.edges.filter((e) => (e.source === SPREAD_ADDRESS && e.target === BY_YEAR_ADDRESS) || (e.source === BY_YEAR_ADDRESS && e.target === SPREAD_ADDRESS))).toEqual([]);

    await surface.session.dispatch({ ...gesture, range: null, cause: { ...cause, intent: 'clear the bucket' } });
  });

  it('a planet picked on the scatter REACHES the years on the map and filters nothing there — the relation mints the edge, the read cannot judge the column (packet AH2)', async () => {
    const { links } = await surface.session.overview();

    // THE MAP, printed once and pinned. `by_year` is a FRAME: it lists its one layer and stands as no edge's end.
    expect(links.views.find((v) => v.viewId === BY_YEAR_VIEW)).toMatchObject({ viewId: BY_YEAR_VIEW, frame: [BY_YEAR_ADDRESS], grain: ['pub_year'] });
    expect(links.views.find((v) => v.viewId === BY_YEAR_VIEW)?.table).toBeUndefined();
    expect(links.edges.filter((e) => e.source === BY_YEAR_VIEW || e.target === BY_YEAR_VIEW)).toEqual([]);
    // INTO the layer: the sheet and the scatter's layer, point and match — the crossfilter default, minted
    // because a declared relation joins each source's table to `references` (`planets.radius_ref → references.ref`
    // for the scatter, `measurements.ref → references.ref` for the sheet — `EXO_RELATIONS`). Never the histogram.
    const into = edgesInto(links, BY_YEAR_ADDRESS).map((e) => `${e.source}:${e.kind}:${e.origin}`).sort();
    expect(into).toEqual([`${SCATTER_ADDRESS}:match:default`, `${SCATTER_ADDRESS}:point:default`, `${SHEET_VIEW}:match:default`, `${SHEET_VIEW}:point:default`].sort());
    // OUT OF the layer: the ONE declared edge — its source moved from the frame to this address under AJ, because
    // the def door refuses an edge naming a frame (`links[1].source "by_year" is a frame that reads only through
    // its layers — name one: by_year~references`) — and the defaults to the sheet's match and the scatter's layer.
    const out = edgesFrom(links, BY_YEAR_ADDRESS);
    expect(out.find((e) => e.origin === 'declared')).toMatchObject({ source: BY_YEAR_ADDRESS, kind: 'point', target: SHEET_VIEW, response: 'filter', fold: 'the publications the archive dates to the picked year' });
    expect(out.map((e) => `${e.kind}→${e.target}:${e.origin}`).sort()).toEqual([`point→${SHEET_VIEW}:declared`, `point→${SCATTER_ADDRESS}:default`, `match→${SHEET_VIEW}:default`, `match→${SCATTER_ADDRESS}:default`].sort());

    // THE PICK. The edge carries it to the layer over `references`…
    const cause = { requestedBy: 'user' as const, computedBy: 'user' as const, intent: `read every published value for ${PLANET}` };
    expect((await surface.session.dispatch({ verb: 'select', viewId: SCATTER_ADDRESS, field: 'pl_name', value: PLANET, cause })).ok).toBe(true);
    expect(surface.session.clausesFor(BY_YEAR_ADDRESS).map((c) => [c.from, c.response, c.clause])).toEqual([[SCATTER_ADDRESS, 'filter', { kind: 'point', field: 'pl_name', value: PLANET }]]);
    // …and the READ narrows it: the edge exists because the tables are JOINED, but the clause is phrased in
    // `pl_name`, a column `references` has not got, and the engine walks no relation to re-phrase it. So the
    // years keep every row, and the overview says so for exactly this one consumer. The demo does not walk that
    // relation by hand either (project, never re-derive): a pick that CHANGED the year bars would be a crossing
    // the library has not stated, and that is a library gap to record, not a fold to write here.
    const years = await surface.session.viewQuery({ viewId: BY_YEAR_ADDRESS, limit: 1 });
    expect(years.ok && years.count).toBe(tables.references.length);
    expect(years.ok ? years.clauses.find((c) => c.from === SCATTER_ADDRESS)?.narrowed : undefined).toEqual({
      column: 'pl_name',
      reason: 'table "references" has no column "pl_name" — a sentence about a column these rows do not have is not a claim about these rows',
    });
    const { activeSelections } = await surface.session.overview();
    expect(Object.keys(activeSelections[0]?.narrowedFor ?? {})).toEqual([BY_YEAR_ADDRESS]);
    await surface.session.dispatch({ verb: 'select', viewId: SCATTER_ADDRESS, field: 'pl_name', value: null, cause: { ...cause, intent: 'clear the planet' } });
  });

  it('a gesture landed AT the frame is refused in words naming its layer; the same gesture at the layer is what fills the sheet (packet AH2)', async () => {
    const cause = { requestedBy: 'user' as const, computedBy: 'user' as const, intent: 'the publications dated 2015' };
    // the session's own sentence and code (`vizfootprint` · `src/session/README.md`, "A clause a table cannot judge")
    const atFrame = await surface.session.dispatch({ verb: 'select', viewId: BY_YEAR_VIEW, field: 'pub_year', value: 2015, cause });
    expect(atFrame.ok).toBe(false);
    expect(!atFrame.ok && atFrame.rejection).toMatchObject({ code: 'guard-failed', target: BY_YEAR_VIEW, detail: `view "${BY_YEAR_VIEW}" reads only through its layers — a gesture lands under one of them: ${BY_YEAR_ADDRESS}` });
    // nothing landed: no commit under either address
    expect(surface.session.log.records.filter((r) => r.viewId === BY_YEAR_VIEW || r.viewId === BY_YEAR_ADDRESS)).toEqual([]);

    // at the LAYER it lands, and the DECLARED edge — the one whose source moved — carries it to the sheet with its fold
    expect((await surface.session.dispatch({ verb: 'select', viewId: BY_YEAR_ADDRESS, field: 'pub_year', value: 2015, cause })).ok).toBe(true);
    const sheet = await surface.session.viewQuery({ viewId: SHEET_VIEW, table: 'measurements', limit: 200 });
    expect(sheet.ok).toBe(true);
    expect(sheet.ok && sheet.clauses.map((c) => [c.from, c.response, c.narrowed])).toEqual([[BY_YEAR_ADDRESS, 'filter', undefined]]);
    // the rows it keeps are the measurements whose reference the archive dates to 2015 — judged by the engine,
    // counted here off the committed tables to say the filter was REAL and not a narrowed no-op
    const dated = new Set(tables.references.filter((r) => r.pub_year === 2015).map((r) => r.ref));
    expect(dated.size).toBeGreaterThan(0);
    expect(sheet.ok && sheet.count).toBe(tables.measurements.filter((m) => dated.has(m.ref)).length);
    expect(sheet.ok && sheet.count).toBeLessThan(tables.measurements.length);
    await surface.session.dispatch({ verb: 'select', viewId: BY_YEAR_ADDRESS, field: 'pub_year', value: null, cause: { ...cause, intent: 'clear the year' } });
  });
});

describe('the payload one page reads', () => {
  it('serves the three declared tables, the minted one, and the vocabulary with the gap named', () => {
    const payload = exoRows(surface);
    expect((payload['measurements'] as readonly unknown[]).length).toBe(20_598);
    expect((payload['planets'] as readonly unknown[]).length).toBe(6_360);
    expect((payload['references'] as readonly unknown[]).length).toBe(2_403);
    expect((payload['derived'] as readonly unknown[]).length).toBe(surface.derived.rows.length);
    expect(payload['derivedRefused']).toBeNull();
    expect(payload['actRefusals']).toEqual([]);
    expect(payload['absence']).toMatchObject({ field: 'radius_state', carries: ['limit'] });
    expect((payload['acts'] as readonly unknown[]).length).toBe(5);
    // the derived table's name is the one the def declared, so a cell can find it
    expect(RADII_PER_PLANET).toBe('radii_per_planet');
  });
});
