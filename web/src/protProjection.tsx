/**
 * THE SESSION, IN THE SHAPE A CELL READS — this page's own `DeskProjection`.
 *
 * ── WHY A PAGE BUILDS ONE AT ALL ────────────────────────────────────────────
 * `./protCells.tsx` draws its cells from a `DeskProjection`: which field each
 * channel is bound to at the cursor, which clause reaches each view through the
 * link graph, the encoding plane's verdicts, the view's words. That contract is
 * `vizfootprint-studio/desk` · `DeskProjection`, and it is the right contract —
 * the cells were written against it and read the SESSION's answers rather than
 * constants of their own.
 *
 * What the library does not export is the FOLD that produces one:
 * `studio/src/desk/projection.tsx` · `useDeskProjection` is internal to the
 * packaged `Desk`. This page does not render that desk (the layout the author
 * drew cannot be expressed inside it — `./protDesk.tsx` says why), so the fold
 * is rebuilt here, out of the library's OWN doors and nothing else:
 *
 *   `boundField`        which field a channel shows (`vizfootprint-ui`)
 *   `selectionForView`  the clause as it reaches a view through the graph
 *   `ProseText`         a view's words, with their refs still clickable
 *   `bookmarkRefTarget` where a named beat's anchor goes
 *
 * Every field below is therefore still one of exactly two things — a PROJECTION
 * of an answer the session already computed, or an ACT whose refusal is printed
 * in the session's own words. Nothing here re-derives a fact from the commit
 * log. That is the desk contract's own law and this file keeps it; **that the
 * law has to be kept twice is a FINDING about the library, not a licence to
 * break it.**
 *
 * ── THE ACTS THIS PAGE DOES NOT OFFER SAY SO ───────────────────────────────
 * Two of the projection's doors open the packaged desk's own furniture — the
 * side drawer and the chart editor — and this page has neither. They are wired
 * to a SENTENCE rather than to nothing: a cell that asked for the editor and got
 * silence would leave a reader pressing a control that does not exist.
 */
import type { ReactNode } from 'react';
import { useCallback, useMemo, useState } from 'react';
import { ProseText, bookmarkRefTarget, boundField, selectionForView, type FitView, type ProseStatusView, type RenderSelection, type SessionView, type SessionViewState } from 'vizfootprint-ui';
import type { DeskProjection } from 'vizfootprint-studio/desk';

export interface ProtProjection {
  readonly desk: DeskProjection;
  /** What the page's own acts last said went wrong, or `null` — shown in the desk's notice line. */
  readonly notice: string | null;
}

/** The author, as a tooltip — the same three facts `studio/src/desk/prose.tsx` · `authorTitle` puts there. */
const authorTitle = (p: ProseStatusView): string => `${p.author.kind}${p.author.by !== undefined ? ` · ${p.author.by}` : ''}${p.author.model !== undefined ? ` · ${p.author.model}` : ''}`;

/**
 * A VIEW'S VISIBLE WORDS, with who wrote them and whether they went stale.
 *
 * `altShort`/`altLong` are left out: they are the chart's ACCESSIBLE name and
 * reach a reader through the chart itself (`desk.altShort` hands them to the
 * cell's `ariaLabel`), so printing them here would say everything twice. A STALE
 * slot is shown and marked, never hidden and never re-worded — the library
 * judges every slot at every read, and a page that dropped the stale ones would
 * be deciding on the reader's behalf that the words no longer count.
 */
