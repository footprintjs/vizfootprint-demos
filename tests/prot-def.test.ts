/**
 * THE PROTEIN DEF — what the door accepts, and what the encoding plane says
 * about a chart kind the library has never heard of.
 *
 * `structure` is drawn by Mol*, so `chartKind: 'structure'` is a word no
 * built-in requirement table mentions. The def door echoes a kind verbatim (it
 * parses none), which means the interesting question is not whether the def
 * BUILDS — it does — but what the plane then OFFERS a reader and an agent. This
 * suite pins all three answers the packet had to choose between:
 *
 *   (b)  the shipped one: `chartKind: 'structure'`, `channels: ['color']`, and
 *        a per-kind requirement under `encodingRules.channels` — two columns
 *        fit the 3D view's colour, and the other seven are refused BY NAME.
 *   (b−) the same declaration with NO per-kind requirement — the plane offers
 *        the residue KEY and both ANGLES as hues, because no by-name default
 *        mentions `color` and an unknown kind has no row of its own.
 *   (a)  no encoding entry at all — no `fits`, an empty fold, a `reencode`
 *        refused as `guard-failed`, and a derived `howToRead` refused at the
 *        DOOR.
 *
 * Keeping (a) and (b−) in a test rather than in prose is the point: the report
 * for this packet quotes these sentences, and a library change that moved them
 * should fail here rather than quietly make the report wrong.
 */
import { describe, expect, it } from 'vitest';
import { buildDashboard } from 'vizfootprint/agent';
import type { DashboardDef } from 'vizfootprint/agent';
import { INTERFACE_VIEW, PAIRS_VIEW, PROT_VIEWS, PROT_WORDS, RAMA_VIEW, RESIDUES_TABLE, RESIDUE_KEY, SHEET_VIEW, STRUCTURE_VIEW, SURFACE_VIEW, protDef, protGrains } from '../src/prot/def.js';
import { ACT_KEY_COLUMN, ACT_TABLE, INTERACTION_COLUMNS, INTERACTION_SCHEMA, INTERACTIONS_TABLE, INTERFACE_CONTACTS_COLUMN, PROT_ACT_ORDER, PROT_STAGES, SASA_COLUMN } from '../src/prot/analyses.js';
import { protTables } from '../src/prot/etl.js';
import { loadStructureText } from '../src/prot/snapshot.js';

const TEXT = loadStructureText();
const TABLES = protTables(TEXT);
const DEF = protDef(TABLES, TEXT);

/** One session's overview, over a def — the wire a reader and an agent both read. */
async function overviewOf(def: DashboardDef) {
  const session = buildDashboard(def).createSession({ as: 'user' });
  return { session, overview: await session.overview() };
}

const cause = (intent: string) => ({ requestedBy: 'user' as const, computedBy: 'user' as const, intent });

