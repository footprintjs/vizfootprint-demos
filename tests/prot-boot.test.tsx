// @vitest-environment jsdom
/**
 * THE PAGE SAYS WHAT IT IS DOING WHILE IT DOES IT — and the two distinctions
 * that make that honest rather than decorative.
 *
 * The author watched the served desk boot behind one static paragraph and asked
 * why it was not live status. The boot really performs six http reads, an ETL, a
 * dashboard build, three probe gestures, four stages and a model call, and
 * reported none of them. What is asserted here is what a reader can now read,
 * and — more importantly — the three things the report may NOT say:
 *
 *   1. **A STEP THAT HAS NOT HAPPENED YET IS NOT A STEP THAT FAILED.**
 *      `pending` and `refused` are different words, different marks and
 *      different facts (`web/src/workbench/boot.ts` · `BootStepState`).
 *   2. **A TOTAL IS REPORTED ONLY WHEN IT IS KNOWN.** Bytes-so-far is always a
 *      fact; `content-length` is the size of what came over the wire, so a
 *      total is kept only where it agrees with the bytes counted, and *unknown*
 *      is a first-class answer rather than a zero.
 *   3. **THE SERVED BOOT NEVER SAYS *NOT ON THIS BUILD* ABOUT STAGE 5** — the
 *      bug in the author's own screenshot — **and the published build still
 *      does**, untouched.
 *
 * Nothing here needs a key, a network call or a model.
 */
import { describe, expect, it } from 'vitest';
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import type { ReactElement } from 'react';
import { ANNOTATION_ACT, CONSERVATION_ACT, CONSERVATION_BASIS_COLUMN, CONSERVATION_COLUMN, CONTACTS_ACT, PROT_STAGES, SURFACE_ACT } from '../src/prot/analyses.js';
import { BLOCKED_TAG, PROT_PLAN, planStepOf } from '../src/prot/plan.js';
import { HOTSPOTS_ACT, HOTSPOTS_STAGE } from '../src/prot/hotspots.js';
import { PROT_ANNOTATION_FILES, PROT_COMMITTED_READS, PROT_CONSERVATION_FILES, PROT_FILES, type FileRead } from '../src/prot/http.js';
import type { ActOutcome } from '../src/prot/orchestrator.js';
import { NOTHING_REPORTED, bootNow, bootSteps, bytesSaid, readsSaid, type BootReport } from '../web/src/workbench/boot.js';
import { BootLine, BootLog } from '../web/src/workbench/BootReport.js';
import { stepperStages } from '../web/src/protStages.js';
import { stepViews } from '../web/src/workbench/steps.js';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

/** The declared reads, in the order a boot of the committed entry makes them. */
/**
 * EVERY FILE A SERVED BOOT OF THE COMMITTED ENTRY READS — the structure, the
 * conservation stage's five and the annotation stage's four.
 *
 * The annotation stage reads seven and four of them are its own: the entity
 * record and the two Pfam match records belong to the conservation stage and
 * are counted once, where they are declared (`src/data/files.ts`).
 */
const READS: readonly string[] = [PROT_FILES.structure, ...PROT_CONSERVATION_FILES, ...PROT_ANNOTATION_FILES];

/** One file that came back — `total` absent by default, because that is the ordinary case (see the header). */
const read = (file: string, bytes: number, total: number | null = null): FileRead => ({ file, at: `http://localhost/api/prot/${file}`, bytes, total });

/** A boot that has reported everything up to the point named. */
const reported = (over: Partial<BootReport> = {}): BootReport => ({ ...NOTHING_REPORTED, ...over, reads: { ...NOTHING_REPORTED.reads, total: PROT_COMMITTED_READS, ...over.reads } });

const landed = (over: Partial<ActOutcome>): ActOutcome => ({ stage: 'interactions', act: CONTACTS_ACT, commit: 'c1', refusal: null, materialized: [], ...over });

async function mount(element: ReactElement): Promise<{ readonly words: () => string; readonly rows: () => readonly HTMLElement[]; readonly stateOf: (key: string) => string | null; readonly unmount: () => Promise<void> }> {
  const host = document.createElement('div');
  document.body.appendChild(host);
  const root = createRoot(host);
  await act(async () => {
    root.render(element);
  });
  return {
    words: () => (host.textContent ?? '').replace(/\s+/g, ' '),
    rows: () => [...host.querySelectorAll('[data-boot-step]')] as HTMLElement[],
    stateOf: (key) => host.querySelector(`[data-boot-step="${key}"]`)?.getAttribute('data-boot-state') ?? null,
    unmount: async () => {
      await act(async () => {
        root.unmount();
      });
      host.remove();
    },
  };
}

