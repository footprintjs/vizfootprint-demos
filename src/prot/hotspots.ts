/**
 * STAGE 5 — the hot spot recommendation, and the law it is built to keep:
 * **a model's ranking is evidence with a citation, or it is not shown.**
 *
 * ── WHAT THIS IS, AND WHAT IT IS NOT ───────────────────────────────────────
 * It is not a proxy with a prompt in it. It runs as a RECORDED agent on
 * agentfootprint, so the answer carries the same kind of provenance as every
 * number beside it on this desk:
 *
 *   - the FINDINGS LEDGER ({@link hotspotLedger}) holds the facts stages 1–4
 *     established, each with an id — and every one of them is READ OFF THE
 *     RUN'S OWN RECORDERS (`ActOutcome.materialized` says which columns
 *     landed; the rows at the cursor carry the values). Nothing here computes
 *     a number a second time: *a number computed twice is a number that can
 *     disagree with itself*;
 *   - the model is asked to QUOTE THOSE IDS rather than restate the facts
 *     (`.findings({ answerAsk: 'quote-facts' })`), so a claim that cites
 *     nothing is visibly a claim that cites nothing;
 *   - the STANDING JUDGE ({@link HotspotJudge}) scores what the model was
 *     served against the ledger, and the DISAGREEMENTS ARE RECORDED RATHER
 *     THAN SMOOTHED OVER ({@link disagreementsIn}).
 *
 * ── THE HALLUCINATION DOOR ─────────────────────────────────────────────────
 * **A residue the model names that is not in the run's residue table is
 * refused BY NAME, with the name it gave** ({@link REFUSE_NOT_IN_TABLE}). So
 * is a citation naming a fact id the ledger does not hold, and so is a
 * ranking that cites nothing at all. The answer is judged against the
 * evidence, never trusted because it is well formed — and a refusal is a
 * SENTENCE on the record, never a quietly shorter list.
 *
 * ── WHAT IS FROZEN, AND WHEN ───────────────────────────────────────────────
 * The accepted picks land as an ACT on the dashboard the moment they arrive
 * (`./analyses.ts` · `HOTSPOTS_ACT`, dispatched by `./session.ts` ·
 * `landHotspots`), so the ranking is on the record with everything it cited
 * BEFORE anything compares it to what is already known about those residues.
 * A prediction that can be revised after the outcome is not a prediction;
 * this is the discipline a field calls pre-registration, and a commit log
 * makes it nearly free. The judge's verdicts ride BESIDE the act and are not
 * in its columns: the prediction is what is frozen, the second reading is
 * what is recorded next to it.
 *
 * ── NO KEY IS EVER READ HERE ───────────────────────────────────────────────
 * The provider and the judge are INJECTED, exactly as `../nndss/analyst.ts`
 * takes its driver: `server/prot-doors.ts` is the one place on this side of
 * the wire that touches a secret, and it reads it from the environment. This
 * module names no environment variable and would not know one if it saw it.
 */
import { Agent, defineTool, isPaused, type FindingsLedger } from 'agentfootprint';
import { flowChart } from 'footprintjs';
import { mock, type LLMProvider, type LLMRequest, type LLMResponse } from 'agentfootprint/providers';
import { mockClassifier, type Classifier, type ClassifyRequest, type ClassifyResult } from 'agentfootprint/classify';
import type { AnalysisDef, AnalysisResult, ColumnsOutput } from 'vizfootprint/analysis';
import type { AnalysisSlot } from 'vizfootprint/def';
import type { Row } from 'vizfootprint/data';
import {
  ACT_KEY_COLUMN,
  ACT_TABLE,
  CONSERVATION_ACT,
  CONSERVATION_BASIS_COLUMN,
  CONSERVATION_COLUMN,
  CONTACTS_ACT,
  CONTACTS_COLUMN,
  HOTSPOTS_ACT_KEY,
  INTERFACE_CONTACTS_COLUMN,
  INTERFACE_SEPARATION_COLUMN,
  RELATIVE_SASA_COLUMN,
  SASA_COLUMN,
  SURFACE_ACT,
  libraryChart,
} from './analyses.js';
import type { ActOutcome, ProtRun } from './orchestrator.js';
import { watchTheAsk, type ReportAsk } from './streamReports.js';

// ── the names, once ──────────────────────────────────────────────────────────

/** The stage id — the same word `./plan.ts` publishes as step 5. */
export const HOTSPOTS_STAGE = 'hotspots';
/**
 * The act that lands the answer, as the def declares it and the session
 * dispatches it — and it is JUDGED against the registry's own key at the
 * bottom of this file, the `ACT_TABLE` precedent: a demo that will not start
 * beats one whose act is filed under a name nothing dispatches.
 */
export const HOTSPOTS_ACT = 'residueHotspots';
/** Where the model reads its evidence from — the one tool this agent is given. */
export const EVIDENCE_TOOL = 'read_evidence';

/**
 * THE COLUMNS THE ACT LANDS ON `residues` — the same table, the same key and
 * the same channel as every other stage's, which is what connects the picks to
 * the crossfilter instead of to a list of their own.
 *
 * `hotspot_rank` is the number a chart can bind. `hotspot_cites` is the
 * `conservation_basis` precedent applied to a ranking: the citation lives IN
 * THE DATA, beside the value, where a caption cannot be missed — a rank whose
 * fact ids were only ever on a card would be a number a reader could quote
 * with nothing behind it. `hotspot_reason` is the model's own sentence for that
 * residue, verbatim.
 */
export const HOTSPOT_RANK_COLUMN = 'hotspot_rank';
export const HOTSPOT_CITES_COLUMN = 'hotspot_cites';
export const HOTSPOT_REASON_COLUMN = 'hotspot_reason';

/** The word that must ride every number this stage produces — it is a recommendation, never a measurement. */
export const HOTSPOT_TAG = 'a recommendation, not a measurement';

// ── the findings ledger ──────────────────────────────────────────────────────

/**
 * ONE FACT THE PIPELINE ESTABLISHED, with the id the model is asked to quote.
 *
 * `from` is the ACT that landed the column the fact is read off — the join back
 * to the commit log, so a reader can walk from a cited id to the commit that
 * made it true. `residue` is the row the fact is about, which is also what the
 * hallucination door judges a named residue against.
 */
export interface LedgerFact {
  /** `f1`, `f2`, … — stable in the order the facts are folded, which is the acts' own order. */
  readonly id: string;
  /** The residue key the fact is about. */
  readonly residue: string;
  /** The fact, in words, built from the values the act landed and from nothing else. */
  readonly text: string;
  /** Which act landed the column this was read off, or `the parse` for the file's own columns. */
  readonly from: string;
}

/** The parse's own attribution — step 1 lands the table before the record starts, so it names no act. */
export const FROM_THE_PARSE = 'the parse';

/** The LAST commit the run landed — the end of what stages 1 to 4 put on the record. `null` when it landed none. */
export function landedThrough(run: ProtRun | null): string | null {
  const commits = (run?.outcomes ?? []).flatMap((outcome) => (outcome.commit === null ? [] : [outcome.commit]));
  return commits.length === 0 ? null : commits[commits.length - 1]!;
}

/**
 * WHICH CURSOR STAGE 5 IS ABOUT — and the answer is **the end of the run, by
 * construction.** This function is the guard that makes it so.
 *
 * ── THE ARGUMENT, because it cuts against this desk's own law ──────────────
 * Every picture here is drawn AT THE CURSOR, and that is the law the whole
 * packet before this one was careful about: a card that answered from
 * somewhere else would be a second idea of one fact. Stage 5 is the one thing
 * on the desk that cannot obey it, and the reason is what the stage IS: *a
 * reading of what stages 1 to 4 landed.* A subset of those stages is not that.
 * Ranking hot spots from the rows at stage 2 would be ranking them from
 * evidence with no contacts and no surface in it — an answer to a question
 * nobody asked, dressed as an answer to this one.
 *
 * So the ask is made ONCE, from the rows read at the last commit the stages
 * landed, and this function REFUSES any other read rather than folding a
 * ledger from it. The card then says which cursor its answer is about
 * (`web/src/workbench/panel.ts` · `recommendationOf` · `where`), which is how
 * the two laws are both kept: the answer is not pretending to be drawn where
 * the reader is standing, it is declaring where it was asked from.
 *
 * `null` when the rows really are the end of the run — an absence is absent.
 */
