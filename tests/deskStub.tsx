/**
 * THE QUIET DESK — the one projection stub the cell suites share.
 *
 * `useNndssCells` needs a `DeskProjection`, and the desk builds that
 * internally, so a test reaches the cells through a stub: every reader
 * answers the emptiest true thing (no clauses, no words, no verdicts) and
 * every act is a no-op, because a cell that drew differently for a quiet desk
 * would be the thing under test. It lives here once — two suites with two
 * spellings of "quiet" is the drift the cells file itself was merged to end.
 */
import { renderToStaticMarkup } from 'react-dom/server';
import type { DeskProjection } from 'vizfootprint-studio/desk';
import { useNndssCells, type NndssDeskData } from '../web/src/cells.js';

/** A desk with nothing selected, nothing said and nothing to say — the quietest true projection. */
export const QUIET = {
  state: { selections: [], links: [], cleared: [] },
  view: { emit: () => undefined, reencode: () => undefined },
  bound: (_viewId: string, _channel: string, fallback: string) => fallback,
  selFor: () => ({ clauses: new Map(), resolve: 'intersect', selfClauseId: null }),
  fitsOf: () => undefined,
  shown: {},
  columns: [],
  label: (viewId: string) => viewId,
  words: () => null,
  proseOf: () => [],
  altShort: () => undefined,
  readOnly: false,
  say: () => undefined,
  openAside: () => undefined,
  editChart: () => undefined,
  seekBookmark: () => undefined,
  applyPicture: () => undefined,
  savePicture: () => undefined,
  describeCommit: () => undefined,
  // WHY the cast: `DeskProjection` is the desk's own contract, built by a hook the
  // studio does not export. A stub is the only way in from outside, and naming
  // every member above is what keeps it an honest one.
} as unknown as DeskProjection;

/** The cells, built the way the desk builds them: once, from a component body. */
export function cellsOf(data: NndssDeskData, desk: DeskProjection = QUIET): ReturnType<typeof useNndssCells> {
  let built: ReturnType<typeof useNndssCells> = [];
  function Probe(): null {
    built = useNndssCells(desk, data);
    return null;
  }
  renderToStaticMarkup(<Probe />);
  return built;
}

/** A caption's words, tags stripped and the entities static markup escapes put back — so an assertion can quote the sentence a reader sees. */
export const textOf = (node: React.ReactNode): string =>
  renderToStaticMarkup(<>{node}</>)
    .replace(/<[^>]+>/g, '')
    .replace(/&#x27;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&amp;/g, '&');
/** How many `<tag …>` elements a rendering holds. */
export const count = (html: string, tag: string): number => (html.match(new RegExp(`<${tag}[ >]`, 'g')) ?? []).length;
