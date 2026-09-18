/**
 * THE HEADER BAND, AS RULES — LAYER 3: pure functions, plain data in, plain
 * data out. No React, no DOM, no session.
 *
 * (It is `bands.ts` and not `chrome.ts` because `./Chrome.tsx` is the
 * component beside it, and two files whose names differ only in case cannot
 * both exist on a case-insensitive filesystem.)
 *
 * ── THE LAW THIS FILE EXISTS TO KEEP ────────────────────────────────────────
 * Not one sentence, count or figure may be typed into the markup. So the band
 * at the top of the workbench is folded HERE, off the entry's own records, and
 * the component below it (`./Chrome.tsx`) receives a line it cannot argue with:
 *
 *   the method line   `EntryCredit.experiment` (the file's `EXPDTA` record) ·
 *                     `EntryCredit.resolution` (its `REMARK   2`) ·
 *                     `ARCHIVE_LICENCE` (the dedication the fetch script
 *                     recorded, pinned to `data/prot/PROVENANCE.json`).
 *
 * ── AND THE FACTS STRIP THAT USED TO BE HERE ───────────────────────────────
 * `factsStrip` folded the entry's counts into a band under the header: the
 * residues, the chains, the contacts and the kinds. It is DELETED, and the
 * reason is not the height budget — it is that every line of it was a SECOND
 * COPY of what the card it belonged to already said: `185 residues · 2 chains`
 * is the structure card's own foot, `224 rows · 21 cross-chain` is the pair
 * table's, and the kinds are in the interface card's full note. A count stated
 * twice is a count that can disagree with itself.
 */
import { ARCHIVE_LICENCE } from '../../../src/prot/archive.js';
import type { EntryCredit } from '../../../src/prot/etl.js';


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
