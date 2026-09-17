/**
 * THE ENTRY DOOR — the landing a reader arrives at, the address that carries
 * what they chose, and the line beside the credit that says what this entry is.
 *
 * THE DESK OPENS ON A QUESTION — a title, one box, one named example, and the
 * whole Protein Data Bank behind it.
 *
 * Every other desk in this repository opens on the file the repository
 * committed. This one keeps that file as its EXAMPLE and puts a search box in
 * front of it, because a demo that can only draw the entry it was written for
 * has not shown that the machinery is general — it has shown that the captions
 * were typed carefully.
 *
 * ── WHICH DOOR A READER'S WORDS GO THROUGH ─────────────────────────────────
 * One rule, and it is `src/prot/archive.ts` · `looksLikeEntryId`: four
 * characters that look like an id open that entry directly (`1ay7` and `1AY7`
 * are the same entry), and anything else is a QUESTION — it goes to the
 * archive's full-text search, and what comes back is listed with each entry's
 * own title, method and chain count, read off the archive's record
 * (`listEntries`). Nothing about a listed entry is written here.
 *
 * ── THE LIST IS WHERE THE REFUSALS START ───────────────────────────────────
 * A listed row can already be one this desk will not open — too large for a
 * browser tab, or with no protein polymer in it at all — and it says so ON THE
 * LIST, with the ceiling named, rather than after a reader has clicked it and
 * waited. That judgement is the gate's (`src/prot/archive.ts` · `gateOf`) and
 * it runs on the archive's record, before anything is downloaded.
 *
 * ── AND THE EXAMPLE IS NOT FETCHED ─────────────────────────────────────────
 * Choosing the example reads the bytes this repository committed
 * (`src/prot/http.ts`, under the site's own base) and makes no call to the
 * archive at all — so the demo works with the network unplugged and the
 * example's provenance stays the one in `data/prot/PROVENANCE.json`. The
 * routing that guarantees it is `openEntryBytes`, and
 * `tests/prot-archive.test.ts` counts the archive calls on that path.
 */
import { useRef, useState } from 'react';
import { EXAMPLE_ENTRY, entryIdRefusal, listEntries, looksLikeEntryId, searchArchive, type ArchiveFetch, type ListedEntry } from '../../src/prot/archive.js';
import type { EntryNote } from '../../src/prot/entryNotes.js';

/** The query parameter that carries the entry, so a reader can share what they are looking at. */
export const ENTRY_PARAM = 'entry';

/** What an address asks for: nothing, an entry, or something that is not an entry id. */
export type UrlEntry = { readonly kind: 'none' } | { readonly kind: 'entry'; readonly entry: string } | { readonly kind: 'refused'; readonly sentence: string };

/**
 * WHAT THE ADDRESS ASKS FOR — `?entry=1ay7` is the entry `1AY7`.
 *
 * Three answers rather than two: an address with no `entry` is a reader who has
 * not asked yet (the landing), and an address whose `entry` is not an id is a
 * reader who asked for something that does not exist — which is a SENTENCE, not
 * a silent fall back to the example. A demo that quietly showed the example
 * would teach a reader that their typo worked.
 */
export function entryInUrl(search: string): UrlEntry {
  const asked = (new URLSearchParams(search).get(ENTRY_PARAM) ?? '').trim();
  if (asked === '') return { kind: 'none' };
  if (!looksLikeEntryId(asked)) return { kind: 'refused', sentence: `the address carries an entry this desk cannot open — ${entryIdRefusal(asked)}` };
  return { kind: 'entry', entry: asked.toUpperCase() };
}

/** The same address with the entry set — or with it removed, which is the way back to the landing. */
export function urlForEntry(entry: string | null, href: string): string {
  const url = new URL(href);
  if (entry === null) url.searchParams.delete(ENTRY_PARAM);
  else url.searchParams.set(ENTRY_PARAM, entry.toUpperCase());
  return url.href;
}

export interface ProtLandingProps {
  /** The desk's own title and caption — the def's words (`src/prot/def.ts` · `PROT_WORDS`), never retyped here. */
  readonly title: string;
  readonly caption: string;
  /** The archive, as a function — `browserArchive` on the page, a fake in a test. */
  readonly doors: ArchiveFetch;
  /** What the reader was just refused, if they arrived here from one. Shown verbatim. */
  readonly refusal?: string | null;
  /** Open an entry. The host puts it in the address and boots the desk. */
  onOpen(entry: string): void;
}

