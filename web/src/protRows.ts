/**
 * THE ROWS EVERY PICTURE ON THIS DESK IS DRAWN FROM, AT THE CURSOR THE READER
 * IS STANDING ON — the one thing that was missing, and the reason the stepper
 * can be a control at all.
 *
 * ── WHAT WAS WRONG, measured in a browser rather than argued ────────────────
 * The boot read the residue rows ONCE (`src/prot/session.ts` · `residuesAt`)
 * and handed them to the cells as data. Every column the three stages land is
 * resolved AT THE CURSOR, so a boot-time answer is the boot's cursor forever:
 * clicking a trace row seeked the record and nothing on screen changed — 565
 * marks before, 565 after. The library was not at fault. It re-reads at a
 * cursor and refuses a column that is not there yet, in its own words; the page
 * simply never asked again.
 *
 * ── THE FIX, and it is one sentence ─────────────────────────────────────────
 * The page reads its rows at the cursor and re-reads when the cursor moves. The
 * session view is a store (`subscribe`/`getState`, and `useSessionView` is the
 * library's own hook over it), so "the cursor moved" is a value this page can
 * watch. Every chart then gets the rows of the cursor it is folded at, and a
 * column that does not exist yet is refused by the read door exactly as
 * `tests/prot-progression.test.ts` already proves — the difference being that
 * now the screen keeps the claim, which
 * `tests/prot-cursor.smoke.test.ts` asserts in a real browser.
 *
 * ── TWO THINGS THIS HOOK IS CAREFUL ABOUT ──────────────────────────────────
 *   1. **The cursor, and nothing else.** A selection, a re-encode, a saved
 *      picture and a path rename all change the session view's state, and none
 *      of them changes which columns the table has. So the read is asked for
 *      when `state.cursor` stops matching the cursor the held rows were read at
 *      — the stamp `residuesAt` puts on its own answer — and at no other time.
 *   2. **The run's own counts are NOT rows.** A caption that quotes "224
 *      contacts" is quoting an ACT'S ANSWER, which belongs to the commit that
 *      landed it, and it keeps coming off `ProtRun` (`src/prot/orchestrator.ts`)
 *      where it always did. This hook moves the ROWS and only the rows.
 */
import { useEffect, useState } from 'react';
import { useSessionView, type SessionView } from 'vizfootprint-ui';
import type { InteractionSession } from 'vizfootprint/agent';
import { residuesAt, type ResiduesAtCursor } from '../../src/prot/session.js';
import type { ProtTables } from '../../src/prot/etl.js';

/** The rows the desk holds now, plus the one thing a reader can see happening. */
export interface ResiduesNow extends ResiduesAtCursor {
  /**
   * A read for a cursor the page has moved to is in flight.
   *
   * The PREVIOUS rows stay on screen while it is — a chart that blanked between
   * two cursors would be reporting the fetch rather than the record — and the
   * page says which cursor they are still the rows of.
   */
  readonly reading: boolean;
}

/**
 * THE ROWS, FOLLOWING THE CURSOR.
 *
 * ```tsx
 * const view = useMemo(() => createSessionView(sessionSource(surface.session), { as: 'user' }), [surface.session]);
 * const residues = useResiduesAtCursor(view, surface.session, surface.tables, surface.residues);
 * // residues.rows  — every residue at the cursor, with whatever has landed by then
 * // residues.refused — the library's own sentence when the window itself was refused
 * ```
 *
 * The boot's own answer is the SEED, so the first paint costs no extra read:
 * `openProtSurfaceAsync` already read the table at the head and stamped the
 * commit it read it at, and that stamp is what this hook compares against.
 */
export function useResiduesAtCursor(view: SessionView, session: InteractionSession, tables: ProtTables, seed: ResiduesAtCursor): ResiduesNow {
  const state = useSessionView(view);
  /**
   * The rows, and THE CURSOR THEY WERE ASKED FOR — which is not always the
   * cursor they came back stamped with.
   *
   * Both are held, and the read is asked for at most once per cursor, because
   * the two can disagree for a moment: `view.seek` resolves before the adapter's
   * next snapshot lands, so for a beat `state.cursor` is the old commit while
   * the session is already at the new one, and a read asked for the old one
   * answers stamped with the new. Keyed on the STAMP alone this would then ask
   * again, and again, for as long as the two disagreed — a read loop. Keyed on
   * what was ASKED it settles: the answer is kept (it is the newer, truer one),
   * the snapshot arrives, and the two agree. The rows on screen are never wrong
   * either way, because `RowsNote` quotes the STAMP — the commit the rows really
   * came from.
   */
  const [held, setHeld] = useState<{ readonly answer: ResiduesAtCursor; readonly askedFor: string | null }>({ answer: seed, askedFor: seed.cursor });
  const [reading, setReading] = useState(false);
  const at = state.cursor;
  // BEFORE THE FIRST SNAPSHOT there is no cursor to follow: `createSessionView`
  // hands out `emptyState()` until its first read resolves, and its `cursor` is
  // null for the same reason its `views` are empty — not because the session is
  // at the root. Reading on that state would throw away the boot's own answer
  // and fetch it again. This def declares seven views — eight on a build that
  // can perform stage 5 (`src/prot/def.ts` · `PROT_VIEWS` and `RANKING_VIEW`)
  // — so an empty list is the placeholder and nothing else.
  const snapshot = state.views.length > 0;

  useEffect(() => {
    if (!snapshot || held.askedFor === at) return;
    let live = true;
    setReading(true);
    void residuesAt(session, tables)
      .then((answer) => {
        // A LATE ANSWER IS DROPPED, never drawn: the cleanup below runs the
        // moment the cursor moves again, so the rows of a cursor a reader has
        // already left cannot land under the one they are on.
        if (live) {
          setHeld({ answer, askedFor: at });
          setReading(false);
        }
      })
      .catch((error: unknown) => {
        if (!live) return;
        // A THROWN READ IS A SENTENCE. The cells print `refused` verbatim, so a
        // door that rejected must not leave a reader with a picture drawn from
        // rows nobody could read.
        setHeld({ answer: { rows: [], refused: `the rows at this commit could not be read: ${error instanceof Error ? error.message : String(error)}`, cursor: at }, askedFor: at });
        setReading(false);
      });
    return () => {
      live = false;
    };
  }, [at, held, session, tables, snapshot]);

  return { ...held.answer, reading };
}