describe('the def the desk ships', () => {
  it('declares one table, keyed by the minted residue key, and six views', () => {
    expect(Object.keys(DEF.data)).toEqual([RESIDUES_TABLE]);
    expect(DEF.defaultTable).toBe(RESIDUES_TABLE);
    expect(DEF.data[RESIDUES_TABLE]?.key).toBe(RESIDUE_KEY);
    // the rows are declared as an inline SOURCE, so a carrier vouches for a version
    expect(DEF.data[RESIDUES_TABLE]?.source).toMatchObject({ format: 'rows', via: 'inline' });
    expect(Object.keys(DEF.actors)).toEqual([...PROT_VIEWS]);
    expect(PROT_VIEWS).toEqual([STRUCTURE_VIEW, RAMA_VIEW, INTERFACE_VIEW, SURFACE_VIEW, PAIRS_VIEW, SHEET_VIEW]);
    // ONE TABLE STILL, and that is the packet's finding in one assertion: the
    // `interactionPairs` act cuts a second table and the def cannot name it, so
    // `data` has exactly the one the file was parsed into (src/prot/analyses.ts)
    expect(Object.keys(DEF.data)).not.toContain(INTERACTIONS_TABLE);
  });

  it('spells the acts’ table and key the same way the def does — the guard the def throws on', () => {
    // `src/prot/analyses.ts` cannot import these (this def imports IT), so it
    // spells them and the def checks. The def's check is a THROW at load, so a
    // drift would fail every test in this file; this one names what it is.
    expect([ACT_TABLE, ACT_KEY_COLUMN]).toEqual([RESIDUES_TABLE, RESIDUE_KEY]);
  });

  it('declares the three acts the two stages dispatch, and every one of them as CODE rather than a builtin record', () => {
    expect(Object.keys(DEF.analyses ?? {})).toEqual([...PROT_ACT_ORDER]);
    // every act is a `defineAnalysis` shape — a `build` function, never a
    // `builtin` name — because what they compute is a third party's engine over a
    // headless parse, which no declarative op grammar can spell. The consequence
    // is the one `src/prot/analyses.ts` is written around: a `table` output from a
    // code def never reaches the data space.
    for (const act of PROT_ACT_ORDER) {
      const slot = (DEF.analyses ?? {})[act] as unknown as Record<string, unknown>;
      expect(typeof slot['build']).toBe('function');
      expect(slot['builtin']).toBeUndefined();
      expect(slot['kind']).toBe('transform');
    }
    // …and the two stages name them in the order a reader meets the pictures
    expect(PROT_STAGES.map((s) => s.stage)).toEqual(['interactions', 'surface']);
    expect(PROT_STAGES.flatMap((s) => s.acts.map((a) => a.id))).toEqual([...PROT_ACT_ORDER]);
    // every act's declared intent is what the ledger will carry — never empty
    for (const stage of PROT_STAGES) for (const act of stage.acts) expect(act.intent.length).toBeGreaterThan(40);
  });

  it('declares the two act-fed charts over columns NOTHING has landed — which is what the read then refuses', () => {
    const bar = DEF.encodings?.find((e) => e.viewId === INTERFACE_VIEW);
    const run = DEF.encodings?.find((e) => e.viewId === SURFACE_VIEW);
    expect(bar).toMatchObject({ chartKind: 'bar', channels: ['category', 'y'], initial: { category: RESIDUE_KEY, y: INTERFACE_CONTACTS_COLUMN } });
    expect(run).toMatchObject({ chartKind: 'line', channels: ['x', 'y', 'color'], initial: { x: 'resnum', y: SASA_COLUMN, color: 'chain' } });
    // the columns those two bind are NOT declared on the table: they arrive with
    // their acts, which is the whole progression this desk exists to show
    const columns = Object.keys(DEF.data[RESIDUES_TABLE]?.columns ?? {});
    for (const landed of [INTERFACE_CONTACTS_COLUMN, SASA_COLUMN]) expect(columns).not.toContain(landed);
    // A LINE'S X MAY NOT BE AN IDENTIFIER — the library refuses that by name, so
    // the run's axis is the residue NUMBER and the two chains share it. Pinned
    // because the honest caption on that cell depends on it.
    expect(run?.initial?.['x']).not.toBe(RESIDUE_KEY);
    expect(bar?.initial?.['category']).toBe(RESIDUE_KEY);
  });

  it('declares the nine columns with their roles, and the two angles as measures in degrees', () => {
    const columns = DEF.data[RESIDUES_TABLE]?.columns ?? {};
    expect(Object.keys(columns)).toEqual(['residue_key', 'chain', 'resnum', 'resname', 'ca_x', 'ca_y', 'ca_z', 'phi', 'psi']);
    expect(columns['residue_key']?.role).toBe('identifier');
    expect([columns['chain']?.role, columns['resname']?.role]).toEqual(['dimension', 'dimension']);
    // a residue NUMBER is a place in a chain, so it is a discrete dimension and not a measure
    expect(columns['resnum']).toMatchObject({ role: 'dimension', scale: 'discrete' });
    expect([columns['ca_x']?.unit, columns['phi']?.unit, columns['psi']?.unit]).toEqual(['ångström', 'degrees', 'degrees']);
    expect([columns['phi']?.role, columns['psi']?.role]).toEqual(['measure', 'measure']);
    // NO absence vocabulary: the two angles are simply null where the file has no
    // geometry, and no table-level declaration could speak for one angle and not
    // the other (the header of src/prot/def.ts says why)
    expect(DEF.data[RESIDUES_TABLE]?.absence).toBeUndefined();
    expect(Object.values(columns).some((c) => c.role === 'absence')).toBe(false);
  });

  it('declares the grain where the marks are: one mark per ROW — at every address but the receipt, which has nothing to declare one against', () => {
    expect(protGrains()).toEqual([
      { viewId: STRUCTURE_VIEW, keys: [] },
      { viewId: RAMA_VIEW, keys: [] },
      { viewId: INTERFACE_VIEW, keys: [] },
      { viewId: SURFACE_VIEW, keys: [] },
      { viewId: SHEET_VIEW, keys: [] },
    ]);
    // THE RECEIPT HAS NO GRAIN, and not by oversight: its marks are PAIRS, a grain
    // names group keys, and a key is a column of the table the address reads — a
    // table this def cannot name. `keys: []` would say "one mark per row of
    // `residues`", which is false.
    expect(protGrains().some((g) => g.viewId === PAIRS_VIEW)).toBe(false);
    // …and NO layer addresses anywhere: one table, so every view binds at its own level
    expect(DEF.encodings?.some((e) => e.layers !== undefined)).toBe(false);
    expect(protGrains().some((g) => g.viewId.includes('~'))).toBe(false);
  });

  it('declares NO links — the crossfilter default already carries a residue from either picture to the other', () => {
    expect(DEF.links).toEqual([]);
  });

  it('declares each view’s voice, and the sheet’s silence', () => {
    expect(DEF.capabilities).toEqual([
      { viewId: STRUCTURE_VIEW, canProbe: true, encodings: ['point'] },
      { viewId: RAMA_VIEW, canProbe: true, encodings: ['interval'] },
      { viewId: INTERFACE_VIEW, canProbe: true, encodings: ['point'] },
      { viewId: SURFACE_VIEW, canProbe: true, encodings: ['interval'] },
      { viewId: PAIRS_VIEW, canProbe: false },
      { viewId: SHEET_VIEW, canProbe: false },
    ]);
  });

  it('declares a meaning for every column of the table no door can declare', () => {
    // A table in `def.data` carries a ColumnDecl per column. The act's table is
    // not in `def.data`, so `INTERACTION_COLUMNS` is where its roles and units
    // would have lived — and the act's own schema is built from that one list, so
    // the two cannot disagree.
    expect(Object.keys(INTERACTION_SCHEMA)).toEqual(INTERACTION_COLUMNS.map((c) => c.name));
    for (const column of INTERACTION_COLUMNS) {
      expect(INTERACTION_SCHEMA[column.name]).toBe(column.type);
      expect(column.meaning.trim()).not.toBe('');
    }
    const meaning = (name: string): string => INTERACTION_COLUMNS.find((c) => c.name === name)?.meaning ?? '';
    // the ångström unit is stated in the one column that has one, and so is WHICH
    // distance it is — the centre separation, not the atom separation, which for a
    // ring is a different number
    expect(meaning('separation')).toContain('ångström');
    expect(meaning('separation')).toContain('centres');
    // and the taxonomy's vocabulary is named where the column is, because an
    // absent word means "nobody asked" and only the list can say so
    for (const word of ['hydrogen bond', 'pi stacking', 'ionic', 'water bridge', 'unknown']) expect(meaning('kind')).toContain(word);
    // WHY `atoms_a` exists at all, pinned: it is what makes `separation` checkable
    // against two records of the file (tests/prot-interactions.test.ts does that)
    expect(meaning('atoms_a')).toContain('centroids');
  });

  it('builds, and the session projects the declared voices — a point implying a match, by the library’s own law', async () => {
    const { overview } = await overviewOf(DEF);
    const views = overview.views as readonly { viewId: string; selectionKinds: readonly string[]; canProbe: boolean }[];
    const voice = (viewId: string) => views.find((v) => v.viewId === viewId);
    // the DEF says `['point']`; the library adds `match` because a set is a point's
    // plural — and the renderer's hello still declares one kind, which is its own
    // tier's truth (web/src/molstarRenderer.ts)
    expect(voice(STRUCTURE_VIEW)?.selectionKinds).toEqual(['point', 'match']);
    expect(voice(RAMA_VIEW)?.selectionKinds).toEqual(['interval']);
    expect(voice(SHEET_VIEW)?.selectionKinds).toEqual([]);
    expect(voice(SHEET_VIEW)?.canProbe).toBe(false);
  });

  it('carries the dashboard’s declared words once, where the page reads them', () => {
    const dashboard = DEF.prose?.find((p) => p.viewId === 'dashboard');
    expect(dashboard?.slots.title?.text).toBe(PROT_WORDS.title);
    expect(dashboard?.slots.caption?.text).toBe(PROT_WORDS.caption);
    // the counted sentences are DERIVED from the rows, so they cannot drift from the picture
    const long = DEF.prose?.find((p) => p.viewId === RAMA_VIEW)?.slots.altLong?.text ?? '';
    expect(long).toContain(`${String(TABLES.counts.bothPresent)} of the ${String(TABLES.counts.residues)} residues are drawn`);
  });
});