// ── the steps, in order ──────────────────────────────────────────────────────

describe('every step of the boot is reported, in the order it happens', () => {
  it('names the reads, the ETL, the build, the probes, the five stages and the model call — nine rows, in that order', () => {
    const steps = bootSteps(NOTHING_REPORTED);
    // IN THE PLAN'S PUBLISHED ORDER, which is not the dispatch order: the
    // annotation stage is dispatched second and published sixth, so it is the
    // last stage row here and the second one to fill.
    expect(steps.map((step) => step.key)).toEqual(['reads', 'search', 'build', 'probe', 'conservation', 'surface', 'interactions', HOTSPOTS_STAGE, 'annotation']);
    /*
      AND THE STAGE ROWS ARE NAMED BY THE PLAN, never by this fold: the plan is
      the one declaration of what each step is called (`src/prot/plan.ts`), and
      a boot report with a name of its own would be a second spelling of a
      declared label — the thing this repository refuses.
    */
    for (const stage of ['search', 'conservation', 'surface', 'interactions', HOTSPOTS_STAGE, 'annotation']) {
      expect(steps.find((step) => step.key === stage)!.name).toBe(planStepOf(stage)!.name);
    }
    // the four stages the page's own sentence promises are plan steps 1 to 4
    expect(PROT_PLAN.slice(0, 4).map((step) => step.stage)).toEqual(['search', 'conservation', 'surface', 'interactions']);
  });

  it('a boot that has reported NOTHING says every step is pending, and not one of them is refused', () => {
    const steps = bootSteps(NOTHING_REPORTED);
    expect(steps.every((step) => step.state === 'pending')).toBe(true);
    expect(steps.every((step) => step.refusal === null)).toBe(true);
  });

  it('fills in order: a step is pending, then doing, then landed — and the rows before it stay landed', () => {
    const half = reported({
      reads: { done: READS.map((file) => read(file, 1000)), asking: null, total: PROT_COMMITTED_READS, refusal: null },
      parsed: { residues: 185, chains: 2 },
      built: { views: 7, acts: 4, rows: 185 },
      probed: { asked: 3, refused: 3 },
      outcomes: [landed({ stage: 'conservation', act: CONSERVATION_ACT, materialized: [CONSERVATION_COLUMN, CONSERVATION_BASIS_COLUMN] })],
    });
    const steps = bootSteps(half);
    const state = (key: string): string => steps.find((step) => step.key === key)!.state;
    expect(state('reads')).toBe('landed');
    expect(state('search')).toBe('landed');
    expect(state('build')).toBe('landed');
    expect(state('probe')).toBe('landed');
    expect(state('conservation')).toBe('landed');
    /*
      EXACTLY ONE STAGE IS IN FLIGHT — the orchestrator awaits each stage before
      the next starts, so *the first stage that has not answered, in DISPATCH
      order* is the honest answer and every other unanswered one is pending.
      The def dispatches `interactions` before `surface` while the plan
      publishes them the other way round, and it dispatches the ANNOTATION
      stage SECOND while the plan publishes it sixth (`src/prot/plan.ts` and
      `src/prot/analyses.ts` · `PROT_STAGES` say why), so the row that moves is
      not the next row on the screen — and that is the point of reading the two
      orders apart.
    */
    expect(PROT_STAGES.map((stage) => stage.stage)).toEqual(['conservation', 'interactions', 'annotation', 'surface']);
    expect(state('interactions')).toBe('doing');
    expect(state('annotation')).toBe('pending');
    expect(state('surface')).toBe('pending');
    expect(state(HOTSPOTS_STAGE)).toBe('pending');
    expect(steps.every((step) => step.refusal === null)).toBe(true);
  });

  it('nothing is in flight before the session exists — every stage is pending, because nothing has been dispatched at all', () => {
    const steps = bootSteps(reported({ parsed: { residues: 185, chains: 2 } }));
    for (const stage of ['conservation', 'surface', 'interactions']) expect(steps.find((step) => step.key === stage)!.state).toBe('pending');
  });

  it('each landed stage says what it put on the desk — the columns its own act landed, never a count computed here', () => {
    const steps = bootSteps(
      reported({
        built: { views: 7, acts: 4, rows: 185 },
        outcomes: [landed({ stage: 'surface', act: SURFACE_ACT, materialized: ['sasa', 'relative_sasa'] })],
      }),
    );
    const surface = steps.find((step) => step.key === 'surface')!;
    expect(surface.state).toBe('landed');
    expect(surface.line).toContain('landed 2 columns');
    expect(surface.line).toContain('sasa, relative_sasa');
  });

  it('the ETL, the build and the probes each report their own counts — and the probes say a refusal is the answer they wanted', () => {
    const steps = bootSteps(reported({ parsed: { residues: 185, chains: 2 }, built: { views: 7, acts: 4, rows: 185 }, probed: { asked: 3, refused: 3 } }));
    expect(steps.find((step) => step.key === 'search')!.line).toContain('185 residues in 2 chains');
    expect(steps.find((step) => step.key === 'build')!.line).toContain('7 views and 4 declared acts over 185 rows');
    const probe = steps.find((step) => step.key === 'probe')!;
    expect(probe.line).toContain('3 gestures made, 3 refused');
    expect(probe.line).toContain('a refusal is the answer this step wants');
  });
});

