/**
 * WHAT THE MODEL WAS SERVED — the Why Lens over one turn's recording.
 *
 * The analyst keeps a recording of every turn (`src/nndss/analyst.ts`,
 * `keepRecording`): the run's snapshot, its events and its chart, frozen the
 * way agentfootprint's `recordRun` freezes them. Since agentfootprint 9.88 the
 * agent commits a receipt per LLM call — hashes of the system text, every
 * message and every tool schema, salted with the run — and the Why Lens
 * (`agentfootprint-lens`) reads the receipt back beside the request it
 * rebuilds from the log, as its **Served** tab: each row Verified, or named as
 * a gap with its cause.
 *
 * ONE CURSOR. The lens walks the turn with its own cursor — stop by stop, the
 * Served tab folding at each — and this file builds no second stepper. It
 * hands the lens the recording and gets out of the way.
 */
import { Lens, observeRecording } from 'agentfootprint-lens';
import type { Recording } from 'agentfootprint/observe';
import { useMemo } from 'react';

/** The shape the lens reads back — what `GET /api/analyst/recording?turn=` answers and what the in-page desk holds. */
export type ServedRecording = Parameters<typeof observeRecording>[0];

/**
 * agentfootprint types a recording's `snapshot` as `unknown` (it is
 * footprintjs's object, not its own); the lens types the shape it reads. The
 * bytes are the ones `recordRun` froze — the lens's own fixtures are made the
 * same way — so this bridge is a name for that fact, not a conversion.
 */
export const asServedRecording = (recording: Recording): ServedRecording => recording as ServedRecording;

export function ServedLens({ recording, turn }: { readonly recording: ServedRecording; readonly turn: string }): JSX.Element {
  // observed ONCE per recording: each call replays the whole log and builds a fresh recorder (the lens's own rule)
  const observed = useMemo(() => observeRecording(recording), [recording]);
  return (
    <section aria-label={`what the model was served on ${turn}`} style={{ marginTop: 8, height: 'min(72vh, 760px)', border: '1px solid #d8dee4', borderRadius: 8, overflow: 'hidden', background: '#fff' }}>
      <Lens recorder={observed.recorder} runner={observed.runner} view="engineer" appName="NNDSS analyst" />
    </section>
  );
}