function ProseLines({ lines, onSeek, onBookmark, describeCommit }: { readonly lines: readonly ProseStatusView[]; onSeek(id: string): void; onBookmark(ref: string): void; describeCommit(id: string): string | undefined }): ReactNode {
  const visible = lines.filter((p) => p.slot !== 'altShort' && p.slot !== 'altLong');
  if (visible.length === 0) return null;
  return (
    <span style={{ display: 'block', marginTop: 5, fontSize: 11.5, lineHeight: 1.45 }}>
      {visible.map((p) => (
        <span key={p.slot} style={{ display: 'block', color: p.status === 'stale' ? '#8a5a2b' : '#5a6572', opacity: p.status === 'derived' ? 0.75 : 1 }} title={p.status === 'stale' ? `stale — moved: ${p.changed.join(', ')}` : authorTitle(p)}>
          <span style={{ fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace', fontSize: 10.5, opacity: 0.6, marginRight: 4 }}>{p.slot}</span>{' '}
          <ProseText text={p.text} refs={p.refs} onSeek={onSeek} onBookmark={onBookmark} describeCommit={describeCommit} />
          {p.status === 'stale' ? <span style={{ fontSize: 10.5 }}> stale · {p.changed.join(', ')} moved</span> : null}
          {p.status === 'derived' ? <span style={{ fontSize: 10.5 }}> derived</span> : null}
          {p.author.kind === 'agent' ? <span style={{ fontSize: 10.5 }}> by the analyst</span> : null}
        </span>
      ))}
    </span>
  );
}

/**
 * THE PROJECTION, over one session view.
 *
 * ```tsx
 * const state = useSessionView(view);
 * const { desk, notice } = useProtProjection(view, state);
 * const cells = useProtCells(desk, data);
 * ```
 */
export function useProtProjection(view: SessionView, state: SessionViewState): ProtProjection {
  const [notice, setNotice] = useState<string | null>(null);

  const labels = useMemo(() => Object.fromEntries(state.views.map((v) => [v.viewId, v.label ?? v.viewId])), [state.views]);
  const label = useCallback((viewId: string): string => labels[viewId] ?? viewId, [labels]);

  // What each view SHOWS: followed channels laid over its own. Edits still go to `encodings`.
  const shown = state.effectiveEncodings ?? state.encodings;
  const columns = state.columns[state.defaultTable] ?? [];

  const proseOf = (viewId: string): readonly ProseStatusView[] => state.views.find((v) => v.viewId === viewId)?.prose ?? [];

  /** The words a commit anchor shows on hover — the same sentence everywhere. */
  const describeCommit = (id: string): string | undefined => {
    const c = state.commits.find((x) => x.id === id);
    return c === undefined ? undefined : `${c.label}${c.intent !== undefined ? ` — ${c.intent}` : ''}`;
  };

  /**
   * A NAMED BEAT, by the ID a note's link carries — the library's own resolver
   * (`bookmarkRefTarget`) and not a `find` of this page's: it takes the id first,
   * so renaming a bookmark leaves every note working, and still accepts a label
   * for words written before ids existed.
   */
  const seekBookmark = (ref: string): void => {
    const commitId = bookmarkRefTarget(state.bookmarks, ref);
    if (commitId === null) setNotice(`no bookmark on this desk is called "${ref}", so that anchor has nowhere to go`);
    else void view.seek(commitId);
  };

  /**
   * A saved picture is saved LOGIC, so both doors go through the library's own
   * store and never through a commit. Applying is JUDGED FIRST — a picture that
   * could land nothing clears nothing and says why — and BOTH answers are
   * printed: a refusal is the whole point of judging first, and a partial apply
   * must not read as a clean one.
   */
  const applyPicture = (savedId: string): void => {
    void view
      .applySaved(savedId)
      .then((r) => {
        if (!r.ok) return setNotice(r.sentence);
        setNotice(r.refused.length === 0 ? null : `"${r.name}" came back without ${r.refused.map((c) => `${label(c.viewId)} (${c.rejected})`).join('; ')}`);
      })
      .catch((e: unknown) => setNotice(`the picture was not applied: ${e instanceof Error ? e.message : String(e)}`));
  };
  const savePicture = (name: string, what?: { readonly viewId: string }): void => {
    void view
      .saveSelection(name, what ?? { live: 'all' })
      .then((r) => setNotice(r.ok ? null : r.sentence))
      .catch((e: unknown) => setNotice(`the picture was not saved: ${e instanceof Error ? e.message : String(e)}`));
  };

  const desk: DeskProjection = {
    state,
    view,
    // asked by ADDRESS, because `shown` is keyed by one
    bound: (address, channel, fallback) => boundField(shown[address] ?? {}, channel, fallback),
    selFor: (self: string | null): RenderSelection => selectionForView(state.selections, self, 'intersect', state.links, state.cleared),
    // THE PLANE'S VERDICTS at a view's address. This def declares no LAYERED
    // view (`src/prot/def.ts` · `protEncodings` binds six plain addresses), so
    // there is no `viewId~layerId` to resolve here; a layer added to it would
    // need the library's `layerAddress` the way the packaged desk's fold does.
    fitsOf: (address: string): Readonly<Record<string, readonly FitView[]>> | undefined => state.views.find((v) => v.viewId === address)?.fits,
    shown,
    columns,
    label,
    words: (viewId: string): ReactNode => <ProseLines lines={proseOf(viewId)} onSeek={(id) => void view.seek(id)} onBookmark={seekBookmark} describeCommit={describeCommit} />,
    proseOf,
    altShort: (viewId: string): string | undefined => proseOf(viewId).find((p) => p.slot === 'altShort')?.text,
    // NO PRESENT MODE on this page (see `./protDesk.tsx`), so nothing is ever
    // read-only: a `true` here would grey controls for a mode a reader cannot
    // enter or leave.
    readOnly: false,
    say: setNotice,
    // THE TWO DOORS THIS PAGE DOES NOT HAVE — answered in words, never in
    // silence. Both belong to the packaged desk's side drawer.
    openAside: (tabId) => setNotice(`this page has no side drawer, so there is no "${tabId}" panel to open — the packaged desk (the other three demos) is where that lives`),
    editChart: (viewId) =>
      setNotice(`this page has no chart editor drawer, so the ${label(viewId)} chart cannot be edited from here — click its axis label instead: the encoding picker rides the chart itself and lands the same commit`),
    seekBookmark,
    applyPicture,
    savePicture,
    describeCommit,
  };

  return { desk, notice };
}