// ── pending is not refused ───────────────────────────────────────────────────

describe('a step that has not happened is NOT a step that failed', () => {
  it('a refused stage carries the refusal’s OWN sentence, verbatim, and a pending one carries none', () => {
    const sentence = 'act "residueSurface" threw: the solvent probe found no polymer atom to roll over';
    const steps = bootSteps(reported({ built: { views: 7, acts: 4, rows: 185 }, outcomes: [landed({ stage: 'surface', act: SURFACE_ACT, commit: null, refusal: sentence })] }));
    const surface = steps.find((step) => step.key === 'surface')!;
    expect(surface.state).toBe('refused');
    // VERBATIM — not re-worded, not summarised
    expect(surface.refusal).toBe(sentence);
    const pending = steps.find((step) => step.key === HOTSPOTS_STAGE)!;
    expect(pending.state).toBe('pending');
    expect(pending.refusal).toBe(null);
    expect(pending.line).toContain('nothing has been asked yet');
  });

  it('the four states are four MARKS and four WORDS on screen, so a reader can tell pending from refused at a glance', async () => {
    const view = await mount(
      <BootLog
        label="what this page is doing right now, step by step"
        steps={[
          { key: 'a', name: 'pending step', state: 'pending', line: '', refusal: null },
          { key: 'b', name: 'doing step', state: 'doing', line: 'in flight', refusal: null },
          { key: 'c', name: 'landed step', state: 'landed', line: 'landed', refusal: null },
          { key: 'd', name: 'refused step', state: 'refused', line: 'refused', refusal: 'the library’s own sentence' },
        ]}
      />,
    );
    expect(view.stateOf('a')).toBe('pending');
    expect(view.stateOf('d')).toBe('refused');
    // the state IS IN WORDS for somebody who cannot see the mark, and the two
    // are different words
    expect(view.words()).toContain('not started');
    expect(view.words()).toContain('refused');
    // and the refusal's own sentence is VISIBLE, never behind a press
    expect(view.words()).toContain('the library’s own sentence');
    await view.unmount();
  });

  it('a read that was refused is the READS row’s refusal and leaves every later row pending', () => {
    const steps = bootSteps(reported({ reads: { done: [read(PROT_FILES.structure, 169_371)], asking: null, total: PROT_COMMITTED_READS, refusal: 'the committed file at …/PF00545-seed.sto answered 404 Not Found' } }));
    expect(steps.find((step) => step.key === 'reads')!.state).toBe('refused');
    expect(steps.find((step) => step.key === 'reads')!.refusal).toContain('404');
    expect(steps.filter((step) => step.key !== 'reads').every((step) => step.state === 'pending')).toBe(true);
  });
});

// ── the total, only when it is known ────────────────────────────────────────

