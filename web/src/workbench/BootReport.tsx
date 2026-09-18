/**
 * WHAT THE PAGE IS DOING — LAYER 2, and two components because the author's
 * ruling split this into two places.
 *
 * ```
 *   ①————②╌╌╌╌③╌╌╌╌④╌╌╌╌⑤╌╌╌╌⑥        ← the stepper carries the progress
 *              reading the committed files · 4 of 6      ← {@link BootLine}
 * ```
 *
 * ── THE LIST STOPPED BEING THE STATUS DISPLAY, and that is a law ───────────
 * It was an eight-row list beside the stepper, narrating the same progression
 * the stepper's own marks show. That is a SECOND ANSWER to one question, which
 * is the thing this desk refuses everywhere else — and the desk's own law is
 * that *the stage stepper IS the cursor*. So:
 *
 *   {@link BootLine}   ONE centred line under the stepper row: the act
 *                      happening now, present tense, nothing else. The
 *                      spinner on the stepper and this line are two faces of
 *                      one fact and have ONE owner (`./boot.ts` · `bootNow`).
 *   {@link BootLog}    the same rows, in the RECORD DRAWER, where detail
 *                      already lives on this page. The detail MOVED; it did
 *                      not vanish — the measured gzip sentence and the probe
 *                      counts are provenance, and *we simplified the screen*
 *                      is how honesty gets quietly dropped.
 *
 * ── THE FOUR MARKS, and the first two are the whole point ──────────────────
 *   `pending`  hollow and grey — it claims nothing and it has not failed;
 *   `doing`    the accent ring;
 *   `landed`   solid accent;
 *   `refused`  rust, with the refusal's own sentence UNDER the line rather
 *              than behind a press.
 *
 * A reader must be able to tell `pending` from `refused` at a glance, because
 * they are different facts about a boot and the screen used to have no way to
 * say the first of them (`./boot.ts` carries the argument).
 *
 * ── AND ONE `role="status"`, NOT TWELVE ────────────────────────────────────
 * Each of the two is one live region with `aria-live="polite"`, so a screen
 * reader is told what the page is doing without being interrupted once per
 * token. Twelve live regions on one boot is a page that talks over itself.
 */
/**
 * WHAT A BOOT STEP IS DOING — four words, and the first two are the point.
 *
 * `pending` is *this has not happened yet*: it claims nothing, and it is NOT
 * the same fact as `refused`. A boot that drew one as the other would be
 * reporting a failure the page has not had.
 *
 * Declared HERE and not imported — the {@link RecommendationRow} precedent
 * (`./ChartCard.tsx`), and the reason is the folder's first law: a component
 * that takes only props can later move into `vizfootprint-ui` and serve every
 * desk, and one that imported this desk's own fold could never move at all.
 * The rules layer types itself against these (`./boot.ts`).
 */
export type BootStepState = 'pending' | 'doing' | 'landed' | 'refused';

/** One line of the boot report, already folded. Everything on it is a state or a count. */
export interface BootStepView {
  /** A stable key. */
  readonly key: string;
  /** What this step is, in the name its own declaration gives it. */
  readonly name: string;
  readonly state: BootStepState;
  /** The one line under the name: what it is doing, or what it did. Empty string for a step with nothing yet to say. */
  readonly line: string;
  /**
   * The refusal's OWN sentence, verbatim, for a step that was refused. `null`
   * otherwise — and never a paraphrase: whatever refused it already wrote the
   * words.
   */
  readonly refusal: string | null;
}

/** The ink and the fill of one mark — the whole visual difference between the four states, in one table. */
const LOOK: Readonly<Record<BootStepState, { readonly background: string; readonly border: string }>> = {
  pending: { background: 'transparent', border: '1.5px dashed var(--pw-mark-edge)' },
  doing: { background: 'var(--pw-glass-mark-live)', border: '2px solid var(--pw-accent)' },
  landed: { background: 'var(--pw-accent)', border: '0 none transparent' },
  refused: { background: 'var(--pw-refuse)', border: '0 none transparent' },
};

/** What each state is called, for somebody who cannot see the mark. Never a colour, never a shape. */
const SAID: Readonly<Record<BootStepState, string>> = {
  pending: 'not started',
  doing: 'in flight',
  landed: 'landed',
  refused: 'refused',
};

export interface BootReportProps {
  readonly steps: readonly BootStepView[];
  /** The list's accessible name. */
  readonly label: string;
}

export interface BootLineProps {
  /** The act happening now, present tense — one line (`./boot.ts` · `bootNow`). */
  readonly line: string;
  /** `true` while something is running: the line's own small mark moves with the stepper's. */
  readonly running: boolean;
}

