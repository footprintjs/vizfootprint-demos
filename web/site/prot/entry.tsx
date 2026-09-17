/**
 * THE PROTEIN DESK, STATIC — the fourth demo, with no server behind it.
 *
 * The boot, in the order a server would do it:
 *   1. the committed PDB entry — 169 KB — over http. NOT through the library's
 *      source port, and the page says so under the picture: a structure file is
 *      not `rows`, `csv` or `json`, so no carrier will read it and nothing
 *      vouches for its version (`src/prot/http.ts`).
 *   2. the ETL, unchanged — it was always pure: atom records in, one residue
 *      table out, every skipped record counted.
 *   3. the dashboard built over that table, with NO acts to land: every column
 *      this desk draws is read off the file.
 *   4. a session view over an IN-PROCESS session (`sessionSource`), not a poll.
 *
 * The one thing this page owns that the other three do not is the CREDIT line,
 * and it is read rather than typed: the entry's own TITLE, AUTHOR and JRNL
 * records, quoted out of the bytes the page just fetched.
 */
import { StrictMode, useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { createSessionView, sessionSheetData, sessionSource } from 'vizfootprint-ui';
import 'vizfootprint-ui/styles.css';
import 'storydeck/storydeck.css';
import { Desk } from 'vizfootprint-studio/desk';
import { loadStructureOverHttp } from '../../../src/prot/http.js';
import { entryCredit, skippedTotal, type EntryCredit } from '../../../src/prot/etl.js';
import { PROT_WORDS, RESIDUES_TABLE } from '../../../src/prot/def.js';
import { openProtSurfaceAsync, type ProtSurface } from '../../../src/prot/session.js';
import { PROT_STORY_FIGURE, useProtCells, type ProtDeskData } from '../../src/protCells.js';
import type { Row } from '../../src/derive.js';
import { Broken, Reading, WhatIsMissing, sentenceOf, siteBase } from '../boot.js';

/** What the boot produces: a live session, the rows it will draw, the data checks, and whose entry this is. */
interface Booted {
  readonly surface: ProtSurface;
  readonly checks: readonly string[];
  readonly credit: EntryCredit;
}

async function boot(): Promise<Booted> {
  const artifact = await loadStructureOverHttp(siteBase());
  const surface = await openProtSurfaceAsync(artifact);
  return { surface, checks: await surface.dashboard.lintData(), credit: entryCredit(artifact.text) };
}

function StaticProtDesk({ booted }: { readonly booted: Booted }): JSX.Element {
  const { surface, checks } = booted;
  const data: ProtDeskData = {
    residues: surface.tables.residues as readonly Row[],
    counts: surface.tables.counts,
    skipped: surface.tables.skipped,
    structure: surface.structure,
  };
  return (
    <Desk
      view={createSessionView(sessionSource(surface.session), { as: 'user', defaultLayout: 'grid' })}
      charts={(desk) => useProtCells(desk, data)}
      data={{ table: RESIDUES_TABLE, sheet: () => sessionSheetData(surface.session, { table: RESIDUES_TABLE }), checks }}
      story={{
        declared: { ...PROT_WORDS },
        author: 'the desk',
        figure: PROT_STORY_FIGURE,
        emptyNote: 'No bookmarks named on this lineage yet — name a bookmark in the time strip and it becomes a section here.',
      }}
    />
  );
}

/** The credit the archive asks for, in the entry's own words. */
function Credit({ credit, characters, skipped }: { readonly credit: EntryCredit; readonly characters: number; readonly skipped: number }): JSX.Element {
  return (
    <p style={{ font: '12px/1.5 system-ui, -apple-system, "Segoe UI", sans-serif', color: '#5a6572', margin: '.4rem 0 0' }}>
      Structure <b>{credit.entry}</b> — {credit.title.toLowerCase()} — from the RCSB Protein Data Bank's copy of the wwPDB archive (
      <code>
        https://files.rcsb.org/download/{credit.entry}.pdb
      </code>
      , {characters.toLocaleString('en-US')} characters). Determined by {credit.experiment.toLowerCase()} and deposited by {credit.depositors}; the primary citation the entry names is{' '}
      <i>{credit.citation}</i>. wwPDB releases its data files into the public domain under the CC0 1.0 Universal dedication, which asks for nothing; the archive asks that the depositors and that citation be
      credited, which is what this line is. Every word of it is read out of the file's own header records — nothing here is retyped. The desk's table keeps {skipped.toLocaleString('en-US')} fewer
      coordinate records than the file has, and says which and why under the viewer.
    </p>
  );
}

function Page(): JSX.Element {
  const [state, setState] = useState<{ readonly status: 'reading' } | { readonly status: 'broken'; readonly sentence: string } | { readonly status: 'ready'; readonly booted: Booted }>({ status: 'reading' });

  useEffect(() => {
    let live = true;
    void boot()
      .then((booted) => live && setState({ status: 'ready', booted }))
      .catch((e: unknown) => live && setState({ status: 'broken', sentence: sentenceOf(e) }));
    return () => {
      live = false;
    };
  }, []);

  if (state.status === 'reading') return <Reading what="one protein structure (169 KB) and the 3D viewer that draws it" />;
  if (state.status === 'broken') return <Broken sentence={state.sentence} />;
  const { surface, credit } = state.booted;
  return (
    <>
      <WhatIsMissing
        extra={
          <>
            {' '}
            And one thing that is missing on <i>every</i> build of this desk, server or not: <b>a version for the structure file</b>. The other three desks declare their tables through the library's source
            port, so a carrier vouches for what it read and every commit carries that version. A structure file is not rows, CSV or JSON — no carrier will take it — so these bytes reach the 3D viewer as an
            argument, and travelling back to an earlier commit gives you the rows that were true then with whatever file the page is holding now. The desk says it under the viewer too, because that is the
            picture it affects.
          </>
        }
      />
      <Credit credit={credit} characters={surface.structure.characters} skipped={skippedTotal(surface.tables.skipped)} />
      <StaticProtDesk booted={state.booted} />
    </>
  );
}

const mount = document.getElementById('root');
if (mount === null) throw new Error('the page has no #root to mount into');
createRoot(mount).render(
  <StrictMode>
    <Page />
  </StrictMode>,
);
