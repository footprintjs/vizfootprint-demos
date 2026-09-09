/**
 * THE DESK IN THE VISITOR'S OWN BROWSER — the analyst with no server behind it.
 *
 * The served desk (`server/doors.ts`) holds a session, an analyst and a
 * conversation in a process. On the published site there is no process, so the
 * page holds them instead — over the SAME session it is already drawing, so an
 * act the analyst lands appears on the charts exactly as a person's would.
 *
 * The only thing that differs from the served desk is where the key came from:
 * the environment there, the visitor's own browser here (`./key.ts`). Both
 * hand it to `chooseDriver`, and neither goes looking for one.
 */
import type { NndssSurface } from './session.js';
import { chooseDriver, createNndssAnalyst, type ActivityStep } from './analyst.js';
import { analystWire, forgetConversation, runTurn, type AnalystWire, type DrivenDesk } from './turn.js';
import type { TranscriptLine } from './reply.js';

export interface BrowserDesk {
  /** What the panel renders right now — the same shape `GET /api/analyst` answers. */
  wire(): AnalystWire;
  /** One turn. The acts land as `agent`-badged commits on the session while it runs. */
  send(message: string): Promise<AnalystWire>;
  /** Forget the conversation. Every commit the analyst landed stays in the log. */
  forget(): AnalystWire;
}

/**
 * A desk for one key. `key` is the visitor's, already read out of their
 * browser by the page — undefined means no key was given, and the scripted
 * turn drives the same tools with no network at all.
 *
 * WHY a new desk per key rather than a provider you can swap: an analyst holds
 * the conversation it has had, and a conversation that began on the scripted
 * turn is not one a live model should be handed as its own. Changing the key
 * starts a fresh chat; the commit log is untouched, because a chat is not the
 * record.
 *
 * `fetchImpl` is for tests only — the seam that lets one read the request the
 * live driver makes without a network.
 */
export function createBrowserDesk(surface: NndssSurface, key: string | undefined, fetchImpl?: typeof fetch): BrowserDesk {
  const driver = chooseDriver(key, fetchImpl);
  const activity: ActivityStep[] = [];
  const desk: DrivenDesk = {
    analyst: createNndssAnalyst(surface.port, { provider: driver.provider, ...(driver.model !== undefined ? { model: driver.model } : {}), onActivity: (step) => activity.push(step) }),
    mode: driver.mode,
    ...(driver.model !== undefined ? { model: driver.model } : {}),
    activity,
    transcript: [] as TranscriptLine[],
    turnActive: false,
  };
  return {
    wire: () => analystWire(desk),
    async send(message: string): Promise<AnalystWire> {
      // the outcome's own words are already in the transcript — a failed turn
      // is an `error` line the panel shows, not an exception the page must catch
      await runTurn(desk, surface.session, message);
      return analystWire(desk);
    },
    forget(): AnalystWire {
      forgetConversation(desk);
      return analystWire(desk);
    },
  };
}
