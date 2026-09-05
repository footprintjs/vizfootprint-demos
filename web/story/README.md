# web/story — the desk as one file

`npm run story:capture` then `npm run story:page` → `dist/story/index.html`: the NNDSS desk, its
story and its data in a single file that opens from `file://` with no server. The library ships the
page ([`vizfootprint-ui/story/page`](../../../vizfootprint/ui/src/story/page/README.md)); everything
here is the host's half of it, which is three files and one captured story.

| file | what it is |
|---|---|
| `entry.tsx` | **file one of the recipe.** Imports the def and builds a session out of the payload. A definition is data except its analyses, which are code with a `run()` — so a page cannot carry one, it has to import it, and that is the whole reason a story page is a build |
| `Desk.tsx` | the charts, in two lenses: pinned under the story, and a cockpit to act in. One component draws both, because a reader who opens a door must land somewhere that looks like where they were reading |
| `index.html` | the shell the bundler fills |
| `desk.json` | the captured story — 32 commits, 6 bookmarks, 1 saved picture. Committed, so the build makes the same page twice |
| `../story.vite.config.ts` | **file two of the recipe.** `vite-plugin-singlefile`, plus one hook that writes the payload through the library's own codec and prints what it cost |

## Why the cockpit here is not `web/src/App.tsx`

That one is the SERVER-backed desk: it polls `/api/state`, fetches `/api/rows`, runs the analyst,
edits charts, and shows seven charts and six report panels. None of that exists in a file you open
from `file://`, and most of it would be beside the point there. A story page is something a person was
*sent*; what they need is the charts the story is about and a way to try their own question on them.
So `Desk.tsx` is four charts plus the log and the paths, built from the same library components and
the same host-side aggregation helpers `App.tsx` uses (`../src/derive.ts`).

## The one thing this capture stamps

`/api/state` serves `session.bookmarkViews()` — a bookmark's id, its name and the moment it names, and
not who named it or when. So `deskStory` (`src/nndss/story.ts`) stamps the author and the time and
says so in `CAPTURE_NOTE`, which the page prints in its own front matter. Nothing here quietly invents
a provenance and lets a reader take it for a recorded one. (The saved pictures are not like this: the
wire serves the store's own records, whole.)
