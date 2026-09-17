/**
 * THE TWO TOP BANDS, AS RULES — LAYER 3: pure functions, plain
 * data in, plain data out. No React, no DOM, no session.
 *
 * (It is `bands.ts` and not `chrome.ts` because `./Chrome.tsx` is the
 * component beside it, and two files whose names differ only in case cannot
 * both exist on a case-insensitive filesystem.)
 *
 * ── THE LAW THIS FILE EXISTS TO KEEP ────────────────────────────────────────
 * Not one sentence, count or figure may be typed into the markup. So the two
 * bands at the top of the workbench are folded HERE, off the run and off the
 * entry's own records, and the components below them
 * (`./Chrome.tsx`) receive numbers they cannot argue with:
 *
 *   the method line   `EntryCredit.experiment` (the file's `EXPDTA` record) ·
 *                     `EntryCredit.resolution` (its `REMARK   2`) ·
 *                     `ARCHIVE_LICENCE` (the dedication the fetch script
 *                     recorded, pinned to `data/prot/PROVENANCE.json`);
 *   the facts strip   `ProtCounts.residues` · `ProtCounts.chains` ·
 *                     `InteractionCounts.rows` / `.crossing` / `.byKind`.
 *
 * A fact whose source has not landed is ABSENT from the strip. It is never a
 * zero and never a dash: before the interactions stage lands there is no
 * contact count to state, and stating one would be this page answering for the
 * run.
 */
import { ARCHIVE_LICENCE } from '../../../src/prot/archive.js';
import type { EntryCredit, ProtCounts } from '../../../src/prot/etl.js';
import type { ProtRun } from '../../../src/prot/orchestrator.js';
import type { FactItem } from './Chrome.js';

const num = (n: number): string => n.toLocaleString('en-US');

/**
 * THE METHOD LINE — how the structure was determined, how sharply, and under
 * what licence, each part present only where its source states it.
 *
 * `null` when the file states none of the three, which is an entry whose
 * header records this desk could not read; the header then draws no line at
 * all rather than a line of empty separators.
 */
export function methodLine(credit: EntryCredit): string | null {
  const parts = [
    credit.experiment === '' ? null : credit.experiment.toLowerCase(),
    // the file's own digits, with the unit the record names spelled the way a
    // reader reads it — `1.70 ANGSTROMS.` is `1.70 Å`
    credit.resolution === null ? null : `${credit.resolution} Å`,
    // the short form of the dedication: its first word, taken from the one
    // constant rather than typed beside it
    ARCHIVE_LICENCE.split(' ')[0] ?? ARCHIVE_LICENCE,
  ].filter((p): p is string => p !== null);
  return parts.length === 0 ? null : parts.join(' · ');
}

/**
 * THE FACTS STRIP — the entry's own counts, in the order the design puts them.
 *
 * Four items at most, and each one appears only when what it counts exists:
 *
 *   1. the residues on the table;
 *   2. the chains, with each chain's own count;
 *   3. the contacts, with the crossing ones — only once the interactions act
 *      has landed its answer;
 *   4. the kinds present, with their counts — the engine's own words, in the
 *      engine's own order.
 */
export function factsStrip(counts: ProtCounts, run: ProtRun | null): readonly FactItem[] {
  const pairs = run?.pairs?.counts ?? null;
  const items: FactItem[] = [
    { id: 'residues', parts: [{ value: num(counts.residues), after: 'residues' }] },
    {
      id: 'chains',
      parts: [
        { value: num(counts.chains.length), after: `${counts.chains.length === 1 ? 'chain' : 'chains'} —` },
        // the space before the first chain is deliberate: the part before it
        // ends on the em dash, and `A 96` has to breathe after it
        ...counts.chains.map((chain, index) => ({ before: `${index === 0 ? ' ' : ' · '}${chain.chain} `, value: num(chain.residues) })),
      ],
    },
  ];
  if (pairs !== null) {
    items.push({
      id: 'contacts',
      parts: [
        { value: num(pairs.rows), after: 'non-covalent contacts,' },
        { before: ' ', value: num(pairs.crossing), after: 'of them cross-chain' },
      ],
    });
    if (pairs.byKind.length > 0) {
      items.push({
        id: 'kinds',
        parts: pairs.byKind.map((kind, index) => ({ before: index === 0 ? undefined : ' · ', value: num(kind.contacts), after: kind.kind })),
      });
    }
  }
  return items;
}