export function notTheEndOfTheRun(run: ProtRun | null, at: string | null): string | null {
  const head = landedThrough(run);
  if (head === null) {
    return 'stage 5 reads what stages 1 to 4 landed, and this run landed no commit at all — so there is no end of the run to read from and nothing was asked of a model.';
  }
  if (at === head) return null;
  return (
    `stage 5 reads what stages 1 to 4 landed, and the rows it was handed were read at ${at === null ? 'the root of this log' : `commit ${at}`} while those stages landed through commit ${head} — so it was not asked. ` +
    'This stage is about the END of the run by construction: a ranking folded from part of the evidence would answer a question nobody asked, wearing the answer to this one.'
  );
}

/** What the ledger holds and what it deliberately leaves out — the sentence the card and the door both carry. */
export interface HotspotLedger {
  readonly facts: readonly LedgerFact[];
  /** Every residue key the run's table holds — the list the hallucination door judges against. */
  readonly residues: readonly string[];
  /** Which residues the ledger covers, and WHY those — never a threshold anybody picked. */
  readonly basis: string;
  /** Which acts' columns the facts were read off, in landing order. */
  readonly from: readonly string[];
  /** How many residues the cover selected — the number the verdict below is read from. */
  readonly covered: number;
  /** Whether that selection is a cover at all. Two of its three values are refusals ({@link coverVerdict}). */
  readonly cover: CoverVerdict;
  /**
   * THE COMMIT THE ROWS WERE READ AT, carried so the answer can say which
   * cursor it is about — and so a reader who has since stepped behind it is
   * told rather than shown a ranking these rows do not hold.
   *
   * `null` on a read taken at the root of a log. It is the read's OWN stamp
   * (`./session.ts` · `ResiduesAtCursor.cursor`) and never what a caller
   * believes the cursor to be.
   */
  readonly at: string | null;
}

const num = (value: unknown): number | null => (typeof value === 'number' && Number.isFinite(value) ? value : null);
const text = (value: unknown): string | null => (typeof value === 'string' && value.trim() !== '' ? value.trim() : null);
const round = (value: number, places: number): string => value.toFixed(places);

/**
 * WHICH RESIDUES THE LEDGER COVERS, and this is the one choice in the file
 * worth defending: **the ones an act's own absence vocabulary singles out.**
 *
 * ── THE COLUMN, AND THE ONE THAT LOOKS LIKE IT AND IS NOT ──────────────────
 * `interface_separation` is landed **ABSENT — never 0 — for a residue with no
 * contact across the chains**, and the act says so by name (`./analyses.ts` ·
 * `INTERFACE_SEPARATION_COLUMN`: *"does not touch another chain" is not a
 * distance*). So a residue carrying one is a residue at the interface, which is
 * what this desk is about, and a residue without one is not. That is the ACT's
 * own statement, not a threshold: nothing here compares a number to a cut-off
 * anybody chose, and on the committed entry it leaves 18 of 185 rows rather
 * than a round number somebody liked.
 *
 * **IT WAS `interface_contacts` FOR ONE RELEASE AND THAT WAS THE BUG**, and it
 * is written here because the mistake is a good one to be able to recognise
 * again. That column is landed `?? 0` (`./interactions.ts` ·
 * `residueContactColumns`) — a real ZERO for a residue that touches no other
 * chain, 167 of the 185 on the committed entry — so it **has no absence at
 * all**, and a rule reading it as *"present means at the interface"* selected
 * every row. Measured on the real entry: **185 of 185 residues, 717 facts**,
 * a model asked to rank hot spots out of evidence carrying no interface, and a
 * prose answer back. The prose was the symptom; the column was the fault.
 *
 * The two rules AGREE — `interface_separation` non-null is exactly
 * `interface_contacts > 0`, 18 either way — and `tests/prot-hotspots.test.ts`
 * pins that against the committed entry, so a drift between the two columns
 * fails a test rather than quietly moving the cover. The ABSENCE is what is
 * read, because the absence is what the act declares; `> 0` would be this file
 * deciding that a zero means something.
 */
const atTheInterface = (row: Row): boolean => num(row[INTERFACE_SEPARATION_COLUMN]) !== null;

/**
 * WHAT THE COVER RULE DECIDED — and two of the three answers are refusals.
 *
 *   `covers`       a proper minority of the table: a cover, and the ask is made;
 *   `nothing`      no row carried the column, so there is nothing to rank;
 *   `not-a-cover`  half the table or more, which is the shape a rule that did
 *                  not discriminate produces. See {@link coverVerdict}.
 */
export type CoverVerdict = 'covers' | 'nothing' | 'not-a-cover';

/**
 * IS THIS A COVER AT ALL? The guard the 717-fact ask did not have.
 *
 * The boundary is **a proper minority of the table**, which is not a number
 * anybody picked — it is the definition of a minority, and it is the one thing
 * that can be said about an interface without measuring this entry: *an
 * interface is a small part of a complex.* So a selection of half the rows or
 * more does not say every residue is at the interface; it says the column the
 * cover is read off did not tell the two apart, which is a fault in this code
 * or in what landed, never a finding about the protein.
 *
 * It is a REFUSAL and never a trim. Cutting the pile down to a size a model
 * could hold would be this file choosing which residues the model may
 * consider — the very threshold the cover rule exists not to pick — and **an
 * ask nobody can answer is worse than one that was never made**, because it
 * spends a real model call to arrive at a sentence.
 *
 * On the committed entry: 18 of 185, about a tenth, with room to spare.
 */
export function coverVerdict(covered: number, rows: number): CoverVerdict {
  if (covered === 0) return 'nothing';
  return covered * 2 >= rows ? 'not-a-cover' : 'covers';
}

/**
 * THE LEDGER, FOLDED OFF THE RUN — one fact per residue per act whose column
 * landed on it.
 *
 * `run.outcomes` is what says which columns exist (`ActOutcome.materialized`),
 * so an act that was refused contributes no fact and no silence: its evidence
 * is ABSENT from the ledger, the model cannot cite what it was never served,
 * and {@link HotspotLedger.from} names exactly which acts are behind the pile.
 */
export function hotspotLedger(run: ProtRun | null, rows: readonly Row[], at: string | null = null): HotspotLedger {
  const outcomes: readonly ActOutcome[] = run?.outcomes ?? [];
  const landed = new Set(outcomes.flatMap((o) => (o.commit === null ? [] : o.materialized)));
  const residues = rows.map((row) => String(row[ACT_KEY_COLUMN]));
  const covered = rows.filter(atTheInterface);
  const facts: LedgerFact[] = [];
  const from: string[] = [];
  /** One fact, numbered in fold order — the ids the model is asked to quote. */
  const file = (residue: string, sentence: string | null, act: string): void => {
    if (sentence === null) return;
    facts.push({ id: `f${String(facts.length + 1)}`, residue, text: sentence, from: act });
    if (!from.includes(act)) from.push(act);
  };
  for (const row of covered) {
    const key = String(row[ACT_KEY_COLUMN]);
    // THE PARSE'S OWN COLUMNS, which land at the root of the log — what the
    // residue IS. They are in the ledger because a reason that cannot name the
    // amino acid is a reason about a row number.
    file(key, `${key} is ${String(row['resname'] ?? 'an unnamed residue')} in chain ${String(row['chain'] ?? '?')} at number ${String(row['resnum'] ?? '?')}`, FROM_THE_PARSE);
    file(key, contactsFact(key, row), CONTACTS_ACT);
    file(key, surfaceFact(key, row), SURFACE_ACT);
    file(key, conservationFact(key, row), CONSERVATION_ACT);
  }
  const cover = coverVerdict(covered.length, residues.length);
  return {
    facts: cover === 'covers' ? facts : [],
    residues,
    basis: basisSaid(cover, covered.length, residues.length),
    from: cover === 'covers' ? from : [],
    covered: covered.length,
    cover,
    at,
  };
}

/**
 * WHICH RESIDUES THIS LEDGER COVERS AND WHY, in one sentence — and the two
 * refusing verdicts say what went wrong rather than reporting a count.
 *
 * The sentence is served to the model in the evidence tool's own description
 * and printed on the card, so there is one wording for one fact.
 *
 * EXPORTED because the DOOR judges the cover again off the pile that arrives
 * (`server/prot-doors.ts` · `ledgerOf`), and when its verdict is a refusal the
 * page's own sentence is about a cover that is not one. **A sentence about the
 * cover belongs to whoever judged the cover** — so the door writes this one
 * rather than quoting a claim it has just contradicted.
 */
