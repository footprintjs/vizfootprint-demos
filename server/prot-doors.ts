/**
 * THE PROTEIN DESK'S DOORS — stage 5, and the reason this file exists at all.
 *
 *   GET  /api/prot/state           whether stage 5 can run here, and if not WHY
 *   POST /api/prot/hotspots        the run's evidence in, the ranked list with
 *                                  its citations and the judge's verdicts out
 *   GET  /api/prot/<declared file> one committed file — the bytes a served page
 *                                  reads, from the one list the static build
 *                                  copies (`src/data/files.ts`)
 *
 * ── WHY THERE IS A DOOR FOR THIS STAGE AND FOR NO OTHER ────────────────────
 * Stages 1 to 4 need a file, two services and two engines, and a browser can
 * have all of them — which is why the published desk really performs them and
 * says so. Stage 5 needs a MODEL, and a key shipped inside a page's own bytes
 * is a key given away. So the published build keeps saying *declared, and this
 * build cannot perform it* with its measured reason (`src/prot/plan.ts` ·
 * step 5), and that is the architecture rather than a shortfall. **This door
 * is the local half**, for someone who clones the project and runs it to see
 * the whole pipeline — and nothing in it can reach the Pages build, which has
 * no process to reach.
 *
 * ── WHAT IT DOES AND DOES NOT HOLD ─────────────────────────────────────────
 * IT HOLDS NO SESSION. The dashboard, the commit log and the residues table
 * belong to the page: the evidence comes UP in the request, read off the run's
 * own recorders there, and the accepted ranking goes back DOWN and is landed
 * as an act on the page's own session (`src/prot/session.ts` ·
 * `landHotspots`). One record, not two — a second session on this side would
 * be a second answer to *where did this column come from*.
 *
 * So what this file owns is exactly the part a static page cannot do: standing
 * in front of a model with a key.
 *
 * ── THE KEY ────────────────────────────────────────────────────────────────
 * ONE LINE reads it, `chooseHotspotDriver`, out of `process.env` and through
 * `./env.ts`'s existing discipline — the `./doors.ts` · `createDesk`
 * precedent, which is the only other place in this repository that touches a
 * secret. It is handed to the provider and to nothing else. It is never
 * printed, never logged, never interpolated into a sentence, never put in a
 * response body and never written to a fixture: `tests/prot-doors.test.ts`
 * asserts that over every sentence and every body this file can produce, and
 * the presence check this module answers with is a BOOLEAN.
 *
 * ── FAIL CLOSED, AND SAY WHICH ─────────────────────────────────────────────
 * No key ⇒ the door answers that it has no key, and the desk shows stage 5 as
 * unavailable with THAT reason rather than the static-build one. Unreachable,
 * timed out, refused, malformed, citing nothing, every ranking refused — each
 * is a sentence of its own (`src/prot/hotspots.ts` · `HotspotFailure`), and
 * none of them is a silent empty list. A reader always learns whether the
 * stage did not run, ran and refused, or ran and answered.
 */
import type { IncomingMessage, ServerResponse } from 'node:http';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { browserAnthropic, type LLMProvider } from 'agentfootprint/providers';
import { PROT_CONSERVATION_FILES, PROT_FILES } from '../src/data/files.js';
import {
  HOTSPOT_TAG,
  HOTSPOT_WANT,
  NO_KEY_SENTENCE,
  askHotspots,
  providerJudge,
  scriptedHotspotModel,
  scriptedJudge,
  type HotspotJudge,
  type HotspotLedger,
  type HotspotOutcome,
  type LedgerFact,
} from '../src/prot/hotspots.js';

/** Where this desk's doors live — a prefix, so the other two demos keep theirs. */
export const PROT_API_ROOT = '/api/prot';

/**
 * The model a live ask names. The same environment knob the NNDSS analyst
 * reads (`../src/nndss/analyst.ts` · `envModel`), read the same way: a blank
 * is ABSENT rather than empty, because `ANTHROPIC_MODEL= npm run serve` would
 * otherwise ask the API for the model "".
 */
export function protModel(): string {
  const raw = process.env['ANTHROPIC_MODEL'];
  return raw === undefined || raw.trim() === '' ? 'claude-sonnet-5' : raw.trim();
}

const MAX_TOKENS = 2048;

