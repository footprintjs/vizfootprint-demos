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
 * ── THIS FILE IS THE SEARCH'S COMPOSITION, not its clothes ─────────────────
 * The clothes are `./workbench/Search.tsx` (presentational) over
 * `./workbench/results.ts` (the rules) over `./workbench/theme.css` (the
 * tokens). This file is the ASKING: which door a reader's words go through,
 * what is in flight, and what came back.
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
import { NoMatch, ResultList, SearchColumn, SearchForm, SearchHeader, SearchHero, SearchProse, TextLink } from './workbench/Search.js';
import { SEARCH_BREADTH, SEARCH_RULE, resultRows } from './workbench/results.js';

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
  | { readonly status: 'refused'; readonly words: string; readonly sentence: string };

/** The field's accessible name — it carries no visible label, and a test names it by this. */
const FIELD = 'a PDB entry id, or words to search the archive for';

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
      setAsked({ status: 'refused', words: trimmed, sentence: found.sentence });
      return;
    }
    const rows = await listEntries(found.value.ids, doors);
    if (waitingFor.current !== trimmed) return;
    setAsked({ status: 'listed', words: trimmed, total: found.value.total, rows });
  }

  const form = (compact: boolean): JSX.Element => (
    <SearchForm
      value={words}
      placeholder={`an entry id like ${EXAMPLE_ENTRY}, or words like "ribonuclease inhibitor"`}
      fieldLabel={FIELD}
      submitLabel="Analyse"
      compact={compact}
      onChange={setWords}
      onSubmit={() => void ask()}
    />
  );

  /** The example, by name — and the sentence that says choosing it fetches nothing. */
  const example = (
    <SearchProse center>
      <TextLink onPress={() => onOpen(EXAMPLE_ENTRY)}>Open the example, {EXAMPLE_ENTRY}</TextLink> — a ribonuclease bound to its inhibitor, and the one entry whose bytes this repository committed: choosing it reads
      those bytes and calls the archive not at all, so the example works with the network unplugged.
    </SearchProse>
  );

  /** What the reader arrived refused with, verbatim. */
  const arrived =
    refusal === null || refusal === undefined ? null : (
      <p role="status" style={{ margin: '1.2rem 0 0', padding: '.6rem .7rem', background: 'var(--pw-glass-card)', border: '1px solid var(--pw-rule-button)', borderRadius: 'var(--pw-r-card)', color: 'var(--pw-refuse-ink)', fontSize: 13.5 }}>
        {refusal}
      </p>
    );

  // ── nobody has asked yet ──────────────────────────────────────────────────
  if (asked.status === 'idle') {
    return (
      <SearchHero title={title}>
        {form(false)}
        {example}
        <SearchProse center>{caption}</SearchProse>
        <SearchProse center>{SEARCH_RULE}</SearchProse>
        {arrived}
      </SearchHero>
    );
  }

  // ── asked: the header form, then whatever came back ───────────────────────
  return (
    <div style={{ minHeight: '100vh' }}>
      <SearchHeader title={title}>{form(true)}</SearchHeader>
      <SearchColumn>
        {asked.status === 'searching' ? (
          <p role="status" style={{ margin: '26px 0 0', fontSize: 14, color: 'var(--pw-mid-2)' }}>
            asking the archive&rsquo;s full-text search for &ldquo;{asked.words}&rdquo;…
          </p>
        ) : asked.status === 'refused' ? (
          <NoMatch heading={`Nothing matched “${asked.words}”.`}>
            {/* THE SERVICE'S OWN ANSWER, verbatim — the heading above is this page
                stating the fact; this is the archive stating the reason. */}
            <SearchProse>{asked.sentence}</SearchProse>
            <SearchProse>{SEARCH_RULE}</SearchProse>
            <SearchProse>{SEARCH_BREADTH}</SearchProse>
            {example}
          </NoMatch>
        ) : (
          <>
            <ResultList
              rows={resultRows(asked.rows)}
              label="what the archive found"
              heading={<>Entries matching &ldquo;{asked.words}&rdquo;</>}
              count={`the archive reports ${asked.total.toLocaleString('en-US')} entries whose text matches “${asked.words}”; here are the first ${String(asked.rows.length)}`}
              onOpen={onOpen}
            />
            <SearchProse>Each row is openable unless this desk says why not — the ceiling is judged on the archive&rsquo;s own record, before a structure file is downloaded at all.</SearchProse>
            {example}
          </>
        )}
        {arrived}
      </SearchColumn>
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
    <div style={{ fontSize: 12, lineHeight: 1.55, color: 'var(--pw-mid-2)' }}>
      <p style={{ margin: 0 }}>
        Showing entry <b>{entry}</b>. <TextLink onPress={onSearchAgain}>Open another entry</TextLink> — the address carries this one (
        <code style={{ fontFamily: 'var(--pw-font-mono)' }}>
          ?{ENTRY_PARAM}={entry}
        </code>
        ), so this page is what you share.
      </p>
      {cost === null ? null : (
        <p style={{ margin: '.3rem 0 0' }}>
          <b>What it cost:</b> {cost}
        </p>
      )}
      {notes.length === 0 ? null : (
        <ul aria-label={`what this desk cannot say about entry ${entry}`} style={{ margin: '.35rem 0 0', paddingLeft: '1.1rem' }}>
          {notes.map((note) => (
            <li key={note.code} style={{ margin: '.2rem 0', color: note.blocking ? 'var(--pw-refuse-ink)' : undefined }}>
              <b>{note.code}</b> — {note.sentence}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
