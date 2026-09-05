/**
 * `npm run story:capture` — take the desk's story off a RUNNING demo server and
 * write it beside the page that will carry it.
 *
 * The build (`npm run story:page`) is deliberately NOT this: a build that
 * needed a live server would be a build nobody could run twice the same way.
 * So the capture is its own step, it writes one file, and that file is what the
 * page is built from — the same story every time, until somebody captures a new
 * one.
 *
 * It only ever GETs. The desk is somebody's live session; a capture that
 * dispatched, reset or seeked would be a reader changing the thing it came to
 * read. `capturedAt` is the one time IT records — when this capture ran — and
 * it is never mistaken for anything the desk recorded: every stamp inside the
 * story comes off the wire (see `../src/nndss/story.ts`).
 */
import { writeFile, mkdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { deskStory } from '../src/nndss/story.js';

const HERE = dirname(fileURLToPath(import.meta.url));
const OUT = resolve(HERE, '..', 'web', 'story', 'desk.json');
const API = process.env['DEMO_API'] ?? 'http://localhost:5290';

const res = await fetch(`${API}/api/state`).catch((error: unknown) => {
  throw new Error(`nothing answered ${API}/api/state — start the desk with “npm run serve” (${error instanceof Error ? error.message : String(error)})`);
});
if (!res.ok) throw new Error(`${API}/api/state answered ${String(res.status)} ${res.statusText}`);

const capturedAt = new Date().toISOString();
const story = deskStory(await res.json());
if ('error' in story) throw new Error(story.error);

await mkdir(dirname(OUT), { recursive: true });
await writeFile(OUT, `${JSON.stringify({ from: API, capturedAt, ...story }, null, 2)}\n`, 'utf8');

console.log(`captured ${String(story.log.length)} commits, ${String(story.bookmarks.length)} bookmarks and ${String(story.saved.length)} saved pictures from ${API}`);
console.log(`→ ${OUT}`);