/**
 * WHAT IS DRIVING STAGE 5 — and `none` is a first-class answer rather than a
 * fallback.
 *
 * The NNDSS analyst falls back to a scripted turn with no key, because its
 * scripted turn lands the same agent-badged commits and the desk stays fully
 * usable. Stage 5 may NOT do that: a scripted ranking would put a recommendation
 * on the record that no model made, which is the one thing this stage exists
 * not to do. So no key is `none`, with the sentence, and the desk shows the
 * stage as unavailable for THAT reason.
 */
export type HotspotDriver =
  | { readonly mode: 'live'; readonly provider: LLMProvider; readonly judge: HotspotJudge; readonly model: string }
  | { readonly mode: 'scripted'; readonly provider: LLMProvider; readonly judge: HotspotJudge; readonly model: string }
  | { readonly mode: 'none'; readonly reason: string };

/**
 * THE ONE DECISION, AND THE ONE LINE THAT TOUCHES A SECRET: what did this
 * environment offer?
 *
 * The caller says where the offer came from; this never goes looking anywhere
 * else, so there is exactly one place on this side of the wire that reads a
 * key. The judge is built over the SAME provider, and it says so — a second
 * reading by the same family of model is a real second source and is not
 * independent of the first (`src/prot/hotspots.ts` · `providerJudge`).
 */
export function chooseHotspotDriver(offered: string | undefined): HotspotDriver {
  const key = (offered ?? '').trim();
  if (key === '') return { mode: 'none', reason: NO_KEY_SENTENCE };
  const model = protModel();
  const provider = browserAnthropic({ apiKey: key, defaultModel: model, defaultMaxTokens: MAX_TOKENS });
  return { mode: 'live', provider, judge: providerJudge(provider, model), model };
}

/**
 * The scripted driver — for this repository's own suite, for a script, and for
 * somebody who cloned the project with no key and wants to see the SHAPE of
 * stage 5 rather than a model's opinion.
 *
 * It is NOT what a missing key falls back to (see {@link HotspotDriver}): a
 * caller has to ask for it BY NAME, which is the whole of what keeps a
 * scripted ranking from being mistaken for one a model gave. On the wire it
 * says so in three places at once — `mode: 'scripted'`, the model string
 * `scripted (no model)`, and the judge's own sentence.
 */
export function scriptedHotspotDriver(): HotspotDriver {
  return { mode: 'scripted', provider: scriptedHotspotModel(), judge: scriptedJudge(), model: 'scripted (no model)' };
}

/** The one environment name that asks for the scripted driver by name. */
export const SCRIPTED_ENV = 'PROT_SCRIPTED';

export interface ProtDesk {
  readonly driver: HotspotDriver;
  /** How many rankings the door will keep. */
  readonly want: number;
  /** Every ask this desk answered, newest last — what `GET /api/prot/state` reports counts from. */
  readonly asks: HotspotOutcome[];
}

/**
 * The served desk. Its driver is chosen by what THIS environment offers, and
 * a caller may hand one in instead — which is how the suite drives every door
 * of this file with no key, no network and no real model.
 */
export function createProtDesk(driver: HotspotDriver = driverFromEnvironment()): ProtDesk {
  return { driver, want: HOTSPOT_WANT, asks: [] };
}

/**
 * WHAT THIS ENVIRONMENT OFFERED, and what it ASKED FOR — two different
 * questions, and the asked-for one is answered first.
 *
 * `PROT_SCRIPTED=1` is an explicit request for the scripted driver and it wins
 * over a key, because a request by name is not something to second-guess: a
 * developer who wants the shape of stage 5 without spending a call has said so.
 * Everything else is decided by the offer alone ({@link chooseHotspotDriver}),
 * which is the one line that reads a secret.
 */
export function driverFromEnvironment(): HotspotDriver {
  if (process.env[SCRIPTED_ENV] === '1') return scriptedHotspotDriver();
  return chooseHotspotDriver(process.env['ANTHROPIC_API_KEY']);
}

