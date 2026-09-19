/**
 * THE READER'S ARRANGEMENT OF THIS DESK — which pane sits in which SLOT, as a
 * permutation, and the rules that keep it inert.
 *
 * ── THE LAW THIS FILE EXISTS TO KEEP ───────────────────────────────────────
 * *A visible act either reaches the record, or claims nothing.* A reader who
 * swaps two panes has made a decision and would expect to find it again
 * tomorrow, so it lands on the trace. The library has already caught the other
 * shape once — a sheet holding its own sort in component state — removed it and
 * wrote the argument down (`vizfootprint` · `ui/src/sheet/arrangement.ts`), and
 * re-introducing it on the one desk built to find such things would be the
 * worst possible place for it.
 *
 * ── THE ROAD, AND NOTHING NEW ON IT ────────────────────────────────────────
 * The author's ruling was *build it on this desk first, on the road that
 * already exists — then lift it*. So this file declares no new library law and
 * asks for no new door. An arrangement act is ONE `navigate` on the library's
 * own `layout:dashboard` identity, prop `order`, landed through
 * `SessionView.setLayout({ order })` and read back at
 * `SessionViewState.layout.order` — the cockpit's own *cell order*, which is
 * exactly what this is. The commit is INERT by construction at the session tier
 * (`vizfootprint` · `src/branches/fold.ts` · `LAYOUT_VIEW_PREFIX`: a layout note
 * never enters `activeFilters` and never reaches `foldDiff`), it branches per
 * cursor, and `rebuildFold` restores it — which is the whole reason an
 * arrangement can be recorded without becoming a data claim.
 *
 * ── THE CODEC IS THE COCKPIT'S, NOT A SECOND ONE ───────────────────────────
 * `setLayout` writes `order.join(',')` and `parseLayout` splits on `,` and
 * trims. This file does not invent a second grammar on top — it spends that
 * one, and REFUSES at the door the one thing the grammar cannot carry: a pane
 * name holding the separator. (`ui/src/sheet/arrangement.ts` names that hazard
 * and answers it with JSON; the cockpit's `order` predates that ruling and is
 * still a joined string. Reported as a finding rather than worked around here,
 * because a second codec over the same prop is how two readers of one commit
 * start to disagree.)
 *
 * ── AND WHAT IS **NOT** AN ACT: THE FOCUS ──────────────────────────────────
 * Pressing a stage already lands a seek, and the focus is DERIVED from where
 * the cursor stands (`../protDesk.tsx` · `hero`). Landing a second commit for it
 * would be two owners of one question, which is the defect this desk already
 * removed from its stepper. So the record holds where every pane LIVES and the
 * focus only says which of them is LIFTED — see the note above `stripSlots` for
 * the transposition that was tried first and why a pure function cannot make it
 * true. That is the whole of *"rotate that with the other one in the wide slot
 * instead of randomly changing place, this way the other widgets won't jump"*,
 * and it is why the slot list below is FIXED rather than re-derived from each
 * pane's shape on every render.
 *
 * Every function here is a plain function over its arguments: no React, no
 * session, no engine, so a test, a browser and the composition share them.
 */

/**
 * THE SCOPE THE ARRANGEMENT LANDS UNDER — THIS DESK'S OWN, so the identity on
 * the trace is `layout:protein-desk`.
 *
 * IT USED TO BE THE COCKPIT'S. This desk had to ride `layout:dashboard.order`
 * because the library had no door for a third-party scope — three fixed props
 * is not a vocabulary — and a cell permutation was honestly what this is. The
 * library's generic door (`vizfootprint-ui` · `SessionView.setLayoutNote`,
 * shipped as the lift of this desk's own packet) means the arrangement now
 * lands where it is about, and a second arrangement prop here would have
 * somewhere to go.
 *
 * STATED rather than imported for the reason the library states its own
 * prefixes: the rules layer may not reach the library at all (`./README.md`,
 * layer 3; `tests/prot-layers.test.ts` rule 2). `tests/prot-arrangement.test.ts`
 * pins it against what the door actually lands.
 */
export const ARRANGEMENT_SCOPE = 'protein-desk';

/**
 * The arrangement prop the pane order rides — this desk's own word for it, no
 * longer borrowed from the cockpit's `order`.
 */
export const ARRANGEMENT_PROP = 'panes';

/**
 * THERE IS NO SEPARATOR REFUSAL HERE ANY MORE, and its removal is the point of
 * the re-pin.
 *
 * This desk used to refuse a pane whose name held a comma, because the
 * cockpit's codec joined an order with one and such a name would come back as
 * two panes. The library's codec now writes JSON whenever the joined form would
 * not read back byte-for-byte (`vizfootprint-ui` · `cellOrderToLayoutValue`),
 * so the name rides. Keeping the refusal would leave this desk as the one place
 * where a legal name is still illegal — a workaround outliving the thing it
 * worked around, which is worse than the original gap because nobody would know
 * to look for it.
 *
 * A BLANK name is not refused here either: the door judges a layout note's
 * SHAPE and the desk has no pane named by a blank string to arrange.
 */