/** What the landing is doing: waiting, asking, listing what came back, or showing why nothing came back. */
type Asked =
  | { readonly status: 'idle' }
  | { readonly status: 'searching'; readonly words: string }
  | { readonly status: 'listed'; readonly words: string; readonly total: number; readonly rows: readonly ListedEntry[] }
  | { readonly status: 'refused'; readonly sentence: string };

const SHELL: React.CSSProperties = { font: '14px/1.6 system-ui, -apple-system, "Segoe UI", sans-serif', color: '#1c2530', background: '#f7f8fa', minHeight: '100vh', display: 'grid', placeItems: 'start center', padding: '3rem 1.25rem' };
const CARD: React.CSSProperties = { maxWidth: '46rem', width: '100%', background: '#fff', border: '1px solid #dfe4ea', borderRadius: 10, padding: '1.6rem 1.75rem' };
const ROW: React.CSSProperties = { display: 'block', width: '100%', textAlign: 'left', font: '13px/1.5 system-ui, -apple-system, "Segoe UI", sans-serif', padding: '.5rem .6rem', borderRadius: 6, border: '1px solid #e2e7ec', background: '#fff', color: '#20303f' };

/**
 * THE LANDING.
 *
 * ```tsx
 * <ProtLanding title={PROT_WORDS.title} caption={PROT_WORDS.caption} doors={browserArchive} onOpen={open} />
 * ```
 */