/** What a page needs before it draws stage 5's card: whether it can run, and if not the reason IN THE DESK'S WORDS. */
export interface ProtStateWire {
  /** `live` = a model will be asked. `scripted` = the suite's driver. `none` = nothing here can ask. */
  readonly mode: HotspotDriver['mode'];
  /** The model a live ask names. Absent under `none`, because nothing is asked of a model. */
  readonly model?: string;
  /** Why stage 5 cannot run here. Absent when it can. */
  readonly reason?: string;
  /** What the judge is and whether it is the weaker of the two — the page shows this beside every verdict. */
  readonly judge?: { readonly said: string; readonly weaker: boolean };
  readonly want: number;
  /** The word that must ride every number this stage produces. */
  readonly tag: string;
  /** How many asks this process has answered. */
  readonly asks: number;
}

export function protStateOf(desk: ProtDesk): ProtStateWire {
  const { driver } = desk;
  return {
    mode: driver.mode,
    ...(driver.mode === 'none' ? { reason: driver.reason } : { model: driver.model, judge: { said: driver.judge.said, weaker: driver.judge.weaker } }),
    want: desk.want,
    tag: HOTSPOT_TAG,
    asks: desk.asks.length,
  };
}

/**
 * THE EVIDENCE, OFF THE WIRE — read defensively and refused by name, because a
 * request body is a boundary.
 *
 * `residues` is the list the hallucination door judges a named residue
 * against, so it is REQUIRED: a request that sent facts and no table would
 * make the door judge a name against nothing and pass every hallucination
 * through. That is refused rather than defaulted.
 */
export function ledgerOf(body: Record<string, unknown>): HotspotLedger | { readonly error: string } {
  const facts = body['facts'];
  const residues = body['residues'];
  if (!Array.isArray(residues) || residues.some((key) => typeof key !== 'string') || residues.length === 0) {
    return { error: 'this door needs "residues": every residue key the run\'s own table holds, as strings. It is what a named residue is judged against, and a request without it would let every hallucination through' };
  }
  if (!Array.isArray(facts)) return { error: 'this door needs "facts": the findings ledger the run\'s own recorders produced, as an array' };
  const read: LedgerFact[] = [];
  for (const [at, fact] of facts.entries()) {
    if (typeof fact !== 'object' || fact === null || Array.isArray(fact)) return { error: `the fact at position ${String(at + 1)} is not an object` };
    const row = fact as Record<string, unknown>;
    const { id, residue, text, from } = row;
    if (typeof id !== 'string' || id.trim() === '') return { error: `the fact at position ${String(at + 1)} carries no id, and an id is what the model is asked to quote` };
    if (typeof residue !== 'string' || typeof text !== 'string' || typeof from !== 'string') return { error: `the fact "${id}" is missing its residue, its text or the act it came from` };
    read.push({ id, residue, text, from });
  }
  const basis = typeof body['basis'] === 'string' ? body['basis'] : 'the page sent no sentence about which residues this ledger covers';
  const from = Array.isArray(body['from']) ? (body['from'] as readonly unknown[]).flatMap((act) => (typeof act === 'string' ? [act] : [])) : [...new Set(read.map((f) => f.from))];
  return { facts: read, residues: residues as readonly string[], basis, from };
}

/**
 * ONE ASK — and the whole of the door's own logic, which is two lines: no
 * driver is a sentence, a driver is a run. Everything else about judging the
 * answer lives in `src/prot/hotspots.ts`, where the law is written down.
 */
export async function answerHotspots(desk: ProtDesk, body: Record<string, unknown>): Promise<{ readonly status: number; readonly body: unknown }> {
  const ledger = ledgerOf(body);
  if ('error' in ledger) return { status: 400, body: { ok: false, kind: 'malformed-request', sentence: ledger.error } };
  const { driver } = desk;
  if (driver.mode === 'none') {
    // 200 AND NOT AN ERROR STATUS, deliberately: the door answered, and what it
    // answered is a fact about this process that the page must be able to show
    // as the stage's own reason. A 5xx would make it look like a fault.
    const said = { ok: false as const, kind: 'no-key' as const, sentence: driver.reason, verdicts: [] };
    desk.asks.push(said);
    return { status: 200, body: said };
  }
  const outcome = await askHotspots({
    provider: driver.provider,
    judge: driver.judge,
    model: driver.model,
    ledger,
    want: desk.want,
    ...(typeof body['timeoutMs'] === 'number' ? { timeoutMs: body['timeoutMs'] } : {}),
  });
  desk.asks.push(outcome);
  return { status: 200, body: outcome };
}

// ── the committed files ──────────────────────────────────────────────────────