export function basisSaid(cover: CoverVerdict, covered: number, rows: number): string {
  if (cover === 'nothing') {
    return `no residue at this cursor carries an "${INTERFACE_SEPARATION_COLUMN}" value, so the ledger covers none: that column is landed absent — never zero — for a residue with no contact across the chains, and with none landed there is no interface for this stage to be about`;
  }
  if (cover === 'not-a-cover') {
    return `the cover rule selected ${String(covered)} of this run's ${String(rows)} residues, and that is not a cover: an interface is a small part of a complex, so a selection of half the table or more says the column it is read off did not tell the two apart rather than that every residue is at the interface`;
  }
  return `the ledger covers the ${String(covered)} residues of ${String(rows)} that carry an "${INTERFACE_SEPARATION_COLUMN}" value at this cursor. That is the interaction act's own absence vocabulary and not a threshold anybody picked: the column is landed absent — never zero — for a residue with no contact across the chains, so a value in it means the residue touches the other one, which is what this desk is about`;
}

/** What the interaction stage landed on this row, in words. `null` when it landed nothing here. */
function contactsFact(key: string, row: Row): string | null {
  const all = num(row[CONTACTS_COLUMN]);
  const crossing = num(row[INTERFACE_CONTACTS_COLUMN]);
  if (crossing === null) return null;
  const separation = num(row[INTERFACE_SEPARATION_COLUMN]);
  return (
    `${key} is in ${all === null ? 'an uncounted number of' : String(all)} non-covalent contacts, ${String(crossing)} of them crossing to the other chain` +
    (separation === null ? '' : `, the tightest of those at ${round(separation, 2)} ångström`)
  );
}

/** What the surface stage landed on this row. The relative value is absent where the residue type has no published maximum to divide by. */
function surfaceFact(key: string, row: Row): string | null {
  const sasa = num(row[SASA_COLUMN]);
  if (sasa === null) return null;
  const relative = num(row[RELATIVE_SASA_COLUMN]);
  return `${key} exposes ${round(sasa, 1)} square ångström of surface the solvent can reach` + (relative === null ? ', and its residue type has no published maximum to express that as a fraction of' : `, which is ${round(relative * 100, 0)}% of the published maximum for its residue type`);
}

/**
 * What the conservation stage landed on this row — WITH ITS BASIS, and the
 * basis is not decoration: the two chains are scored against two different
 * curated alignments, so a score with no accession beside it is two claims
 * wearing one number (`./analyses.ts` · `CONSERVATION_BASIS_COLUMN`).
 */
function conservationFact(key: string, row: Row): string | null {
  const score = num(row[CONSERVATION_COLUMN]);
  if (score === null) return null;
  const basis = text(row[CONSERVATION_BASIS_COLUMN]);
  return `${key} scores ${round(score, 2)} for conservation in its family's curated alignment` + (basis === null ? ', and the alignment it was scored against is not on this row' : ` (${basis})`);
}

// ── what the model is asked, and how it must answer ──────────────────────────

/** How many residues the stage asks for. A ceiling, never a quota: fewer is an answer, more is refused past this. */
export const HOTSPOT_WANT = 6;

export const HOTSPOT_SYSTEM = `You are ranking candidate HOT SPOT residues at the interface of a protein complex, for a structural biologist who is looking at this very desk.

A hot spot is a residue whose side chain contributes disproportionately to the binding of the two chains: buried at the interface, in many contacts across it, and conserved in its family because the interaction matters.

YOU MAY NOT MEASURE ANYTHING. Every fact you are allowed to use has already been established by this run's own stages and is served to you by the ${EVIDENCE_TOOL} tool, one fact per id. Call that tool FIRST. Do not compute, estimate, recall or infer a number: if a quantity is not in a fact you were served, you do not have it.

YOU MAY ONLY NAME A RESIDUE THAT APPEARS IN THE FACTS. A residue you name that this run's residue table has no row for is refused by name, and the ranking it carried is thrown away — so name residues exactly as the facts spell them ("A:57", chain then colon then number).

EVERY RANKING CITES. Each residue you rank carries the ids of the facts its reason rests on. A ranking that cites nothing is refused; a ranking that cites an id the ledger does not hold is refused, by that id. Quote the ids — do not restate the facts as if you had measured them.

THIS IS A RECOMMENDATION AND IT WILL BE SHOWN AS ONE. Say what the evidence supports and no more. Where the evidence for a residue is thin, say that in its reason rather than ranking it confidently.

HOW TO REPLY. Your WHOLE reply is one JSON object and nothing else — no words before it, no fence around it:
{"ranked": [{"residue": "<a residue key, exactly as the facts spell it>", "reason": "<one or two plain sentences, resting only on the facts you cite>", "cites": ["<fact id>", "..."]}]}
Order the array best-supported first; that order IS the rank. At most ${String(HOTSPOT_WANT)} entries. Any other key is ignored.`;

/**
 * THE SHAPE OF THE ANSWER, DECLARED — a hand-written parser, because a schema
 * library is a dependency this repository does not need for four fields.
 *
 * It THROWS on a shape failure, which is the contract `outputSchema` asks for,
 * and its `description` is what the library injects into the prompt. What it
 * deliberately does NOT judge is anything about the CONTENT: whether a residue
 * exists, whether an id is one the ledger holds and whether a reason is worth
 * reading are the hallucination door's questions, and a schema that answered
 * them would put the refusals somewhere no sentence can reach.
 */
export const HOTSPOT_ANSWER_SCHEMA = {
  description: `An object with one key, "ranked": an array of at most ${String(HOTSPOT_WANT)} objects, each { "residue": string, "reason": string, "cites": string[] }, best-supported first.`,
  parse: (value: unknown): { readonly ranked: readonly { readonly residue: string; readonly reason: string; readonly cites: readonly string[] }[] } => {
    if (!isRecord(value)) throw new Error('the answer is not a JSON object');
    const ranked = value['ranked'];
    if (!Array.isArray(ranked)) throw new Error('the answer carries no "ranked" array');
    return {
      ranked: ranked.map((entry, at) => {
        if (!isRecord(entry)) throw new Error(`the ranking at position ${String(at + 1)} is not an object`);
        const residue = entry['residue'];
        const reason = entry['reason'];
        const cites = entry['cites'];
        if (typeof residue !== 'string' || residue.trim() === '') throw new Error(`the ranking at position ${String(at + 1)} names no residue`);
        if (typeof reason !== 'string') throw new Error(`the ranking of "${residue}" carries no reason`);
        if (!Array.isArray(cites) || cites.some((id) => typeof id !== 'string')) throw new Error(`the ranking of "${residue}" carries no "cites" array of ids`);
        return { residue, reason, cites: cites as readonly string[] };
      }),
    };
  },
};

/** The question the run is given — also what the judge scores a served result against when the model declared no proposition. */
export const HOTSPOT_QUESTION = `Which residues of this interface would you call hot spots, and what is the reason for each? Rank at most ${String(HOTSPOT_WANT)}, cite the fact ids behind every one, and name nothing the facts do not.`;

// ── the answer, and the refusals ─────────────────────────────────────────────

/** One ranking that survived every door — the row the act lands and the card shows. */
export interface HotspotPick {
  /** The residue key, as the run's own table spells it. */
  readonly residue: string;
  /** Its place in the answer, from 1 — the model's own order, never re-sorted here. */
  readonly rank: number;
  /** The model's reason, verbatim. */
  readonly reason: string;
  /** The fact ids it cited, every one of which the ledger holds. */
  readonly cites: readonly string[];
}

/** The judge's reading of one thing the model was served — the second source, recorded beside the model's own. */
export interface HotspotVerdict {
  /** The tool result judged. */
  readonly of: string;
  /** The judge's standing, and the model's own where it declared one. */
  readonly judge: string;
  readonly model: string | null;
  readonly confidence: number;
  /** The judge's own name and resolved model string — never inferred. */
  readonly by: string;
  /** Set when the judge was asked and answered nothing: the reason, in the provider's words. */
  readonly failed?: string;
}

/**
 * Why a run of this stage produced no ranking. Each one is a different
 * sentence, and none of them is a silent empty list.
 *
 * `stream-died` is the one a STREAMED door can produce and a blocking one
 * cannot: the reports arrived, the answer frame never did, and the connection
 * ended. It is its own word rather than `unreachable` because it names a
 * different hop — the model was reached, and it is the page's own read of the
 * door that broke — and rather than `threw`, because nothing threw: a body
 * simply ended. *A stream that dies must be a stated outcome rather than a
 * spinner that never stops* is the whole reason it exists
 * ({@link STREAM_DIED}).
 */