describe('a total is reported only when it is known, and UNKNOWN is a first-class answer', () => {
  it('says the bytes and says there is no total — never a zero and never a percentage of a guess', () => {
    expect(bytesSaid(169_371, null)).toContain('169,371 bytes read');
    expect(bytesSaid(169_371, null)).toContain('no total');
    // the measured reason is in the sentence, because it is the thing a later
    // reader would otherwise "fix"
    expect(bytesSaid(169_371, null)).toContain('content-length is the size of what came over the wire');
    expect(bytesSaid(169_371, null)).not.toContain(' 0 ');
  });

  it('says BOTH numbers where the total is known — which is exactly where it has been reached', () => {
    expect(bytesSaid(169_371, 169_371)).toBe('169,371 of 169,371 bytes');
  });

  it('the whole boot’s byte total is unknown as soon as ONE read’s was — a sum with a guess in it is a guess', () => {
    const known = readsSaid({ done: [read('a', 100, 100), read('b', 200, 200)], asking: null, total: 2, refusal: null });
    expect(known).toContain('300 of 300 bytes');
    const mixed = readsSaid({ done: [read('a', 100, 100), read('b', 200, null)], asking: null, total: 2, refusal: null });
    expect(mixed).toContain('300 bytes read, no total');
  });

  it('counts the FILES out of a total that is known before the first read — the list is declared', () => {
    expect(PROT_COMMITTED_READS).toBe(READS.length);
    const asking = readsSaid({ done: [read(PROT_FILES.structure, 169_371)], asking: PROT_CONSERVATION_FILES[0]!, total: PROT_COMMITTED_READS, refusal: null });
    expect(asking).toContain('file 2 of 10');
    expect(asking).toContain(`reading ${PROT_CONSERVATION_FILES[0]!}`);
  });

  it('and says the count is NOT KNOWN for an entry read from the archive, rather than borrowing the committed entry’s six', () => {
    const said = readsSaid({ done: [read('somewhere', 400)], asking: null, total: null, refusal: null });
    expect(said).toContain('1 file');
    expect(said).toContain('not known');
    expect(said).not.toContain('of 6');
  });
});

// ── THE BUG IN THE AUTHOR'S OWN SCREENSHOT ──────────────────────────────────

/**
 * DURING BOOT THE STEPPER MARKED STAGE 5 *NOT ON THIS BUILD* — on the build
 * that was about to run it.
 *
 * The mark was right about the PUBLISHED build and false about the one drawing
 * it. Both directions are pinned here, because a fix that made the served page
 * honest by making the published one lie would be a worse bug than the one it
 * replaced.
 */
