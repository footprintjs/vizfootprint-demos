/**
 * ONE TURN — the same one, on either side of the wire.
 *
 * A turn is: clear the acts, raise the flag, read what is on screen FROM THE
 * RECORD, hand the message to the analyst, read its reply against the log, and
 * put both lines in the conversation. Nothing in that sentence is about HTTP,
 * so none of it lives in `server/doors.ts` any more: the served desk runs this
 * when a key is in the environment, and the published page runs THIS SAME
 * FUNCTION when the key is the visitor's own.
 *
 * The flag is raised INSIDE the try whose finally lowers it. `onScreenNow`
 * walks the whole session, and a throw before the try would leave `turnActive`
 * standing forever — closing chat, the clear control, and the reset door.
 *
 * A failed turn is an OUTCOME, not an exception: both hosts have to show the
 * person the same sentence, and one of them has no status code to put it in.
 */
import type { InteractionSession } from 'vizfootprint/session';
import type { ActivityStep, NndssAnalyst } from './analyst.js';
import { onScreenNow, parseReply, type TranscriptLine, type TranscriptRef } from './reply.js';

/** Asks the panel offers on an empty transcript — each exercises a different verb. */
export const SUGGESTIONS = [
  'Which region reports the most pertussis this year? Save it as a bookmark.',
  'Is gonorrhea tracking its 52-week high across the states?',
  'Where are the silences this week, and what kind are they?',
] as const;

/** What one turn writes into: the analyst, the acts of the turn in flight, the conversation, and the flag. */
export interface TurnDesk {
  readonly analyst: NndssAnalyst;
  /** ONE array for the desk's life, mutated in place — the analyst's own closure holds it. */
  readonly activity: ActivityStep[];
  transcript: TranscriptLine[];
  turnActive: boolean;
}

/** A desk that can also say what is driving it. */
export interface DrivenDesk extends TurnDesk {
  readonly mode: 'live' | 'mock';
  /** The model a live turn names. Absent in mock — nothing is asked of a model. */
  readonly model?: string;
}

/** What the turn said, once its reply was read against the log. */
export interface TurnSaid {
  readonly ok: true;
  readonly text: string;
  readonly refs: readonly TranscriptRef[];
  /** What was lost reading the reply, in plain words. Absent = nothing to say. */
  readonly note?: string;
  readonly correlationId: string;
  readonly activity: readonly ActivityStep[];
}

/** A turn that did not finish — the provider refused, the network failed, the walk fell over. */
export interface TurnFailed {
  readonly ok: false;
  readonly error: string;
  readonly activity: readonly ActivityStep[];
}

export type TurnOutcome = TurnSaid | TurnFailed;

/**
 * ONE TURN of the conversation. The acts land as `agent`-badged commits on the
 * session while it runs, whichever host is running it.
 */
export async function runTurn(desk: TurnDesk, session: InteractionSession, message: string): Promise<TurnOutcome> {
  try {
    desk.activity.length = 0;
    desk.turnActive = true;
    const context = await onScreenNow(session);
    desk.transcript.push({ role: 'user', text: message, context });
    const turn = await desk.analyst.send(message, context);
    // an EXISTENCE check, so the whole history: a cited id either names a commit or it does not
    const known = { commits: new Set(session.commits('anywhere').map((r) => r.id)), bookmarks: new Set(session.bookmarkViews().map((c) => c.id)) };
    const reply = parseReply(turn.text, known, desk.activity);
    const said = { text: reply.text, refs: reply.refs, ...(reply.note !== undefined ? { note: reply.note } : {}) };
    desk.transcript.push({ role: 'analyst', ...said, activity: [...desk.activity] });
    return { ok: true, ...said, correlationId: turn.correlationId, activity: [...desk.activity] };
  } catch (error) {
    const text = error instanceof Error ? error.message : String(error);
    desk.transcript.push({ role: 'error', text, activity: [...desk.activity] });
    return { ok: false, error: text, activity: [...desk.activity] };
  } finally {
    desk.turnActive = false;
  }
}

/** Forget the conversation. The commits the analyst landed stay in the log — a chat is not the record. */
export function forgetConversation(desk: TurnDesk): void {
  desk.transcript.length = 0;
  desk.activity.length = 0;
  desk.analyst.reset();
}

/** What the Analyst panel renders — one shape, whichever host built it. */
export interface AnalystWire {
  readonly mode: 'live' | 'mock';
  readonly model?: string;
  readonly turnActive: boolean;
  readonly activity: readonly ActivityStep[];
  readonly transcript: readonly TranscriptLine[];
  readonly suggestions: readonly string[];
  readonly tools: readonly string[];
}

/**
 * The wire the panel reads. Built here rather than in each host, so a served
 * desk and a page-hosted one can never disagree about what mode they are in.
 */
export function analystWire(desk: DrivenDesk): AnalystWire {
  return {
    mode: desk.mode,
    ...(desk.model !== undefined ? { model: desk.model } : {}),
    turnActive: desk.turnActive,
    activity: desk.activity,
    transcript: desk.transcript,
    suggestions: SUGGESTIONS,
    tools: desk.analyst.tools,
  };
}