export function ProtLanding({ title, caption, doors, refusal, onOpen }: ProtLandingProps): JSX.Element {
  const [words, setWords] = useState('');
  const [asked, setAsked] = useState<Asked>({ status: 'idle' });
  /** The question whose answer this page is still waiting for — so a slow answer to an older question never replaces a newer list. */
  const waitingFor = useRef<string | null>(null);

  /** The one rule: an id opens, an empty box opens the example, anything else is a question. */
  async function ask(): Promise<void> {
    const trimmed = words.trim();
    if (trimmed === '') {
      onOpen(EXAMPLE_ENTRY);
      return;
    }
    if (looksLikeEntryId(trimmed)) {
      onOpen(trimmed.toUpperCase());
      return;
    }
    waitingFor.current = trimmed;
    setAsked({ status: 'searching', words: trimmed });
    const found = await searchArchive(trimmed, doors);
    if (waitingFor.current !== trimmed) return;
    if (!found.ok) {
      setAsked({ status: 'refused', sentence: found.sentence });
      return;
    }
    const rows = await listEntries(found.value.ids, doors);
    if (waitingFor.current !== trimmed) return;
    setAsked({ status: 'listed', words: trimmed, total: found.value.total, rows });
  }

  return (
    <div style={SHELL}>
      <div style={CARD}>
        <h1 style={{ margin: '0 0 .4rem', fontSize: '1.15rem' }}>{title}</h1>
        <p style={{ margin: '0 0 1rem', color: '#5a6572', fontSize: '.92rem' }}>{caption}</p>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            void ask();
          }}
          style={{ display: 'flex', gap: '.5rem', flexWrap: 'wrap' }}
        >
          <input
            value={words}
            onChange={(e) => setWords(e.target.value)}
            aria-label="a PDB entry id, or words to search the archive for"
            placeholder={`an entry id like ${EXAMPLE_ENTRY}, or words like "ribonuclease inhibitor"`}
            style={{ flex: '1 1 18rem', font: 'inherit', padding: '.45rem .6rem', border: '1px solid #cfd6de', borderRadius: 6 }}
          />
          <button type="submit" style={{ font: 'inherit', padding: '.45rem .9rem', border: '1px solid #b9c4cf', borderRadius: 6, background: '#eef2f6', cursor: 'pointer' }}>
            Open
          </button>
        </form>
        <p style={{ margin: '.6rem 0 0', color: '#5a6572', fontSize: '.85rem' }}>
          Four characters that look like an entry id ({EXAMPLE_ENTRY}, case-insensitive) open that entry from the RCSB Protein Data Bank&rsquo;s copy of the wwPDB archive. Anything else searches the
          archive&rsquo;s full text and lists what it finds, with each entry&rsquo;s own title, method and chain count read off the archive&rsquo;s record. An empty box opens the example.
        </p>
        <p style={{ margin: '.5rem 0 0', fontSize: '.9rem' }}>
          <button
            type="button"
            onClick={() => onOpen(EXAMPLE_ENTRY)}
            style={{ font: 'inherit', background: 'none', border: 'none', padding: 0, color: '#1c5d99', textDecoration: 'underline', cursor: 'pointer' }}
          >
            Open the example, {EXAMPLE_ENTRY}
          </button>{' '}
          <span style={{ color: '#5a6572' }}>
            — a ribonuclease bound to its inhibitor, and the one entry whose bytes this repository committed: choosing it reads those bytes and calls the archive not at all, so the example works with the
            network unplugged.
          </span>
        </p>
        {refusal === null || refusal === undefined ? null : (
          <p role="status" style={{ margin: '1rem 0 0', padding: '.6rem .7rem', background: '#fdf7f7', border: '1px solid #e6c9c9', borderRadius: 6, color: '#8a2b2b', fontSize: '.88rem' }}>
            {refusal}
          </p>
        )}
        {asked.status === 'idle' ? null : (
          <div style={{ marginTop: '1.1rem' }}>
            {asked.status === 'searching' ? (
              <p role="status" style={{ margin: 0, color: '#5a6572' }}>
                asking the archive&rsquo;s full-text search for &ldquo;{asked.words}&rdquo;…
              </p>
            ) : asked.status === 'refused' ? (
              <p role="status" style={{ margin: 0, color: '#8a2b2b' }}>
                {asked.sentence}
              </p>
            ) : (
              <>
                <p style={{ margin: '0 0 .4rem', color: '#5a6572', fontSize: '.88rem' }}>
                  the archive reports {asked.total.toLocaleString('en-US')} entries whose text matches &ldquo;{asked.words}&rdquo;; here are the first {String(asked.rows.length)}, each one openable unless
                  this desk says why not
                </p>
                <ol aria-label="what the archive found" style={{ listStyle: 'none', padding: 0, margin: 0 }}>
                  {asked.rows.map((row) => (
                    <li key={row.entry} style={{ margin: '.3rem 0' }}>
                      {row.refusal === null ? (
                        <button type="button" style={{ ...ROW, cursor: 'pointer' }} onClick={() => onOpen(row.entry)}>
                          <b>{row.entry}</b> — {row.line}
                        </button>
                      ) : (
                        <div style={{ ...ROW, background: '#fdf7f7', borderColor: '#e6c9c9' }}>
                          <b>{row.entry}</b>
                          {row.line === null ? '' : ` — ${row.line}`} — <span style={{ color: '#8a2b2b' }}>{row.refusal}</span>
                        </div>
                      )}
                    </li>
                  ))}
                </ol>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// ── the entry's own line, on the desk ───────────────────────────────────────

/**
 * WHAT THIS ENTRY IS, BESIDE THE CREDIT — every sentence
 * `src/prot/entryNotes.ts` read off the bytes, and the cost the gate stated
 * before the download.
 *
 * It sits where the entry is NAMED, next to the credit line, because that is
 * where a reader is when they ask what they are looking at. Every sentence is
 * printed VERBATIM: these are facts read off the file or off the archive's own
 * record, and a page that summarised them would be a page adding a claim.
 *
 * An entry with nothing to report shows one line — the cost, when there is one
 * — and an entry with nothing to report and no cost (the committed example)
 * shows only the way back to the search.
 */
export function EntryNotes({ entry, notes, cost, onSearchAgain }: { readonly entry: string; readonly notes: readonly EntryNote[]; readonly cost: string | null; onSearchAgain(): void }): JSX.Element {
  return (
    <div style={{ font: '12px/1.55 system-ui, -apple-system, "Segoe UI", sans-serif', color: '#4a5462', margin: '.4rem 0 0' }}>
      <p style={{ margin: 0 }}>
        Showing entry <b>{entry}</b>.{' '}
        <button type="button" onClick={onSearchAgain} style={{ font: 'inherit', background: 'none', border: 'none', padding: 0, color: '#1c5d99', textDecoration: 'underline', cursor: 'pointer' }}>
          Open another entry
        </button>{' '}
        — the address carries this one (<code>?{ENTRY_PARAM}={entry}</code>), so this page is what you share.
      </p>
      {cost === null ? null : (
        <p style={{ margin: '.3rem 0 0' }}>
          <b>What it cost:</b> {cost}
        </p>
      )}
      {notes.length === 0 ? null : (
        <ul aria-label={`what this desk cannot say about entry ${entry}`} style={{ margin: '.35rem 0 0', paddingLeft: '1.1rem' }}>
          {notes.map((note) => (
            <li key={note.code} style={{ margin: '.2rem 0', color: note.blocking ? '#8a2b2b' : undefined }}>
              <b>{note.code}</b> — {note.sentence}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