describe('the served boot says stage 5 is PENDING; the published build still says NOT ON THIS BUILD', () => {
  /** What the page hands the stepper during its own boot — it asked the door before it opened the entry. */
  const SERVED = { awaiting: { [HOTSPOTS_STAGE]: 'not-run' } } as const;

  it('the served boot NEVER shows the static-build sentence for stage 5 — at any point of the boot', () => {
    /** Every moment of a boot: nothing back, then each act in turn. */
    const moments: readonly (readonly ActOutcome[])[] = [
      [],
      [landed({ stage: 'conservation', act: CONSERVATION_ACT, materialized: [CONSERVATION_COLUMN] })],
      [landed({ stage: 'conservation', act: CONSERVATION_ACT, materialized: [CONSERVATION_COLUMN] }), landed({ stage: 'surface', act: SURFACE_ACT, materialized: ['sasa'] })],
      [
        landed({ stage: 'conservation', act: CONSERVATION_ACT, materialized: [CONSERVATION_COLUMN] }),
        landed({ stage: 'surface', act: SURFACE_ACT, materialized: ['sasa'] }),
        landed({ stage: 'interactions', act: CONTACTS_ACT, materialized: ['contacts'] }),
      ],
    ];
    for (const outcomes of moments) {
      const five = stepperStages(outcomes, null, SERVED).find((stage) => stage.stage === HOTSPOTS_STAGE)!;
      expect(five.blockedBy, 'a build that holds a slot for stage 5 is not blocked on it').toBe(null);
      expect(five.state).toBe('not-run');
      // NOT THE PLAN'S PARAGRAPH — it is about a static page, and quoting it
      // here is the whole of the bug
      expect(five.detail).toBe(null);
      expect(five.subtitle).not.toContain('cannot perform');
      // and the WORD under the mark is the state's, which is no word at all
      expect(stepViews(stepperStages(outcomes, null, SERVED), null, false)[4]!.tag).toBe(null);
      expect(stepViews(stepperStages(outcomes, null, SERVED), null, false)[4]!.look).toBe('not-run');
    }
  });

  it('and says RUNNING, with the only moving mark, while the ask is in flight', () => {
    const stages = stepperStages([], null, { awaiting: { [HOTSPOTS_STAGE]: 'running' } });
    const five = stages.find((stage) => stage.stage === HOTSPOTS_STAGE)!;
    expect(five.state).toBe('running');
    expect(five.subtitle).toContain('asking now');
    // and it says the law out loud: nothing of the answer is shown yet
    expect(five.subtitle).toContain('no part of an answer is shown until the whole of it is frozen');
    expect(stepViews(stages, null, false)[4]!.look).toBe('running');
  });

  it('an OUTCOME still wins over what the host expected — a landed ranking, and a refusal with its own sentence', () => {
    const ranked = stepperStages([{ stage: HOTSPOTS_STAGE, act: HOTSPOTS_ACT, commit: 's5', refusal: null, materialized: ['hotspot_rank', 'hotspot_cites', 'hotspot_reason'] }], null, SERVED).find(
      (stage) => stage.stage === HOTSPOTS_STAGE,
    )!;
    expect(ranked.state).toBe('landed');
    expect(ranked.commit).toBe('s5');
    const refused = stepperStages([{ stage: HOTSPOTS_STAGE, act: HOTSPOTS_ACT, commit: null, refusal: 'this process has no key', materialized: [] }], null, SERVED).find((stage) => stage.stage === HOTSPOTS_STAGE)!;
    expect(refused.state).toBe('refused');
    expect(refused.detail).toBe('this process has no key');
  });

  it('THE PUBLISHED BUILD IS UNTOUCHED — with no host statement at all, stage 5 is blocked by this build and says so', () => {
    const five = stepperStages([], null).find((stage) => stage.stage === HOTSPOTS_STAGE)!;
    expect(five.state).toBe('blocked');
    expect(five.blockedBy).toBe('this build');
    expect(five.detail).toContain('a static page cannot hold the key');
    expect(stepViews(stepperStages([], null), null, false)[4]!.tag).toBe(BLOCKED_TAG['this build']);
    expect(stepViews(stepperStages([], null), null, false)[4]!.tag).toBe('not on this build');
  });

  it('and a host statement about stage 5 changes NOTHING about step 6, which this build really does perform', () => {
    /*
      IT USED TO ASSERT THE OPPOSITE, and the change is the packet rather than
      a loosened test: step 6 was blocked by US, so a host saying something
      about step 5 had to leave step 6's blocked card alone. Step 6 is now a
      stage the def dispatches an act for, on EVERY build, so what has to be
      left alone is its LANDED state — and with no outcome offered it is a
      declared stage that has not been dispatched, never a blocked one.
    */
    const six = stepperStages([], null, SERVED).find((stage) => stage.stage === 'annotation')!;
    expect(six.blockedBy).toBe(null);
    expect(six.state).toBe('not-run');
    expect(six.subtitle).toContain('declared, and not dispatched on this session');
  });
});

// ── the reshape: the stepper carries the progress, one line sits under it ────

/**
 * THE AUTHOR SAW THE BOOT LIVE AND RESHAPED IT: *"can we take the update below
 * the stage steps row, sort of centred — we don't want detail of lists, just
 * status update, a small spinner around that stage."*
 *
 * It is this desk's own law rather than taste — **the stage stepper IS the
 * cursor** — so a list narrating the same progression beside it is a SECOND
 * ANSWER to one question. What is asserted here is that the two faces of that
 * one question have ONE OWNER, that the spinner never lands on a step nothing
 * is doing, and that the detail MOVED rather than vanished.
 */