describe('(b) the shipped declaration: what fits the 3D view’s one channel', () => {
  it('offers exactly the two columns a palette can name, and refuses the other seven by name', async () => {
    const { overview } = await overviewOf(DEF);
    const view = (overview.views as readonly { viewId: string; encodings: Record<string, string>; fits?: Record<string, readonly { field: string; ok: boolean; because?: string }[]> }[]).find((v) => v.viewId === STRUCTURE_VIEW);
    // the fold seeds from the declared `initial`
    expect(view?.encodings).toEqual({ color: 'chain' });
    const color = view?.fits?.['color'] ?? [];
    expect(color.filter((f) => f.ok).map((f) => f.field)).toEqual(['chain', 'resname']);
    expect(color.filter((f) => !f.ok).map((f) => f.field)).toEqual(['residue_key', 'resnum', 'ca_x', 'ca_y', 'ca_z', 'phi', 'psi']);
    // the KEY is refused by the per-kind requirement's own sentence — 185 hues name nothing
    expect(color.find((f) => f.field === RESIDUE_KEY)?.because).toContain('a column with distinct values (residue_key is not one)');
    // a COORDINATE is refused by a house rule, because the picture already places it
    expect(color.find((f) => f.field === 'ca_x')?.because).toContain('is WHERE the residue is drawn in the 3D view');
    // the 3D view has no positional channel at all: `color` is the whole surface
    expect(Object.keys(view?.fits ?? {})).toEqual(['color']);
  });

  it('lands a rebind of the colour as a commit, and refuses an impossible one in both sentences', async () => {
    const { session } = await overviewOf(DEF);
    const ok = await session.dispatch({ verb: 'reencode', viewId: STRUCTURE_VIEW, channel: 'color', field: 'resname', cause: cause('colour the molecule by amino acid') });
    expect(ok.ok).toBe(true);
    // …and the fold moved, which is what the renderer reads off `RenderState.encodings`
    const after = await session.overview();
    expect((after.views as readonly { viewId: string; encodings: Record<string, string> }[]).find((v) => v.viewId === STRUCTURE_VIEW)?.encodings).toEqual({ color: 'resname' });

    const refused = await session.dispatch({ verb: 'reencode', viewId: STRUCTURE_VIEW, channel: 'color', field: 'ca_x', cause: cause('colour the molecule by x') });
    expect(refused.ok).toBe(false);
    if (!refused.ok) {
      expect(refused.rejection.code).toBe('guard-failed');
      // BOTH reasons, in order: the house rule first (a law is the real reason), then the shape
      expect(refused.rejection.detail).toContain('is WHERE the residue is drawn in the 3D view');
      expect(refused.rejection.detail).toContain('takes a column with distinct values');
    }
  });

  it('the scatter’s axes are judged by the SCATTER’s own built-in requirement, untouched by the new kind', async () => {
    const { overview } = await overviewOf(DEF);
    const view = (overview.views as readonly { viewId: string; fits?: Record<string, readonly { field: string; ok: boolean; because?: string }[]> }[]).find((v) => v.viewId === RAMA_VIEW);
    expect(view?.fits?.['x']?.filter((f) => f.ok).map((f) => f.field)).toEqual(['resnum', 'ca_x', 'ca_y', 'ca_z', 'phi', 'psi']);
    expect(view?.fits?.['x']?.find((f) => f.field === RESIDUE_KEY)?.because).toContain('the x channel of a scatter needs a number or a date');
  });
});