/** The arrangement this desk is actually in, and what the trace names that this desk does not have. */
export interface ArrangedPanes {
  /** Every pane of the desk, in SLOT order — the recorded ones first, in the order they were recorded, then the rest in the desk's own. */
  readonly panes: readonly string[];
  /** Names the recorded arrangement holds that this desk has no pane for — said once, never a silent rewrite of the trace. */
  readonly missing: readonly string[];
}

/**
 * THE RECORDED ARRANGEMENT, APPLIED — total, and defensive in the way the
 * library's own codec is.
 *
 * Two laws live here and nowhere else, and both are the sheet arrangement's,
 * kept deliberately:
 *
 * - **A name this desk does not have is IGNORED, not repaired.** A cursor
 *   standing before the ranking landed, an older wire, a hand-landed commit:
 *   the trace may hold a name no pane answers to. Rewriting the trace to match
 *   would be forging the record of an act, so the name is skipped and RETURNED
 *   in `missing`, for the page to say once in words.
 * - **A pane the arrangement does not name still has a slot.** The ranking
 *   chart arrives mid-run; an arrangement landed before it must not make it
 *   disappear. Unnamed panes follow, in the desk's own order.
 *
 * A duplicate in the recorded order is taken once, at its first mention: a
 * permutation is what this prop means, and one pane cannot be in two slots.
 */
export function arrangePanes(defaults: readonly string[], recorded: readonly string[]): ArrangedPanes {
  const has = new Set(defaults);
  const taken = new Set<string>();
  const panes: string[] = [];
  for (const name of recorded) {
    if (!has.has(name) || taken.has(name)) continue;
    taken.add(name);
    panes.push(name);
  }
  for (const name of defaults) {
    if (taken.has(name)) continue;
    taken.add(name);
    panes.push(name);
  }
  return { panes, missing: [...new Set(recorded.filter((name) => !has.has(name)))] };
}

/**
 * TWO PANES EXCHANGE SLOTS — the whole of what one arrangement act does.
 *
 * `null` when the act would change nothing (a pane onto itself) or could not be
 * performed (a name this desk has no pane for). An act a reader could not
 * account for is not offered, which is the rule the library's own arrange menu
 * keeps (`arrangeItems`: *an item that would change nothing is not offered*).
 */
export function swapPanes(panes: readonly string[], a: string, b: string): readonly string[] | null {
  if (a === b) return null;
  const i = panes.indexOf(a);
  const j = panes.indexOf(b);
  if (i < 0 || j < 0) return null;
  const next = [...panes];
  next[i] = b;
  next[j] = a;
  return next;
}

/**
 * ── WHY THERE IS NO TRANSPOSITION HERE, AND THE DESIGN THAT WAS TRIED ──────
 *
 * The first shape of this file put the focused pane into slot 0 by SWAPPING it
 * with whatever the recorded order had there. It is the obvious reading of
 * *"rotate that with the other one in the wide slot"*, it is pure, and it is
 * WRONG — `tests/prot-arrangement.test.ts` caught it before a browser did.
 *
 * Take a recorded order `[P0, P1, P2, …]`. Focusing `P1` draws `[P1, P0, P2]`;
 * focusing `P2` draws `[P2, P1, P0]`. Going from the first to the second is not
 * a swap of `P1` and `P2` at all — it is a THREE-CYCLE, and `P0` moves as well.
 * The reason is structural: *the pane that was in the focus* is HISTORY, and a
 * pure function of (recorded order, focused pane) cannot know it. The only ways
 * out are to remember it — component state, which is the exact defect this
 * packet exists to refuse — or to land a commit on every stepper press, which
 * would make the focus an act and give one question two owners.
 *
 * So the MODEL changes instead: **every pane has a HOME SLOT and never leaves
 * it.** The focus is a LIFT, not a reshuffle — the focused pane is also drawn
 * large in the focus slot, and its home says so. Moving the focus therefore
 * moves exactly two things: the new pane lifts, the old one settles back into
 * the home it never gave up. Nothing else can move, because nothing else's home
 * changed, and the home order is the only thing on the record.
 *
 * THE PRICE, STATED: the desk needs one box more than it has panes to draw — a
 * home for every pane plus the focus slot — so one home is always showing a
 * marker rather than a picture, and the panes beside it are a little smaller
 * than they were. That is the cost of a reader's spatial memory of their own
 * desk, and the author decided that trade in advance: *this way the other
 * widgets won't jump.*
 */

