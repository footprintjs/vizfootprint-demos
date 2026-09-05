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
 * ## Every field it needs, the wire carries
 *
 * `/api/state` serves `session.bookmarkViews()`, and that view carries the
 * store's own CREATION stamp: `by`, and the time under the name `madeAt` (the
 * view spends `at` on the moment a bookmark NAMES — a commit, not a clock).
 * So nothing here is stamped and there is nothing to confess: what the page
 * shows about who made a beat and when is what the desk recorded. It used to
 * carry neither, and this module invented both and printed a note saying so;
 * the fix was the library's door, not a better note. A record that arrives
 * without the stamp is not a row `bookmarkViews()` could have produced, so it
 * is SKIPPED rather than guessed at — the same rule as a bookmark with no name
 * or no moment. (`saved` was never like this: the wire serves the store's own
 * records, whole.)
 */
import { isActor } from 'vizfootprint/cause';
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
}

const isObject = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);

const text = (v: unknown): string | null => (typeof v === 'string' && v.length > 0 ? v : null);

/**
 * The desk's `/api/state` → what a page carries. A refusal, in words, when the
 * body is not a desk state: a capture that guessed would produce a page whose
 * story is not the desk's.
 */
export function deskStory(body: unknown): DeskStory | { readonly error: string } {
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
    const by = raw['by']; // the CREATOR, recorded — never this capture's guess (`isActor` is the library's own reading of that slot)
    const at = text(raw['madeAt']); // the CREATION time, likewise
    if (commitId === null || name === null || !isActor(by) || at === null) continue; // not a record the store could have minted
    bookmarks.push({
      ...(text(raw['id']) === null ? {} : { id: raw['id'] as string }),
      name,
      commitId,
      by,
      at,
    });
  }
  const saved = (Array.isArray(body['saved']) ? body['saved'] : []).filter(isObject) as unknown as RestorableSaved[];
  return { log: records as readonly CommitRecord[], bookmarks, saved };
}