export type HotspotFailure = 'no-key' | 'not-the-end' | 'no-evidence' | 'no-cover' | 'unreachable' | 'timeout' | 'refused' | 'threw' | 'malformed' | 'cites-nothing' | 'nothing-left' | 'stream-died';

/**
 * A DOOR'S ANSWER STREAM THAT ENDED BEFORE ITS ANSWER — the sentence, with the
 * count of what did arrive.
 *
 * It borrows the TIMEOUT's own clause deliberately: *the answer, if one arrives
 * now, is dropped rather than landed late*. That is the precedent this packet
 * was pointed at, and it is the same fact — the page has stopped listening, and
 * a ranking that turned up afterwards would be landing at a cursor nobody asked
 * it about.
 */
/**
 * WHICH FAILURES A RE-ASK COULD HONESTLY ANSWER DIFFERENTLY — the one table the
 * retry control is offered from, so no screen works out its own eligibility.
 *
 * ── THE RULE ───────────────────────────────────────────────────────────────
 * A retry is offered where the SAME QUESTION could get a different answer, and
 * is ABSENT otherwise rather than present-and-dead. Each `false` below is its
 * own reason and none of them is *we did not get round to it*:
 *
 *   `no-key`       nothing has changed. A button implying a second press might
 *                  find a key is a lie about the environment.
 *   `no-evidence`
 *   `no-cover`     the evidence is what it is. A retry asks the same
 *                  unanswerable question and spends a real model call to
 *                  arrive at the same sentence — which is the rule
 *                  {@link coverRefusal} already wrote down: *an ask nobody can
 *                  answer is worse than one that was never made*.
 *   `not-the-end`  the read was not the end of the run, and pressing again
 *                  does not move the cursor. What would fix it is a different
 *                  read, not a second ask.
 *   `refused`      the model itself declined, and this stage cannot tell an
 *                  invalid key from a rate limit (`failureOf` matches both) —
 *                  so the button would be a promise about the environment in
 *                  exactly the way `no-key`'s would.
 *
 * Everything else is a network, a clock, a throw, an unreadable answer, an
 * answer that cited nothing, an answer every part of which was refused, or a
 * door whose stream died — and every one of those can go differently.
 */
export const RETRYABLE: Readonly<Record<HotspotFailure, boolean>> = {
  'no-key': false,
  'not-the-end': false,
  'no-evidence': false,
  'no-cover': false,
  refused: false,
  unreachable: true,
  timeout: true,
  threw: true,
  malformed: true,
  'cites-nothing': true,
  'nothing-left': true,
  'stream-died': true,
};

/** Could asking the same question again honestly answer differently? See {@link RETRYABLE}. */
export const retryable = (kind: HotspotFailure): boolean => RETRYABLE[kind];

export const STREAM_DIED = (reports: number): string =>
  `the door's answer stream ended after ${String(reports)} ${reports === 1 ? 'report' : 'reports'} and before the answer itself — so stage 5 landed nothing. ` +
  `The reports said what the stage was doing and none of them was a ranking, which is why there is nothing here to show: the answer, if one arrives now, is dropped rather than landed late.`;

export interface HotspotAnswered {
  readonly ok: true;
  /** The model the answer was asked of, as the caller named it. */
  readonly model: string;
  readonly picks: readonly HotspotPick[];
  /** Every refusal, verbatim and by name — the hallucination door's own record. */
  readonly refused: readonly string[];
  readonly verdicts: readonly HotspotVerdict[];
  /** Where the judge and the model disagreed, said out loud rather than smoothed over. */
  readonly disagreements: readonly string[];
  /** How many facts the ledger served this run. */
  readonly served: number;
}

export interface HotspotFailed {
  readonly ok: false;
  readonly kind: HotspotFailure;
  /** The one sentence a reader learns this from. */
  readonly sentence: string;
  /** Whatever the judge managed to say before the run failed — a failed stage still keeps its record. */
  readonly verdicts: readonly HotspotVerdict[];
}

export type HotspotOutcome = HotspotAnswered | HotspotFailed;

/** THE HALLUCINATION DOOR'S OWN SENTENCE — the name it gave, quoted back. */
export const REFUSE_NOT_IN_TABLE = (name: string): string =>
  `the model named "${name}" and this run's residue table has no row for it — a prediction about a residue that is not in the evidence is refused by name, and nothing of that ranking was landed`;

/** A ranking with no citation at all. */
export const REFUSE_CITES_NOTHING = (residue: string): string =>
  `the model ranked "${residue}" and cited nothing — a ranking with no fact id behind it is a claim about evidence the evidence was never asked about, so it was refused`;

/** A citation naming a fact id the ledger does not hold — the hallucination door, applied to the citation. */
export const REFUSE_UNKNOWN_FACT = (residue: string, id: string): string =>
  `the model ranked "${residue}" citing "${id}", and this run's findings ledger holds no fact under that id — the citation is refused by name and the ranking with it`;

/** One residue, twice. */
export const REFUSE_TWICE = (residue: string): string => `the model named "${residue}" a second time; the later ranking was refused — one residue is one prediction`;

/** A ranking past the ceiling the stage asked for. */
export const REFUSE_PAST_CEILING = (residue: string, want: number): string =>
  `the model ranked "${residue}" beyond the ${String(want)} the stage asked for — the ranking was refused for its place in the list and for nothing about the residue`;

/** A ranking with no reason. */
export const REFUSE_NO_REASON = (residue: string): string => `the model ranked "${residue}" and gave no reason for it — a ranking whose reason is missing is refused, because the reason is half of what this stage answers`;

/**
 * THE REFUSALS THAT COME BEFORE THE MODEL — one owner, two callers, because
 * the cheapest refusal is the one made before a call is spent.
 *
 * `askHotspots` asks it, since that is where a call would be spent; the SERVED
 * PAGE asks it too, so a pile it already knows is doomed is never put on the
 * wire at all (`web/src/protServed.tsx`). One function rather than two
 * spellings of one sentence in two places.
 *
 * `not-a-cover` is the one this stage was missing, and the measurement is why
 * the guard exists: a cover rule reading a column with no absence selected
 * every row, and the ask that followed was **717 facts over 185 residues** on
 * the committed entry — unanswerable, answered in prose, and it cost a real
 * model call to find that out. It is refused with the counts and **never
 * trimmed**: cutting the pile down to a size a model could hold would be this
 * file choosing which residues the model may consider, which is the very
 * threshold the cover rule exists not to pick.
 *
 * `null` when the ledger really is a cover — an absence is absent.
 */
export function coverRefusal(ledger: HotspotLedger): HotspotFailed | null {
  if (ledger.cover === 'not-a-cover') {
    return {
      ok: false,
      kind: 'no-cover',
      sentence: `stage 5 did not ask a model, because what it would have asked about is not a cover: ${ledger.basis}. Nothing was asked and nothing was landed — an ask nobody can answer is worse than one that was never made, and this one would have spent a model call to arrive at the same sentence.`,
      verdicts: [],
    };
  }
  if (ledger.cover === 'nothing' || ledger.facts.length === 0) {
    return {
      ok: false,
      kind: 'no-evidence',
      sentence: `stage 5 ran and had nothing to ask about: ${ledger.basis}. Nothing was landed, and nothing was asked of a model — a ranking over no evidence would be a ranking of nothing.`,
      verdicts: [],
    };
  }
  return null;
}

/** The sentence for a process that has a server behind it and nothing to ask. */
export const NO_KEY_SENTENCE =
  'stage 5 did not run because this process has no key to call a model with: it was started without ANTHROPIC_API_KEY in its environment. That is NOT this build\'s static-page limit — a server is standing here, the evidence stages 1 to 4 landed is on the record, and there is simply nothing to ask.';

// ── the judge ────────────────────────────────────────────────────────────────

/**
 * THE STANDING JUDGE, AND WHICH ONE RAN — the `./placement.ts` ·
 * `PlacementStrategy` precedent, because the same thing is true here: the
 * answer's second reading depends on WHICH judge was available, and a reader
 * must not mistake a calibrated verdict for one the same family of model gave
 * about its own evidence.
 */
export interface HotspotJudge {
  readonly classifier: Classifier;
  /** What the page says wherever it shows a verdict. */
  readonly said: string;
  /** `true` when this is the weaker of the two — a consumer branches on the boolean, never on the words. */
  readonly weaker: boolean;
}