/**
 * WHAT A SERVED PAGE MAY READ, and it is a LIST rather than a directory.
 *
 * The one list `src/data/files.ts` declares is what the static build copies,
 * what the browser loaders fetch and what the site's dev route answers — and
 * this door answers exactly the same names, so a served page and a published
 * one read the same bytes by the same paths. A path outside the list is not
 * served at all: a door that joined a path from a request would be a door that
 * reads this repository.
 */
export const PROT_SERVED_FILES: readonly string[] = [...Object.values(PROT_FILES), ...PROT_CONSERVATION_FILES];

/** What a committed file IS, by its extension — the `web/site.vite.config.ts` · `DATA_TYPES` vocabulary, and nothing guessed. */
const TYPES: Readonly<Record<string, string>> = {
  '.pdb': 'text/plain; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.sto': 'text/plain; charset=utf-8',
  '.txt': 'text/plain; charset=utf-8',
  '.csv': 'text/csv; charset=utf-8',
};

function sendJson(res: ServerResponse, status: number, body: unknown): void {
  res.writeHead(status, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' });
  res.end(JSON.stringify(body));
}

const MAX_BODY_BYTES = 4_000_000;

class BodyRefusal extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
  }
}

async function readJson(req: IncomingMessage): Promise<Record<string, unknown>> {
  const chunks: Buffer[] = [];
  let size = 0;
  for await (const chunk of req) {
    size += (chunk as Buffer).length;
    if (size > MAX_BODY_BYTES) throw new BodyRefusal(413, `body over ${String(MAX_BODY_BYTES)} bytes`);
    chunks.push(chunk as Buffer);
  }
  const raw = Buffer.concat(chunks).toString('utf8');
  if (raw.trim() === '') return {};
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new BodyRefusal(400, 'body is not JSON');
  }
  return parsed !== null && typeof parsed === 'object' && !Array.isArray(parsed) ? (parsed as Record<string, unknown>) : {};
}

/** The doors that only answer a POST — so a GET at one of them says "wrong verb", not "no such door". */
const POST_DOORS = new Set(['hotspots']);

/**
 * One request. Answers `true` when it handled it, `false` when the path is not
 * one of ours — the same shape `serveDoors` and `serveGridDoors` have, so the
 * server can try the three in a row and fall through to the static files.
 */
export async function serveProtDoors(desk: ProtDesk, req: IncomingMessage, res: ServerResponse, repoRoot: string = process.cwd()): Promise<boolean> {
  const url = new URL(req.url ?? '/', 'http://localhost');
  if (!url.pathname.startsWith(`${PROT_API_ROOT}/`)) return false;
  const door = url.pathname.slice(PROT_API_ROOT.length + 1);
  try {
    if (req.method === 'GET' && door === 'state') return sendJson(res, 200, protStateOf(desk)), true;
    // ONE COMMITTED FILE, by the name the declared list holds — never a path
    // joined from the request
    if (req.method === 'GET' && PROT_SERVED_FILES.includes(door)) {
      const file = path.join(repoRoot, door);
      if (!existsSync(file)) {
        res.writeHead(404, { 'content-type': 'text/plain; charset=utf-8' });
        res.end(`${door} is declared by this desk and is not in this checkout — run the fetch script in its data folder`);
        return true;
      }
      res.writeHead(200, { 'content-type': TYPES[path.extname(file)] ?? 'application/octet-stream' });
      res.end(readFileSync(file));
      return true;
    }
    if (req.method !== 'POST') {
      return POST_DOORS.has(door) ? (sendJson(res, 405, { error: `${door} is POST` }), true) : (sendJson(res, 404, { error: `no door "${door}"` }), true);
    }
    const body = await readJson(req);
    if (door === 'hotspots') {
      const answer = await answerHotspots(desk, body);
      return sendJson(res, answer.status, answer.body), true;
    }
    return sendJson(res, 404, { error: `no door "${door}"` }), true;
  } catch (error) {
    if (error instanceof BodyRefusal) return sendJson(res, error.status, { error: error.message }), true;
    // THE MESSAGE AND NOT THE ERROR: an error's own text is the only thing that
    // goes on the wire here, and nothing in this file ever puts a key in one.
    return sendJson(res, 500, { error: error instanceof Error ? error.message : String(error) }), true;
  }
}