describe('ONE OWNER for what is happening: the spinner and the centred line', () => {
  const at = (over: Partial<BootReport>): BootReport => reported(over);

  it('the line is present tense, one act, and carries no number that is not the point', () => {
    expect(bootNow(at({})).line).toBe('reading the committed files');
    expect(bootNow(at({ reads: { done: [read(READS[0]!, 169_371)], asking: READS[1]!, total: PROT_COMMITTED_READS, refusal: null } })).line).toBe('reading the committed files · 2 of 10');
    expect(bootNow(at({ reads: { done: READS.map((file) => read(file, 1000)), asking: null, total: PROT_COMMITTED_READS, refusal: null }, parsed: { residues: 185, chains: 2 } })).line).toBe('building the dashboard over 185 rows');
    expect(bootNow(at({ reads: { done: [read(READS[0]!, 169_371)], asking: null, total: PROT_COMMITTED_READS, refusal: null }, parsed: { residues: 185, chains: 2 } })).line).toBe('parsing 185 residues in 2 chains');
    expect(bootNow(at({ parsed: { residues: 185, chains: 2 }, built: { views: 7, acts: 4, rows: 185 } })).line).toBe('asking each chart whose column has not landed');
    /*
      AND NO BYTE COUNT REACHES IT. The author's rule: a number appears only
      where it is the point — *6 of 6* yes, *335,217 bytes* no, because that is
      the record's business ({@link bootSteps}, drawn in the record drawer).
    */
    for (const report of [at({}), at({ reads: { done: READS.map((file) => read(file, 55_555)), asking: null, total: PROT_COMMITTED_READS, refusal: null }, parsed: { residues: 185, chains: 2 } })]) {
      expect(bootNow(report).line).not.toContain('55,555');
      expect(bootNow(report).line).not.toContain('content-length');
      expect(bootNow(report).line).not.toContain('bytes');
    }
  });

  it('a step that produced a refusal is not dressed as progress', () => {
    expect(bootNow(at({ reads: { done: [], asking: null, total: PROT_COMMITTED_READS, refusal: 'answered 404' } })).line).toBe('a committed file could not be read');
  });

  it('once the probes are back the line names the STAGE that is running — the count of refused gestures is the record’s', () => {
    /*
      MEASURED, on the served page: `openProtSurfaceAsync` makes the three
      gestures and then dispatches the stages with nothing between them, so the
      moment the probes are back the first stage IS running. A line reading *3
      gestures, 3 refused* would be reporting a result while something else was
      happening — so that count is the probe step's own line in the RECORD
      instead, which is where a result belongs.
    */
    const probed = at({ parsed: { residues: 185, chains: 2 }, built: { views: 7, acts: 4, rows: 185 }, probed: { asked: 3, refused: 3 } });
    expect(bootNow(probed).line).toBe('placing 185 residues in their family’s alignment');
    expect(bootNow(probed).stage).toBe('conservation');
    // and the count IS in the record, with the reason a refusal is the answer
    // that step wanted
    expect(bootSteps(probed).find((step) => step.key === 'probe')!.line).toContain('3 gestures made, 3 refused by the library');
  });

  it('names each dispatched stage in its own declared words, and the ask in the model’s', () => {
    const ready = { parsed: { residues: 185, chains: 2 }, built: { views: 7, acts: 4, rows: 185 }, probed: { asked: 3, refused: 3 } };
    expect(bootNow(at({ ...ready, outcomes: [landed({ stage: 'conservation', act: CONSERVATION_ACT, materialized: [CONSERVATION_COLUMN] })] })).line).toBe('finding every contact across the interface');
    expect(bootNow(at({ ...ready, outcomes: [landed({ stage: 'conservation', act: CONSERVATION_ACT }), landed({ stage: 'interactions', act: CONTACTS_ACT })] })).line).toBe(
      'looking up what is already known about these sequences',
    );
    expect(
      bootNow(
        at({
          ...ready,
          outcomes: [landed({ stage: 'conservation', act: CONSERVATION_ACT }), landed({ stage: 'interactions', act: CONTACTS_ACT }), landed({ stage: 'annotation', act: ANNOTATION_ACT })],
        }),
      ).line,
    ).toBe('rolling a solvent probe over 185 residues');
    expect(bootNow(at({ ...ready, asking: { act: 'asking', model: 'claude-sonnet-5', facts: 71, residues: 18 } })).line).toBe('asking claude-sonnet-5 · 71 facts about 18 residues');
    // AND THE RE-ASK STAYS VISIBLE, which is the row a reader would otherwise never learn
    expect(bootNow(at({ ...ready, asking: { act: 're-asking', attempt: 1, remaining: 1, why: 'json-parse' } })).line).toBe('the answer did not parse — asking once more');
  });

  it('THE SPINNER IS ON THE STEP THAT IS ACTUALLY RUNNING, and on no other', () => {
    const ready = { parsed: { residues: 185, chains: 2 }, built: { views: 7, acts: 4, rows: 185 }, probed: { asked: 3, refused: 3 } };
    /*
      THE READS, THE ETL, THE BUILD AND THE PROBES ALL HAPPEN OVER STEP 1's OWN
      RESULT — the residues table is what step 1 lands (`src/prot/plan.ts` ·
      step 1) — so step 1 is the mark that spins through all four, and the LINE
      is what says which of them is happening.
    */
    for (const report of [at({}), at({ parsed: { residues: 185, chains: 2 } }), at({ parsed: { residues: 185, chains: 2 }, built: { views: 7, acts: 4, rows: 185 } })]) {
      expect(bootNow(report).stage).toBe('search');
    }
    // and the moment the probes are back, the run is walking its first stage
    expect(bootNow(at({ ...ready, outcomes: [] })).stage).toBe('conservation');
    expect(bootNow(at({ ...ready, outcomes: [landed({ stage: 'conservation', act: CONSERVATION_ACT })] })).stage).toBe('interactions');
    expect(bootNow(at({ ...ready, outcomes: [landed({ stage: 'conservation', act: CONSERVATION_ACT }), landed({ stage: 'interactions', act: CONTACTS_ACT })] })).stage).toBe('annotation');
    expect(bootNow(at({ ...ready, asking: { act: 'answering', tokens: 12 } })).stage).toBe(HOTSPOTS_STAGE);
    // AND NOTHING SPINS ONCE IT IS DONE
    expect(bootNow(at({ ...ready, hotspots: landed({ stage: HOTSPOTS_STAGE, act: HOTSPOTS_ACT, commit: 's5' }) })).stage).toBe(null);
  });

  it('and the STEPPER spins exactly that one mark — never a stage that has dispatched nothing', () => {
    /*
      THE DEFECT THIS CLOSES. `running` used to be derived as *the first
      declared stage that has not finished, while the run is in flight*, so on
      the boot screen the SECOND stage's mark spun from the first paint —
      through six http reads, an ETL and a dashboard build — while its stage had
      dispatched nothing at all. That is this desk's own forbidden promise one
      state along: a circle spinning over a step nothing is doing.
    */
    const early = stepperStages([], null, { live: 'search', awaiting: { [HOTSPOTS_STAGE]: 'not-run' } });
    expect(early.filter((stage) => stage.state === 'running').map((stage) => stage.stage)).toEqual(['search']);
    expect(early.find((stage) => stage.stage === 'conservation')!.state).toBe('not-run');
    // the host's word wins over its own `awaiting`, too
    const asking = stepperStages([], null, { live: HOTSPOTS_STAGE, awaiting: { [HOTSPOTS_STAGE]: 'not-run' } });
    expect(asking.filter((stage) => stage.state === 'running').map((stage) => stage.stage)).toEqual([HOTSPOTS_STAGE]);
    // and with NO host statement the old derivation stands, byte for byte
    const derived = stepperStages([], null);
    expect(derived.filter((stage) => stage.state === 'running').map((stage) => stage.stage)).toEqual(['conservation']);
  });

  it('the line’s own mark is a PROP, not something the component works out', async () => {
    const running = await mount(<BootLine line="reading the committed files · 2 of 6" running />);
    expect(running.words()).toContain('reading the committed files · 2 of 6');
    await running.unmount();
    const still = await mount(<BootLine line="the desk is ready" running={false} />);
    expect(still.words()).toBe('the desk is ready');
    await still.unmount();
  });
});