/**
 * The scripted judge — for tests, for the bench and for a process with no key.
 * A scripted distribution is still the SCRIPT'S data and never the library's
 * guess, which is the whole reason `mockClassifier` exists.
 */
export function scriptedJudge(standing = 'fact', confidence = 0.86): HotspotJudge {
  const answer = (): ClassifyResult => ({
    model: 'scripted-standing-judge',
    answers: {
      standing: { type: 'choice', choice: standing, confidence, probabilities: { fact: standing === 'fact' ? confidence : 1 - confidence, open: standing === 'open' ? confidence : 0, noise: standing === 'noise' ? confidence : 0, 'ruled-out': standing === 'ruled-out' ? confidence : 0 } },
      tests_subject: { type: 'noul', noul: confidence },
    },
    latencyMs: 0,
  });
  return { classifier: mockClassifier(() => answer()), said: 'scored by the scripted standing judge — no model was asked', weaker: true };
}

/**
 * A judge over an ORDINARY LLM PROVIDER, and it is the WEAKER of the two —
 * said out loud, because the page shows its verdicts.
 *
 * `agentfootprint/classify` ships one calibrated adapter (`typesafe()`, model
 * `jev`), which needs a key of its own. This demo is authorised exactly one
 * key, so the second source available to it is a second call to the same
 * family of model that produced the answer — which is a real second reading
 * (it is shown the result and the proposition, not the answer, and it scores a
 * declared vocabulary) and is NOT independent of the first. That is a cost, so
 * it is on the record: `weaker` is the boolean a consumer branches on and
 * {@link HotspotJudge.said} is the sentence a reader sees.
 *
 * It is a `Classifier` and not a prompt: the four standings are the ledger's
 * own vocabulary, the answer must be one of them, and an answer outside it is
 * a `ClassifierError` the library files as a `judgment-error` row rather than
 * a verdict nobody produced.
 */
export function providerJudge(provider: LLMProvider, model = 'anthropic'): HotspotJudge {
  const classifier: Classifier = {
    name: 'provider-standing',
    classify: async (request: ClassifyRequest, signal?: AbortSignal): Promise<ClassifyResult> => {
      const started = Date.now();
      const options = Object.entries(request.questions).flatMap(([id, question]) => (question.type === 'choice' ? [{ id, criteria: question.criteria, instructions: question.instructions }] : []));
      const first = options[0];
      if (first === undefined) throw new ClassifierRefusal('the standing judge was asked no choice question, so there is nothing for it to score');
      const reply = await provider.complete({
        model,
        maxTokens: 512,
        ...(signal === undefined ? {} : { signal }),
        systemPrompt:
          'You are a calibrated classifier, not an assistant. You are shown a state and one closed vocabulary of options. Score the options against the state and answer with ONE JSON object and nothing else: ' +
          '{"choice":"<one option id>","confidence":<0..1>,"probabilities":{"<option id>":<0..1>, ...},"tests_subject":<0..1>}. Never add a key, never write a word outside the object, and never score an option that is not offered.',
        messages: [{ role: 'user', content: `THE OPTIONS\n${JSON.stringify(first.criteria, null, 1)}\n\nWHAT TO JUDGE\n${first.instructions}\n\nTHE STATE\n${JSON.stringify(request.state, null, 1)}` }],
      });
      const parsed = readJsonObject(reply.content);
      if (parsed === null) throw new ClassifierRefusal('the standing judge answered something that is not one JSON object, so no verdict was recorded');
      const choice = typeof parsed['choice'] === 'string' ? parsed['choice'] : '';
      const confidence = typeof parsed['confidence'] === 'number' ? parsed['confidence'] : 0;
      const probabilities = isRecord(parsed['probabilities']) ? numbersOf(parsed['probabilities']) : {};
      const tests = typeof parsed['tests_subject'] === 'number' ? parsed['tests_subject'] : undefined;
      return {
        // THE MODEL WE ASKED, and it is the asked-for string rather than a
        // resolved one because `LLMResponse` carries no model field: a record
        // that named a resolved model nobody sent would be this file vouching
        // for the provider.
        model,
        answers: {
          [first.id]: { type: 'choice', choice, confidence, probabilities },
          ...(tests === undefined ? {} : { tests_subject: { type: 'noul' as const, noul: tests } }),
        },
        usage: { inputTokens: reply.usage.input, outputTokens: reply.usage.output },
        latencyMs: Date.now() - started,
      };
    },
  };
  return {
    classifier,
    said: 'scored by a standing judge running on the SAME family of model that answered — the weaker of the two: a calibrated classifier is a second source, and this is a second reading by the same kind of reader',
    weaker: true,
  };
}

/** What a judge throws when it produced no verdict. The library files it as a `judgment-error` row and the run goes on. */
class ClassifierRefusal extends Error {}

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null && !Array.isArray(value);
const numbersOf = (from: Record<string, unknown>): Record<string, number> => Object.fromEntries(Object.entries(from).flatMap(([k, v]) => (typeof v === 'number' ? [[k, v]] : [])));

/**
 * ONE JSON OBJECT out of a model's reply — the `../nndss/reply.ts` discipline,
 * applied to two answers that must both be one object: the ranking and the
 * judge's verdict. A fence is tolerated because models add one; nothing else is
 * repaired, because a repaired answer is not the answer.
 */
