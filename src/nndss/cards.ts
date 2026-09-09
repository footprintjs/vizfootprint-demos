/**
 * WHAT THIS DEMO COVERS — the two surfaces, as cards.
 *
 * THE FACT THIS FILE EXISTS FOR: **one demo is not one dashboard.** The desk
 * builds its definition WITH the co-occurrence graph AND WITH the Census
 * denominator — a network view over two layers, a walk you can take from a
 * node, and cases per 100,000 people — and the story page builds the same demo
 * WITHOUT EITHER, from the same `nndssDef`: counts only, and a captured trace
 * that never touches the network at all. So this demo has TWO cards, with two
 * revisions, and every fact on each one came off the surface it names.
 *
 * No count of anything is typed in that sentence, and that is deliberate: the
 * numbers move with the def, and a hand-written one here would be the first
 * thing on either card a reader could not trust.
 *
 * Nothing here lists a feature. `defFeatures` reads them off the built
 * dashboards and `logFeatures` off the captured commits; the only hand-written
 * thing in this file is {@link NNDSS_GESTURES}, which is hand-written because
 * nothing can derive it — see its own comment.
 *
 * No `node:fs` here, for the reason `./etl.ts` has none: the story page bundles
 * this module, and its captured trace arrives as a payload rather than a file.
 */
import { buildDashboard } from 'vizfootprint/def';
import { defFeatures } from 'vizfootprint/def';
import { logFeatures } from 'vizfootprint/branches';
import type { CommitRecord } from 'vizfootprint/log';
import type { DemoSurface, GestureNote } from 'vizfootprint-studio/cards';
import { nndssDef } from './def.js';
import type { NndssGraph } from './graph.js';
import type { NndssTables } from './etl.js';

/** The demo's name, once — two cards share it, and that is how a gallery knows they are one demo. */
export const NNDSS_DEMO = 'CDC NNDSS weekly';

/**
 * HOW A PERSON PRODUCES EACH VERB IN THIS COCKPIT — the one thing on a card
 * nobody can derive, and therefore the one thing written down.
 *
 * A definition declares that `annotate` exists; a log shows it never landed;
 * neither can tell "nobody used it" from "this build gives nobody a button".
 * `gesture: null` is that second sentence, said out loud.
 *
 * This list is the SOURCE of the Grammar panel's gesture column too
 * (`web/src/GrammarPanel.tsx`) — one hand-written table, read twice, rather than
 * two that drift.
 */
export const NNDSS_GESTURES: readonly GestureNote[] = [
  { verb: 'select', gesture: 'click a mark (again to clear); shift-click adds a mark to the set; drag across bars for a run; a chip flips keep ⇄ exclude, its ✕ clears' },
  { verb: 'filter', gesture: 'drag across an axis' },
  { verb: 'reencode', gesture: 'click an axis label and pick a column' },
  { verb: 'bookmark', gesture: 'press ⚑ and name this moment' },
  { verb: 'fork', gesture: 'act while viewing the past' },
  { verb: 'analyze', gesture: 'ask the analyst — it runs a declared analysis' },
  { verb: 'navigate', gesture: 'switch the layout (Flow / Grid / Focus)' },
  { verb: 'link', gesture: "change a cell in the link matrix — what one view does with another's pick — a commit like any act" },
  { verb: 'describe', gesture: 'accept or edit the words under a chart' },
  // declared by the def, and this build wires nothing to it. The honest entry.
  { verb: 'annotate', gesture: null },
];

/** A captured trace, as `scripts/story-capture.ts` writes it — the log, and the two stores kept beside it. */
export interface CapturedWalk {
  readonly log: readonly CommitRecord[];
  readonly bookmarks?: readonly unknown[];
  readonly saved?: readonly unknown[];
}

export interface NndssCardsInput {
  readonly tables: NndssTables;
  /** The graph the DESK is built with. The story page's surface is built without it, from the same function. */
  readonly graph: NndssGraph;
  /** The story page's captured walk, when the caller has it; without one, that card says nobody has walked it. */
  readonly captured?: CapturedWalk;
}

/**
 * The demo's two surfaces, ready for `<DemoGallery>`.
 *
 * ```ts
 * const surfaces = nndssSurfaces({ tables: loadSnapshot(), graph: loadGraph(), captured });
 * surfaces[0].declares.chartKinds;  // bar, line, network — the desk
 * surfaces[1].declares.chartKinds;  // bar, line          — the story page
 * ```
 */
export function nndssSurfaces(input: NndssCardsInput): readonly DemoSurface[] {
  return [deskSurface(input), storySurface(input)];
}

/** The desk: the definition WITH the graph and WITH the denominator, and the gestures this cockpit wires to it. */
function deskSurface(input: NndssCardsInput): DemoSurface {
  // the vintage is READ off the table this card is built over, never typed — a
  // caption that outlived its file is the one thing this module exists to stop
  const vintage = input.tables.population?.find((row) => row.vintage !== undefined)?.vintage;
  return {
    demo: NNDSS_DEMO,
    surface: 'desk',
    blurb: `the whole cockpit, built with the disease co-occurrence graph — a network view over two layers, and a walk you can take from a node — and with the Census denominator, so a bar can show cases per 100,000 people${vintage === undefined ? '' : ` over the Bureau's Vintage ${String(vintage)} estimates`}`,
    href: '/',
    declares: defFeatures(buildDashboard(nndssDef(input.tables, input.graph))),
    byHand: NNDSS_GESTURES,
  };
}

/**
 * The story page: the SAME definition function, called without the graph AND
 * without the denominator, and the trace somebody really left on it.
 *
 * It carries no `byHand` notes: a story page's reader steps into the cockpit
 * through a door in the prose, and which gestures that cockpit offers is the
 * desk's card to answer, not this one's.
 */
function storySurface(input: NndssCardsInput): DemoSurface {
  const captured = input.captured;
  // WHY the fields are NAMED rather than the population spread away: the story
  // page shapes its tables from the one CSV it carries (`web/story/entry.tsx`),
  // so it declares no denominator, no relation and no rate — and a card built
  // over `loadSnapshot()`'s default would advertise two acts a reader opening
  // that page cannot land. The card must be built the way the page builds, and
  // a deny-list would carry the NEXT optional table onto this card by default;
  // naming what the page's ETL really produces excludes it unless somebody adds it.
  const { cells, jurisdictions, series, grain, diseases, weeks, counts, skipped } = input.tables;
  const tables: NndssTables = { cells, jurisdictions, series, grain, diseases, weeks, counts, skipped };
  return {
    demo: NNDSS_DEMO,
    surface: 'story page',
    blurb: 'one HTML file: the same demo without the graph and without the denominator — counts only, no cases per 100,000 — carrying its own log, bookmarks and pictures',
    declares: defFeatures(buildDashboard(nndssDef(tables))),
    ...(captured === undefined ? {} : { walked: logFeatures(captured.log, { bookmarks: captured.bookmarks, saved: captured.saved }) }),
  };
}