/**
 * ONE CENTRED LINE UNDER THE STEPPER ROW — the act happening now, and nothing
 * else.
 *
 * ── WHAT IT IS AND IS NOT ──────────────────────────────────────────────────
 * It is a STATUS LINE, not a log entry: present tense, one act, no explanatory
 * clause and no number that is not the point. The explanations and the byte
 * counts are the record's (`./boot.ts` · `askingLogged`, drawn by
 * {@link BootLog}), and this line is what a reader watching a stepper needs.
 *
 * ── AND IT DOES NOT WORK OUT WHAT IS RUNNING ───────────────────────────────
 * Both props are computed in layer 3 from the SAME fold the stepper's spinner
 * reads (`./boot.ts` · `bootNow`). A component that derived *is something
 * running* for itself would make the line and the stepper two owners of that
 * question, which is the bug the whole reshape exists to prevent.
 */
export function BootLine({ line, running }: BootLineProps): JSX.Element {
  return (
    <p
      role="status"
      aria-live="polite"
      data-boot-line={running ? 'running' : 'still'}
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
        margin: '.85rem 0 0',
        fontFamily: 'var(--pw-font-sans)',
        fontSize: 13,
        lineHeight: 1.45,
        textAlign: 'center',
        color: 'var(--pw-mid-2)',
      }}
    >
      {running ? <Mark state="doing" /> : null}
      <span>{line}</span>
    </p>
  );
}

/** One numbered-less mark: the state, and nothing else. `top` lifts it onto a list row's first line; a centred line takes none. */
function Mark({ state, top = 0 }: { readonly state: BootStepState; readonly top?: number }): JSX.Element {
  const look = LOOK[state];
  return (
    <span
      aria-hidden
      style={{
        boxSizing: 'border-box',
        display: 'inline-block',
        flex: '0 0 auto',
        width: 9,
        height: 9,
        marginTop: top,
        borderRadius: '50%',
        background: look.background,
        border: look.border,
        ...(state === 'doing' ? { boxShadow: '0 0 0 3px var(--pw-accent-ring-soft)' } : {}),
      }}
    />
  );
}

/**
 * THE BOOT'S OWN ACCOUNT, ROW BY ROW — for the RECORD DRAWER, which is where
 * detail already lives on this page.
 *
 * This is where the boot's provenance went when the list stopped being the
 * status display: which file, how many bytes, *no total — the response's own
 * content-length is the size of what came over the wire*, how many gestures
 * were made and how many the library refused. Every one of those is a fact
 * about how this desk came to hold what it holds, and the gzip sentence in
 * particular cost a packet to learn.
 */
export function BootLog({ steps, label }: BootReportProps): JSX.Element {
  return (
    <ol
      aria-label={label}
      /* NO LIVE REGION HERE: this is the RECORD, read on purpose, and the one
         thing that announces is the centred line ({@link BootLine}). Two live
         regions for one boot is a page talking over itself. */
      /* `fontFamily`/`fontSize` as LONGHANDS and not the `font` shorthand: a
         shorthand resets every longhand after it, which is the trap
         `./Stepper.tsx` already carries a note about. */
      style={{ listStyle: 'none', margin: '.75rem 0 0', padding: 0, display: 'grid', gap: 4, fontFamily: 'var(--pw-font-sans)', fontSize: 12.5, lineHeight: 1.45 }}
    >
      {steps.map((step) => (
        <li key={step.key} data-boot-step={step.key} data-boot-state={step.state} style={{ display: 'flex', gap: 8, alignItems: 'flex-start', minWidth: 0 }}>
          <Mark state={step.state} top={5} />
          <span style={{ minWidth: 0 }}>
            <b style={{ fontWeight: 500, color: step.state === 'pending' ? 'var(--pw-soft-2)' : 'var(--pw-ink)' }}>{step.name}</b>
            {/* THE STATE IN WORDS, for a reader who cannot see the mark — and in
                Mono, because it is the same kind of thing as a count. */}
            <span style={{ fontFamily: 'var(--pw-font-mono)', fontSize: 9.5, letterSpacing: '0.04em', textTransform: 'uppercase', color: 'var(--pw-soft-2)', marginLeft: 6 }}>{SAID[step.state]}</span>
            {step.line === '' ? null : <span style={{ display: 'block', color: 'var(--pw-mid-2)' }}>{step.line}</span>}
            {/* THE REFUSAL'S OWN SENTENCE, verbatim and VISIBLE — never behind a
                press, and never re-worded: whatever refused it wrote the words. */}
            {step.refusal === null ? null : <span style={{ display: 'block', color: 'var(--pw-refuse-ink)' }}>{step.refusal}</span>}
          </span>
        </li>
      ))}
    </ol>
  );
}