export function readJsonObject(reply: string): Record<string, unknown> | null {
  const trimmed = reply.trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim();
  const opened = trimmed.indexOf('{');
  const closed = trimmed.lastIndexOf('}');
  if (opened < 0 || closed <= opened) return null;
  try {
    const parsed: unknown = JSON.parse(trimmed.slice(opened, closed + 1));
    return isRecord(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

// ── the run ──────────────────────────────────────────────────────────────────

/** Everything one ask needs. The provider and the judge are handed in; no key is read here. */
export interface HotspotAsk {
  readonly provider: LLMProvider;
  readonly judge: HotspotJudge;
  /** The model a live ask names — the caller's own word for it, so the record and the screen cannot disagree. */
  readonly model?: string;
  readonly ledger: HotspotLedger;
  /** The ceiling on how many rankings are kept. Default {@link HOTSPOT_WANT}. */
  readonly want?: number;
  /** How long the whole ask may take before the stage reports a timeout. Default 60 s. */
  readonly timeoutMs?: number;
  readonly maxIterations?: number;
  /**
   * SOMEBODY WATCHING THE ASK — the act, reported as it happens, and never the
   * answer (`./streamReports.ts` carries the whole argument and the
   * measurement behind it).
   *
   * Absent ⇒ no listener is subscribed and this run is byte-identical to every
   * earlier one: the library's own dispatcher drops what nobody asked for.
   */
  readonly report?: ReportAsk;
}

/**
 * THE ASK — one recorded agent run, then every door, in the order that makes
 * the refusals meaningful.
 *
 * 1. no evidence at all ⇒ nothing to rank, and say so;
 * 2. the run: one agent, one tool, the ledger armed with the answer-turn ask
 *    and the standing judge;
 * 3. the reply read as ONE object, or `malformed`;
 * 4. every ranking through the hallucination door — the residue, its
 *    citations, its reason, its place — each refusal a sentence naming what
 *    the model gave;
 * 5. the judge's verdicts and the disagreements, off the ledger the library
 *    filed rather than out of anything reconstructed here.
 */
export async function askHotspots(ask: HotspotAsk): Promise<HotspotOutcome> {
  const want = ask.want ?? HOTSPOT_WANT;
  const { ledger } = ask;
  // THE DOORS THAT COME BEFORE THE MODEL — see {@link coverRefusal}
  const doomed = coverRefusal(ledger);
  if (doomed !== null) return doomed;
  const byId = new Map(ledger.facts.map((fact) => [fact.id, fact]));
  const inTable = new Set(ledger.residues);
  const evidence = defineTool({
    name: EVIDENCE_TOOL,
    description: `Every fact this run's own stages established about the residues at the interface, one per id. ${ledger.basis}. Call this first; it takes no arguments and it is the only evidence you have.`,
    inputSchema: { type: 'object', properties: {}, additionalProperties: false },
    execute: () => Promise.resolve(JSON.stringify({ basis: ledger.basis, from: ledger.from, facts: ledger.facts }, null, 1)),
  });
  const agent = Agent.create({ provider: ask.provider, name: 'prot-hotspots', model: 'anthropic' })
    .system(HOTSPOT_SYSTEM)
    .maxIterations(ask.maxIterations ?? 4)
    .tool(evidence)
    // THE SHAPE, DECLARED — and it buys two things rather than one. The
    // obvious half is that the library judges the answer's shape in the loop
    // and records a contract it did not meet. The half that matters here is
    // that an agent WITH a terminal contract is the one whose answer turn the
    // ledger peels (`findings/reserved.ts` · `peelAnswerFindings`, read by the
    // ENFORCING decider): without it the model's own `_findings.previous` on
    // the answer is never filed, and the judge would be the only source on the
    // record. Two sources is the point.
    //
    // ONE CORRECTIVE RE-ASK, AND IT WAS NONE FOR ONE RELEASE. The note here
    // used to say a malformed answer is a fact this stage reports rather than
    // papers over — which is still true, and is why the sentence below counts
    // the attempts. What changed is a measurement: with the cover rule broken
    // the model was served 717 facts and answered PROSE **every time**, so one
    // unreadable reply ended the stage on every run a reader made. A re-ask is
    // not a re-roll: the shape is DECLARED, so the library quotes its own
    // validator's failure back to the model and asks it to fix that. One is
    // enough to survive a slip; more would be paying for a model that cannot
    // read the contract, which is a fact worth reporting rather than buying
    // past.
    .outputSchema(HOTSPOT_ANSWER_SCHEMA, { retries: 1 })
    // THE LEDGER, ARMED — `quote-facts` is what turns *restate the evidence*
    // into *quote its ids*, and `judge` is the second source whose verdicts
    // land beside the model's own standings rather than replacing them.
    .findings({ answerAsk: 'quote-facts', judge: ask.judge.classifier })
    .build();
  let reply: string;
  const clock = startTheClock(ask.timeoutMs ?? 60_000);
  /**
   * THE ACT, REPORTED WHILE IT HAPPENS — and the listeners come off on every
   * exit, beside the clock, for the same reason: the runner outlives one ask.
   *
   * A caller with no `report` subscribes nothing at all
   * (`./streamReports.ts` · `watchTheAsk` is never entered), so an unwatched
   * ask spends exactly what it spent before this channel existed.
   */
  const unwatch = ask.report === undefined ? (): void => {} : watchTheAsk(agent, { model: ask.model ?? 'scripted (no model)', facts: ledger.facts.length, residues: ledger.covered }, ask.report);
  try {
    const raced = await Promise.race([agent.run({ message: HOTSPOT_QUESTION }), clock.expires]);
    if (raced === TIMED_OUT) {
      return { ok: false, kind: 'timeout', sentence: `the model did not answer stage 5 within ${String(ask.timeoutMs ?? 60_000)} milliseconds. The stage RAN and timed out, which is not the same as a stage that refused — and the answer, if one arrives now, is dropped rather than landed late.`, verdicts: verdictsIn(agent.findings()) };
    }
    if (isPaused(raced)) return { ok: false, kind: 'threw', sentence: 'stage 5 paused, and this stage wires no confirmation gate — so there is nobody to answer it and nothing was landed.', verdicts: verdictsIn(agent.findings()) };
    reply = String(raced);
  } catch (error) {
    const failed = failureOf(error);
    return { ok: false, kind: failed.kind, sentence: failed.sentence, verdicts: verdictsIn(agent.findings()) };
  } finally {
    // THE TIMER IS ALWAYS CANCELLED, on every exit. A pending one holds an
    // event loop open for as long as the budget it was given — a minute per
    // ask on a server that answered in two seconds — and on this side of the
    // wire that is a process that will not shut down when it is asked to.
    clock.cancel();
    unwatch();
  }
  /**
   * THE JUDGE'S OWN STEP, REPORTED — and it is honest because of WHERE it is.
   *
   * `agent.findings()` is read after the run, and the scoring the standing
   * judge did happened inside it; this line says the step is now being read
   * off the record, between the answer arriving and the verdict existing. No
   * part of the answer is in it.
   */
  ask.report?.({ act: 'scoring' });
  const ledgerRows = agent.findings();
  const verdicts = verdictsIn(ledgerRows);
  const disagreements = disagreementsIn(ledgerRows);
  const parsed = readJsonObject(reply);
  const ranked = parsed === null ? null : parsed['ranked'];
  if (parsed === null || !Array.isArray(ranked)) {
    /*
      HOW MANY TIMES IT WAS ASKED, off the LIBRARY'S own record rather than a
      count kept here: `.outputSchema(…, { retries: 1 })` judges the answer in
      the loop and files what it judged (`agent.outputContractUnmet()` —
      `attempts`, `retriesSpent`, and the validator's own message). So the
      sentence says a model was asked once and answered unreadably, or that it
      was asked again with its own failure quoted back and did it twice — which
      are two different facts about a run and a reader deserves to know which.
    */
    const unmet = agent.outputContractUnmet();
    const tries =
      unmet === undefined
        ? ''
        : ` The library judged ${String(unmet.attempts)} ${unmet.attempts === 1 ? 'answer' : 'answers'} against the declared shape and paid for ${String(unmet.retriesSpent)} corrective re-${unmet.retriesSpent === 1 ? 'ask' : 'asks'}; its own validator said: ${unmet.error}.`;
    return {
      ok: false,
      kind: 'malformed',
      sentence: `the model answered and the answer is not the one object stage 5 asked for${parsed === null ? ' — nothing in the reply parses as a JSON object' : ' — it parses, and carries no "ranked" array'}.${tries} Nothing was landed: an answer nobody can read is not a ranking.`,
      verdicts,
    };
  }
  const judged = judgeTheAnswer(ranked as readonly unknown[], { byId, inTable, want });
  if (judged.picks.length === 0 && judged.cited === 0 && ranked.length > 0) {
    return { ok: false, kind: 'cites-nothing', sentence: `the model answered with ${String(ranked.length)} ${ranked.length === 1 ? 'ranking' : 'rankings'} and not one of them cited a fact id. The whole answer is a claim about evidence it never quoted, so stage 5 landed none of it.`, verdicts };
  }
  if (judged.picks.length === 0) {
    return { ok: false, kind: 'nothing-left', sentence: `the model answered with ${String(ranked.length)} ${ranked.length === 1 ? 'ranking' : 'rankings'} and every one of them was refused. ${judged.refused.join(' · ')}`, verdicts };
  }
  return { ok: true, model: ask.model ?? 'scripted (no model)', picks: judged.picks, refused: judged.refused, verdicts, disagreements, served: ledger.facts.length };
}

/** The sentinel a lost race answers with — a value rather than a throw, so a timeout is not read as an error. */
const TIMED_OUT = Symbol('stage 5 timed out');

/**
 * THE BUDGET, AS A PROMISE AND A WAY TO CANCEL IT.
 *
 * `setTimeout` and not an `AbortSignal`, and the reason is a FINDING rather than
 * a preference: `agent.run` takes no signal, so the run cannot be told to stop
 * and the honest statement is that a late answer is DROPPED rather than
 * aborted — which is what the timeout sentence says out loud. `cancel` is what
 * keeps a dropped budget from holding the event loop open for the rest of it.
 */
function startTheClock(ms: number): { readonly expires: Promise<typeof TIMED_OUT>; cancel(): void } {
  let handle: ReturnType<typeof setTimeout> | undefined;
  const expires = new Promise<typeof TIMED_OUT>((resolve) => {
    handle = setTimeout(() => resolve(TIMED_OUT), ms);
  });
  return {
    expires,
    cancel: () => {
      if (handle !== undefined) clearTimeout(handle);
    },
  };
}

/**
 * WHICH FAILURE THIS WAS — read off the error and never guessed into one
 * bucket, because *a reader must always learn whether the stage did not run,
 * ran and refused, or ran and answered*.
 */
function failureOf(error: unknown): { readonly kind: HotspotFailure; readonly sentence: string } {
  const detail = error instanceof Error ? error.message : String(error);
  const name = error instanceof Error ? error.name : '';
  if (name === 'TimeoutError' || /timed out|timeout|abort/i.test(detail)) {
    return { kind: 'timeout', sentence: `the model did not answer stage 5 in time: ${detail}. The stage ran and timed out, and nothing was landed.` };
  }
  if (/fetch failed|ENOTFOUND|ECONNREFUSED|EAI_AGAIN|getaddrinfo|network/i.test(detail)) {
    return { kind: 'unreachable', sentence: `the model could not be reached from this process: ${detail}. Stage 5 asked and got no answer at all, so nothing was landed — this is the network, not a refusal.` };
  }
  if (/\b(401|403|429|529)\b|invalid.{0,3}api.{0,3}key|authentication|permission|rate.?limit|overloaded|refus/i.test(detail)) {
    return { kind: 'refused', sentence: `the model refused stage 5's request, in its own words: ${detail}. The request reached it and it declined, which is a different fact from a network that dropped it.` };
  }
  return { kind: 'threw', sentence: `stage 5 threw: ${detail}. Nothing was landed, and the sentence is the one the failure carried rather than a category this desk invented for it.` };
}

/** What every door said about one answer. */
interface Judged {
  readonly picks: readonly HotspotPick[];
  readonly refused: readonly string[];
  /** How many rankings cited at least one id — what tells *the whole answer cited nothing* from *every pick was refused*. */
  readonly cited: number;
}

/**
 * EVERY RANKING THROUGH EVERY DOOR. Each refusal names what the model gave,
 * and a refused ranking is REMOVED — not repaired, not renumbered into
 * something it did not say. The rank is the model's own order among the
 * rankings it offered, so a refusal in the middle leaves a gap nobody fills.
 */
function judgeTheAnswer(ranked: readonly unknown[], against: { readonly byId: Map<string, LedgerFact>; readonly inTable: ReadonlySet<string>; readonly want: number }): Judged {
  const picks: HotspotPick[] = [];
  const refused: string[] = [];
  const seen = new Set<string>();
  let cited = 0;
  ranked.forEach((entry, at) => {
    if (!isRecord(entry)) {
      refused.push(`the model offered a ranking at position ${String(at + 1)} that is not an object at all, so there is no residue in it to judge and it was refused`);
      return;
    }
    const residue = typeof entry['residue'] === 'string' ? entry['residue'].trim() : '';
    const named = residue === '' ? `<the ranking at position ${String(at + 1)}, which named no residue>` : residue;
    const cites = Array.isArray(entry['cites']) ? (entry['cites'] as readonly unknown[]).flatMap((id) => (typeof id === 'string' && id.trim() !== '' ? [id.trim()] : [])) : [];
    if (cites.length > 0) cited += 1;
    // THE HALLUCINATION DOOR, FIRST — a residue that is not in the table is
    // refused whatever else is right about its ranking
    if (!against.inTable.has(residue)) {
      refused.push(REFUSE_NOT_IN_TABLE(named));
      return;
    }
    if (seen.has(residue)) {
      refused.push(REFUSE_TWICE(residue));
      return;
    }
    if (cites.length === 0) {
      refused.push(REFUSE_CITES_NOTHING(residue));
      return;
    }
    const unknown = cites.find((id) => !against.byId.has(id));
    if (unknown !== undefined) {
      refused.push(REFUSE_UNKNOWN_FACT(residue, unknown));
      return;
    }
    const reason = typeof entry['reason'] === 'string' ? entry['reason'].trim() : '';
    if (reason === '') {
      refused.push(REFUSE_NO_REASON(residue));
      return;
    }
    if (picks.length >= against.want) {
      refused.push(REFUSE_PAST_CEILING(residue, against.want));
      return;
    }
    seen.add(residue);
    picks.push({ residue, rank: picks.length + 1, reason, cites });
  });
  return { picks, refused, cited };
}

// ── the record the judge left ────────────────────────────────────────────────

/**
 * THE JUDGE'S VERDICTS, off the library's own ledger — one row per thing the
 * model was served, with the model's own standing beside it.
 *
 * Nothing is merged: `JudgmentRow` is the judge's reading and `StandingRow` is
 * the model's, and this fold puts them in one row of a table so a reader can
 * see the two, never so a consumer can average them.
 */
export function verdictsIn(rows: FindingsLedger | undefined): readonly HotspotVerdict[] {
  const ledger = rows ?? [];
  const mine = new Map<string, string>();
  for (const row of ledger) if (row.kind === 'standing') mine.set(row.toolCallId, row.standing);
  return ledger.flatMap((row): readonly HotspotVerdict[] => {
    if (row.kind === 'judgment') return [{ of: row.toolName, judge: row.standing, model: mine.get(row.toolCallId) ?? null, confidence: row.confidence, by: `${row.judge.name} · ${row.judge.model}` }];
    if (row.kind === 'judgment-error') return [{ of: row.toolName, judge: 'no verdict', model: mine.get(row.toolCallId) ?? null, confidence: 0, by: row.judge.name, failed: row.message }];
    return [];
  });
}

/**
 * WHERE THE TWO SOURCES DISAGREED — recorded, not resolved. That is the whole
 * point of arming a second source: a ranking whose evidence the judge read as
 * noise is still on the record, and so is the fact that the judge said so.
 */
export function disagreementsIn(rows: FindingsLedger | undefined): readonly string[] {
  return verdictsIn(rows).flatMap((verdict) => {
    if (verdict.failed !== undefined) return [`the judge was asked about the "${verdict.of}" result and produced no verdict: ${verdict.failed} — an absent judgment with a reason, never a guessed one`];
    if (verdict.model === null) return [`the judge read the "${verdict.of}" result as ${verdict.judge} (confidence ${round(verdict.confidence, 2)}) and the model declared no standing on it at all — so the ranking rests on evidence only one of the two sources has spoken about`];
    if (verdict.model === verdict.judge) return [];
    return [`the model declared the "${verdict.of}" result ${verdict.model} and the judge read it as ${verdict.judge} (confidence ${round(verdict.confidence, 2)}) — the two sources disagree, both readings are on the record, and nothing here resolves them`];
  });
}

// ── the scripted ask ─────────────────────────────────────────────────────────

/**
 * THE SCRIPTED MODEL — no key, no network, THE SAME CODE PATH. One turn: call
 * the evidence tool, then answer with the three best-supported residues the
 * ledger it was served actually holds.
 *
 * It reads the tool RESULT rather than carrying an answer of its own, which is
 * the one thing that makes it a fair stand-in: a script that named residues
 * from a literal would pass the hallucination door for a reason the real model
 * has to earn. `pick` lets a test script a run that names something else
 * entirely — which is how the hallucination door is tested at all.
 */
export function scriptedHotspotModel(options: { readonly pick?: (facts: readonly LedgerFact[]) => unknown; readonly want?: number } = {}): LLMProvider {
  return mock({
    name: 'scripted-hotspot-model',
    respond: (request: LLMRequest): Partial<LLMResponse> | string => {
      const results = request.messages.filter((m) => m.role === 'tool');
      const last = results[results.length - 1];
      if (last === undefined) return { content: '', toolCalls: [{ id: 'h0', name: EVIDENCE_TOOL, args: { _findings: { basis: 'direct', expect: 'high', proposition: 'this run has already established, per residue, how many contacts cross the interface, how buried each residue is and how conserved its column is' } } }], stopReason: 'tool_use' };
      const served = readJsonObject(String(last.content));
      const facts = Array.isArray(served?.['facts']) ? (served['facts'] as readonly LedgerFact[]) : [];
      if (options.pick !== undefined) return JSON.stringify({ ranked: options.pick(facts) });
      // the residues the ledger really holds, best-cited first: one ranking per
      // residue, citing every fact that residue has
      const byResidue = new Map<string, LedgerFact[]>();
      for (const fact of facts) byResidue.set(fact.residue, [...(byResidue.get(fact.residue) ?? []), fact]);
      const ranked = [...byResidue.entries()]
        .sort((a, b) => b[1].length - a[1].length)
        .slice(0, options.want ?? 3)
        .map(([residue, held]) => ({ residue, reason: `${residue} is at the interface and every fact this run established about it is cited beside this line; the ranking rests on those and on nothing measured here.`, cites: held.map((f) => f.id) }));
      return JSON.stringify({ ranked, _findings: { previous: [{ toolCallId: 'h0', standing: 'fact', sought: true }] } });
    },
  });
}

// ── the act: the answer, frozen ──────────────────────────────────────────────

/** What the act's answer carries beyond its three columns — the counts a card reads and every refusal, verbatim. */
export interface HotspotsOutput extends ColumnsOutput {
  readonly counts: { readonly ranked: number; readonly refused: number; readonly served: number };
  /** The hallucination door's own sentences, on the act's answer where a caller of `declareAnalysis` can read them. */
  readonly refused: readonly string[];
}

/** What the act says when it is dispatched before an answer has arrived. */
export const NO_ANSWER_YET =
  'no ranking has arrived for this stage, so nothing was landed and no residue carries a rank. The act is declared because a process is standing in front of a model; it lands nothing until that process has an answer that survived every refusal.';

/**
 * THE SLOT — the declared act, and the one door an answer arrives through.
 *
 * WHY A SLOT AND NOT AN ARGUMENT. The def is built at boot, and stage 5's
 * answer cannot exist then: it is a reading of what stages 1 to 4 landed, so
 * it arrives after the run the def is built for. An act declared later is not
 * a thing the library offers (a def's `analyses` is read at build), and an act
 * declared at boot with its answer closed over would be an act declared before
 * its answer could exist. So the declaration is made at boot and the ANSWER
 * arrives through {@link HotspotSlot.offer} — one mutable field, written once
 * per answer, read by the stage function when the act is dispatched.
 *
 * It is not a cache and it is not state the screen reads: the act's COMMIT is
 * the record, and this field is only how the answer gets from the door to the
 * dispatch that freezes it.
 */
export interface HotspotSlot {
  /** What `protAnalyses`' third argument takes. */
  readonly analysis: AnalysisSlot;
  /** Put an answer on the slot. The next dispatch of the act lands exactly this. */
  offer(answer: HotspotAnswered): void;
  /** What has been offered, or `null` while nothing has. */
  readonly offered: HotspotAnswered | null;
}

export function hotspotSlot(): HotspotSlot {
  let offered: HotspotAnswered | null = null;
  const slot = {
    analysis: hotspotsAnalysis(() => offered) as unknown as AnalysisSlot,
    offer: (answer: HotspotAnswered): void => void (offered = answer),
    get offered(): HotspotAnswered | null {
      return offered;
    },
  };
  return slot;
}

/** What the act's own flowchart writes into its state. */
interface HotspotState {
  readonly hotspot_rank: readonly (number | null)[];
  readonly hotspot_cites: readonly (string | null)[];
  readonly hotspot_reason: readonly (string | null)[];
  readonly counts: HotspotsOutput['counts'];
  /**
   * THE REFUSALS, under a key the ARGS do not also carry: a stage may not write
   * to a readonly input key, and `HotspotArgs.refused` is the COUNT that rides
   * on the commit. Two facts, two names — the engine said so by name and it was
   * right to (*Cannot write to readonly input key "refused"*).
   */
  readonly refusals: readonly string[];
}

/** What the act's args carry: the alignment the columns channel judges against, and the declarative facts about the answer. */
interface HotspotArgs {
  readonly residueKeys: readonly string[];
  readonly ranked: readonly HotspotPick[];
  /** How many facts the ledger served the model, and how many of its rankings were refused — on the commit, where a reader of the log meets them. */
  readonly served: number;
  readonly refused: number;
  readonly model: string;
}

/**
 * STAGE 5 — the ranking, as three columns on `residues`.
 *
 * ── WHAT IS ON THE COMMIT, AND WHY IT IS ONLY THIS ─────────────────────────
 * The args carry the picks, the model asked, how many facts were served and
 * how many rankings were refused — the declarative facts a reader of the log
 * needs to check the claim, which is the same choice the conservation act
 * makes about its alignment (`./analyses.ts` · `ConservationArgs`). The
 * JUDGE'S VERDICTS ARE NOT ON IT: the prediction is what is frozen here, and a
 * second source's reading of the evidence is recorded beside the act rather
 * than folded into its columns. A verdict in the prediction's own commit would
 * be the prediction having been revised by the check.
 *
 * ── AND IT LANDS NOTHING RATHER THAN A COLUMN OF SILENCES ──────────────────
 * With no answer offered the act writes no column at all, so the session
 * refuses the read BY NAME (*produced no values for column "hotspot_rank"*) —
 * exactly as the conservation act does when nothing placed. Writing 185 nulls
 * would put a column on the table that means nothing.
 */
function hotspotsAnalysis(answer: () => HotspotAnswered | null): AnalysisDef<readonly Readonly<Record<string, unknown>>[], HotspotsOutput> {
  return {
    id: HOTSPOTS_ACT,
    kind: 'transform',
    produces: 'columns',
    inputs: [{ column: ACT_KEY_COLUMN, role: 'identifier' as const }],
    honesty: {
      notes:
        `THIS IS ${HOTSPOT_TAG.toUpperCase()}. A model was shown the facts stages 1 to 4 established — one per id, read off this run's own recorders and not computed a second time — and asked which residues it would call hot spots and why. ` +
        'Every rank here cites the ids its reason rests on, in `hotspot_cites`, because a ranking with nothing behind it is refused rather than shown. ' +
        'A residue the model named that this run\'s residue table has no row for was refused BY NAME, and so was a citation naming a fact the ledger does not hold; the refusals ride out on the act\'s own answer. ' +
        'The rank is ABSENT — never 0, never last — for every residue the model did not rank: this act says nothing at all about a residue it did not name. ' +
        'It is a reading of evidence and not a measurement of the entry: there is no probe to roll and no contact to count here, and two models shown the same ledger may answer differently.',
    },
    build: () =>
      libraryChart(
        flowChart<HotspotState>(
          'Land the model’s ranking, with the fact ids behind every one of them',
          (scope: { $getArgs(): unknown; $setValue(key: string, value: unknown): void }) => {
            const args = scope.$getArgs() as HotspotArgs;
            const byResidue = new Map(args.ranked.map((pick) => [pick.residue, pick]));
            const counts = { ranked: args.ranked.length, refused: args.refused, served: args.served };
            scope.$setValue('counts', counts);
            if (args.ranked.length === 0) {
              scope.$setValue('refusals', [NO_ANSWER_YET]);
              return;
            }
            scope.$setValue(
              HOTSPOT_RANK_COLUMN,
              args.residueKeys.map((key) => byResidue.get(key)?.rank ?? null),
            );
            scope.$setValue(
              HOTSPOT_CITES_COLUMN,
              args.residueKeys.map((key) => byResidue.get(key)?.cites.join(' ') ?? null),
            );
            scope.$setValue(
              HOTSPOT_REASON_COLUMN,
              args.residueKeys.map((key) => byResidue.get(key)?.reason ?? null),
            );
            scope.$setValue('refusals', []);
          },
          'land-the-ranking',
        ).build(),
      ),
    toRunInput: (rows): HotspotArgs => {
      const offered = answer();
      return {
        residueKeys: rows.map((row) => String(row[ACT_KEY_COLUMN])),
        ranked: offered?.picks ?? [],
        served: offered?.served ?? 0,
        refused: offered?.refused.length ?? 0,
        model: offered?.model ?? 'nothing was asked',
      };
    },
    readOutput: ({ snapshot }): AnalysisResult<HotspotsOutput> => {
      const state = snapshot.sharedState as Readonly<Record<string, unknown>>;
      return {
        ok: true,
        output: {
          as: 'columns',
          table: ACT_TABLE,
          columns: { [HOTSPOT_RANK_COLUMN]: { type: 'int' }, [HOTSPOT_CITES_COLUMN]: { type: 'string' }, [HOTSPOT_REASON_COLUMN]: { type: 'string' } },
          counts: (state['counts'] as HotspotsOutput['counts'] | undefined) ?? { ranked: 0, refused: 0, served: 0 },
          refused: Array.isArray(state['refusals']) ? (state['refusals'] as readonly string[]) : [],
        },
      };
    },
  };
}

/** The intent this act's commit carries — one sentence, written down once. */
export const HOTSPOTS_INTENT =
  'land the ranking a model gave when it was shown the facts stages 1 to 4 established, each rank beside the ids of the facts its reason cites — refusing by name any residue this run\'s table has no row for, any citation the findings ledger cannot answer, and any ranking with no citation at all, so that what reaches these rows is the part of the answer the evidence supports';

/**
 * JUDGED AT LOAD — the two spellings of the act's name must be one name
 * (`./analyses.ts` · `HOTSPOTS_ACT_KEY` is the registry's, this file's is the
 * def's). They are two constants rather than one import because the registry
 * may not depend on the module that can only sometimes perform the act, and a
 * cycle is not the way to keep two names equal.
 */
if (HOTSPOTS_ACT !== HOTSPOTS_ACT_KEY) {
  throw new Error(`stage 5's act is spelled "${HOTSPOTS_ACT}" here and "${HOTSPOTS_ACT_KEY}" in the registry that files it (src/prot/analyses.ts) — one act, one name`);
}