describe('the DETAIL moved to the record rather than vanishing', () => {
  it('every fact the list used to show is still in the boot’s own account', () => {
    const full = reported({
      reads: { done: READS.map((file) => read(file, 55_869)), asking: null, total: PROT_COMMITTED_READS, refusal: null },
      parsed: { residues: 185, chains: 2 },
      built: { views: 7, acts: 4, rows: 185 },
      probed: { asked: 3, refused: 3 },
      outcomes: [landed({ stage: 'surface', act: SURFACE_ACT, materialized: ['sasa', 'relative_sasa'] })],
      asking: { act: 'answering', tokens: 128 },
    });
    const said = bootSteps(full)
      .map((step) => `${step.name} ${step.line} ${step.refusal ?? ''}`)
      .join(' · ');
    // THE BYTES, and the measured gzip sentence that cost a packet to learn
    expect(said).toContain(`${(READS.length * 55_869).toLocaleString('en-US')} bytes read, no total`);
    expect(said).toContain('content-length is the size of what came over the wire');
    // THE PROBES' OWN COUNTS, and why a refusal is the answer that step wants
    expect(said).toContain('3 gestures made, 3 refused by the library');
    // THE COLUMNS a stage landed, by name
    expect(said).toContain('sasa, relative_sasa');
    // AND THE ASK'S OWN EXPLANATION, which the centred line cannot carry
    expect(said).toContain('a count of the act, and no part of what it says is shown until the whole answer is frozen');
  });
});
