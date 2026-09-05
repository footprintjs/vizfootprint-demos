/**
 * THE DESK, AS A PAGE CARRIES IT — the pure half of `npm run story:capture`.
 *
 * The single-file story page needs three things off a running desk: the log,
 * the bookmarks that name its beats, and the saved pictures the words cite. The
 * desk serves all three on `GET /api/state`, in the shapes the cockpit reads —
 * and this turns those into the shapes `session.replay`, `restoreBookmarks` and
 * `restoreSaved` take on the way back in.
 *
 * It is a plain function over the wire so `tests/story.test.ts` can hold it to
 * what the desk actually answers, and so the capture script is nothing but a
 * fetch and a write.
 *
 * ## The one thing the wire does not carry
 *
 * `/api/state` serves `session.bookmarkViews()` — a bookmark's **id, its name
 * and the moment it names**, and not who named it or when. The store keeps
 * both; the wire's view of a bookmark has never had a reason to. So the
 * restorable record this builds STAMPS the author and the time, and says so
 * out loud in {@link CAPTURE_NOTE}, which the page prints in its own front
 * matter. Nothing here quietly invents a provenance and lets a reader take it
 * for a recorded one. (`saved` is not like this: the wire serves the store's
 * own records, whole, so the pictures travel with everything they were saved
 * with.)
 */
import type { CommitRecord } from 'vizfootprint/log';
import type { RestorableBookmark, RestorableSaved } from 'vizfootprint/session';

/** What the page's data slot holds for this desk: the bytes the ETL reads, and the shapes the map draws. */
export interface NndssPageData {
  /** The committed CDC snapshot, verbatim — the page runs the same ETL over it that the server does. */
  readonly csv: string;
  /** The state outlines, as `GET /api/geo` serves them. */
  readonly geo: unknown;
}

/** What a capture read off the desk, in the shapes the page's boot takes. */
export interface DeskStory {
  readonly log: readonly CommitRecord[];
  readonly bookmarks: readonly RestorableBookmark[];
  readonly saved: readonly RestorableSaved[];
  /** What this capture could not read off the wire and stamped instead — printed on the page. */
  readonly notes: readonly string[];
}

/**
 * The sentence a captured page prints about its own bookmarks.
 *
 * It is here, beside the stamping, rather than in the page or the build: the
 * place that could not vouch for something is the place that should say so.
 */
export const CAPTURE_NOTE =
  'The bookmarks travelled by name and by the moment each one names — the desk’s /api/state serves the cockpit’s view of a bookmark, which carries no author and no time — so this page stamped both at capture and vouches for neither.';

const isObject = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);

const text = (v: unknown): string | null => (typeof v === 'string' && v.length > 0 ? v : null);

/**
 * The desk's `/api/state` → what a page carries. A refusal, in words, when the
 * body is not a desk state: a capture that guessed would produce a page whose
 * story is not the desk's.
 */
export function deskStory(body: unknown, stampedAt: string): DeskStory | { readonly error: string } {
  if (!isObject(body)) return { error: '/api/state did not answer with an object' };
  const records = body['records'];
  if (!Array.isArray(records)) return { error: '/api/state answered without a `records` array — that is the log, and there is no story without it' };
  const wireBookmarks = Array.isArray(body['bookmarks']) ? body['bookmarks'] : [];
  const bookmarks: RestorableBookmark[] = [];
  for (const raw of wireBookmarks) {
    if (!isObject(raw)) continue;
    // `at` is the moment the bookmark NAMES; `commitId` is the same thing for every bookmark a
    // session makes today (a naming lands no commit of its own), and the fallback is for a log
    // old enough to carry a `bookmark:` commit — where the two really are different moments.
    const commitId = text(raw['at']) ?? text(raw['commitId']);
    const name = text(raw['label']);
    if (commitId === null || name === null) continue; // a bookmark with no name or no moment is not a beat
    bookmarks.push({
      ...(text(raw['id']) === null ? {} : { id: raw['id'] as string }),
      name,
      commitId,
      by: 'user', // STAMPED — see CAPTURE_NOTE
      at: stampedAt, // STAMPED — see CAPTURE_NOTE
    });
  }
  const saved = (Array.isArray(body['saved']) ? body['saved'] : []).filter(isObject) as unknown as RestorableSaved[];
  return {
    log: records as readonly CommitRecord[],
    bookmarks,
    saved,
    notes: bookmarks.length === 0 ? [] : [CAPTURE_NOTE], // nothing was stamped, so nothing to admit
  };
}