describe('(b−) the same declaration with no per-kind requirement, and (a) no declaration at all', () => {
  /** The shipped def with `encodingRules.channels` removed — nothing else changed. */
  const noRequirement: DashboardDef = { ...DEF, encodingRules: { ...DEF.encodingRules, channels: undefined } };

  it('without the requirement, the plane offers the residue KEY and both ANGLES as hues', async () => {
    const { overview } = await overviewOf(noRequirement);
    const color = (overview.views as readonly { viewId: string; fits?: Record<string, readonly { field: string; ok: boolean }[]> }[]).find((v) => v.viewId === STRUCTURE_VIEW)?.fits?.['color'] ?? [];
    // 185 distinct keys, and two continuous angles, all "fitting" a colour channel:
    // no by-name default mentions `color`, and an unknown chart kind has no row of
    // its own, so only this demo's three `never-on` rules refuse anything at all
    expect(color.filter((f) => f.ok).map((f) => f.field)).toEqual([RESIDUE_KEY, 'chain', 'resname', 'phi', 'psi']);
    expect(color.filter((f) => !f.ok).map((f) => f.field)).toEqual(['resnum', 'ca_x', 'ca_y', 'ca_z']);
  });

  it('(a) a view with NO encoding entry cannot carry a derived howToRead — the DOOR says so', () => {
    const noEntry: DashboardDef = { ...DEF, encodings: DEF.encodings?.filter((e) => e.viewId !== STRUCTURE_VIEW) };
    expect(() => buildDashboard(noEntry)).toThrow(/"structure"\.howToRead is derived, but "structure" declares no encoding surface — there is nothing to derive from/);
  });

  it('(a) with that slot dropped it builds — and has no fits, an empty fold, and a reencode refused as guard-failed', async () => {
    const noEntry: DashboardDef = {
      ...DEF,
      encodings: DEF.encodings?.filter((e) => e.viewId !== STRUCTURE_VIEW),
      prose: DEF.prose?.map((p) => {
        if (p.viewId !== STRUCTURE_VIEW) return p;
        const { howToRead: _dropped, ...slots } = p.slots;
        return { ...p, slots };
      }),
    };
    const { session, overview } = await overviewOf(noEntry);
    const view = (overview.views as readonly { viewId: string; encodings: Record<string, string>; fits?: unknown }[]).find((v) => v.viewId === STRUCTURE_VIEW);
    expect(view?.encodings).toEqual({});
    expect(view?.fits).toBeUndefined();
    const refused = await session.dispatch({ verb: 'reencode', viewId: STRUCTURE_VIEW, channel: 'color', field: 'chain', cause: cause('colour the molecule by chain') });
    expect(refused.ok).toBe(false);
    if (!refused.ok) {
      expect(refused.rejection.code).toBe('guard-failed');
      expect(refused.rejection.detail).toBe('view "structure" declares no encoding surface');
    }
  });
});