/**
 * HOW MANY SLOTS THE BOTTOM STRIP HAS — a CONSTANT of the desk's geometry,
 * folded once over every pane, and never re-derived from what happens to be in
 * the rail right now.
 *
 * That is the load-bearing decision of this whole file. The desk used to split
 * its rail by each pane's own shape on every render (`./charts.ts` ·
 * `shapeOfView`), which meant that focusing a square picture took a wide one
 * OUT of the strip and put a square one INTO the column — measured on the live
 * page at 1280×800: promoting the backbone-angle scatter moved FIVE of the
 * eight panes. With the count fixed, the strip always has these homes and the
 * column always has the rest, and only the two panes that changed ever move.
 *
 * It is the number of wide-shaped panes: every pane has a home, and the ones
 * drawn against an axis of residues want the bottom strip. The count never
 * moves while the desk holds the same panes, whatever is focused and whatever
 * the reader has arranged.
 */
export function stripSlots(panes: readonly string[], wants: (id: string) => boolean): number {
  return panes.filter(wants).length;
}

/** Where every pane LIVES — the homes along the bottom strip and down the right column — and which one is lifted into the focus. */
export interface DeskSlots {
  /** The pane drawn large in the focus slot; its HOME stays where it is and shows a marker. `null` when a blocked step's card has the focus instead. */
  readonly focus: string | null;
  /** The bottom strip's homes, left to right. Its LENGTH never changes (see {@link stripSlots}). */
  readonly strip: readonly string[];
  /** The right column's homes, top to bottom. */
  readonly column: readonly string[];
}

/**
 * THE SLOTS, FILLED — position decides geometry, and the pane in a position
 * decides nothing about where the others are.
 *
 * This is the inversion the packet is about. Before, a pane's SHAPE decided
 * which region it was in and the regions therefore resized under every press.
 * Now the shapes decide the geometry ONCE ({@link stripSlots}) and after that a
 * slot is furniture: a square picture dragged into a strip slot gets a wide box
 * and reads a little worse there, which is the reader's own choice and costs
 * nobody else's pane a pixel.
 */
export function slotsOf(homes: readonly string[], strip: number, focus: string | null): DeskSlots {
  return {
    focus: focus !== null && homes.includes(focus) ? focus : null,
    strip: homes.slice(0, strip),
    column: homes.slice(strip),
  };
}

/**
 * THE DESK'S OWN ORDER, when nothing has been recorded — and it is the
 * arrangement the page has always drawn, written down.
 *
 * Wide-shaped panes first (one of them will stand in the focus, the rest are
 * the strip), then the panes that draw down the column, then the ONE pane that
 * says rather than draws. The last clause is not tidiness: a pane of words
 * takes its content's height and a pane of marks needs a share of the column,
 * so the word pane has always been the column's last row, and a default that
 * put it anywhere else would change the page at rest.
 */
export function defaultPaneOrder(panes: readonly string[], wants: (id: string) => boolean, says: (id: string) => boolean): readonly string[] {
  return [...panes.filter((id) => wants(id)), ...panes.filter((id) => !wants(id) && !says(id)), ...panes.filter((id) => !wants(id) && says(id))];
}

/**
 * WHAT THE PAGE SAYS ABOUT THE ARRANGEMENT ITSELF — the facts a reader cannot
 * otherwise learn, and NOTHING when there is nothing to say.
 *
 * The library's own `arrangementSaid` keeps the same law: this is about the
 * trace disagreeing with the desk, never about a door a host did not wire, so a
 * reader of a static build is owed it too.
 */
export function arrangementSaid(missing: readonly string[]): readonly string[] {
  return missing.length === 0 ? [] : [`the recorded arrangement names ${missing.join(', ')}, which this desk has no pane for — those names are left on the record rather than rewritten, and the panes it does have keep their own order`];
}

// ── the words, so no control spells one its own way ─────────────────────────

/** What the handle on a pane is called, before anything has been picked up. */
export function pickUpLabel(label: string): string {
  return `move ${label}: press to pick this pane up, then press another pane’s handle to swap the two — the swap lands on the record and travels with the cursor`;
}

/** What the same handle is called once THIS pane is the one being moved. */
export function heldLabel(label: string): string {
  return `${label} is picked up — press this handle again, or Escape, to put it back where it was`;
}

/** What another pane's handle is called while one is held: the act it would land, named by both panes. */
export function dropLabel(held: string, onto: string): string {
  return `swap ${held} with ${onto} — ${held} takes this pane’s place and this pane takes ${held}’s, and nothing else on the desk moves`;
}

/** The line the desk shows while a pane is held — a REPORT: it reaches no commit, and nothing computes from it. */
export function heldSaid(label: string): string {
  return `${label} is picked up. Press another pane’s handle — or drop it on one — to swap the two. Escape puts it back.`;
}

/**
 * WHAT A HOME SAYS WHILE ITS PANE IS LIFTED INTO THE FOCUS — the marker, in the
 * register the 3D viewer's own rail tile already speaks.
 *
 * It is not an empty box and not a ghost of the picture: it is the statement
 * that this slot is where that pane LIVES, which is the fact a reader needs for
 * the arrangement to read as furniture rather than as a shuffle. The home is
 * still a drop target — arranging where a pane will settle is exactly as much an
 * act while it is lifted as while it is not.
 */
export function homeSaid(label: string): string {
  return `${label} is in the focus — this is where it sits when something else is`;
}
