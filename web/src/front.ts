/**
 * THE FRONT DOOR'S RULE — the pure half of `Home.tsx`.
 *
 * No React, no DOM, no fetch. What lives here is the decision of WHICH of
 * three states the landing page is in and WHICH figures it may print, and it
 * lives in its own file for the reason `derive.ts` does: a rule inside a
 * render function cannot be tested, and this one is worth testing.
 * `tests/front.test.ts` reads this file; `Home.tsx` calls it and does the
 * drawing.
 *
 * One law, in one sentence: **the door opens only when the server has
 * answered with every figure the page prints.** A landing page that offered a
 * way in while it was still reading, or while nothing was listening, would be
 * the one place in a demo about saying what you know and what you could not
 * honour that quietly reported something it did not know.
 *
 * Every number on the page therefore comes off the wire — `GET /api/summary`,
 * counted by the server from the tables the dashboard actually runs on. There
 * is no constant here that a person could read as a figure.
 */

/**
 * Where the demo server should be.
 *
 * The one fact on this page that is NOT read from the server, and it cannot
 * be: the line that names it is only ever printed when nothing answered. It is
 * the port `npm run serve` binds by default (`server/server.ts`) and the target
 * the dev proxy forwards `/api` to (`web/vite.config.ts`).
 */
export const API_ORIGIN = 'http://localhost:5290';

/** The door the figures come from — named on the page, so a reader can check them. */
export const SUMMARY_DOOR = '/api/summary';

/** What the page has heard from {@link SUMMARY_DOOR} so far. */
export type Reading =
  | { readonly status: 'reading' }
  | { readonly status: 'answered'; readonly body: unknown }
  | {
      readonly status: 'unreachable';
      readonly because: string;
      /** `true` when something DID reply (an HTTP status, a body that was not a summary). Silence and a wrong answer are not the same fault and are not told the same way. */
      readonly answered?: boolean;
    };

/** One figure on the page: the payload field it was read from, the number, and how it reads. */
export interface Figure {
  /** The key of the `/api/summary` payload this number is — never a constant in this file. */
  readonly from: string;
  readonly value: number;
  readonly shown: string;
  readonly label: string;
}

/** The page, in one of exactly three states. `enter: null` is a state with NO way in. */
export type FrontDoor =
  | { readonly state: 'reading'; readonly waitingFor: string; readonly enter: null }
  | {
      readonly state: 'ready';
      /** The dashboard's own declared title, off the wire — not a headline written here. */
      readonly title: string;
      /** Its own declared summary, likewise. */
      readonly caption: string;
      readonly figures: readonly Figure[];
      /** The absence vocabulary the snapshot declares — the words a silence is kept in. */
      readonly vocabulary: readonly string[];
      /** Whether the analyst is live or scripted, as the server reported it. */
      readonly analyst: string | null;
      /** When the snapshot was read, as the source layer vouched for it. */
      readonly snapshotRead: string | null;
      readonly enter: { readonly label: string };
    }
  | {
      readonly state: 'unreachable';
      /** Silence and a wrong answer read differently — a reader who confuses them looks in the wrong place. */
      readonly heading: string;
      readonly because: string;
      /** What to do about it — and the two faults do not get the same advice. */
      readonly advice: string;
      readonly enter: null;
    };

/** The figures the page prints, each named by the payload field it is read from. */
const COUNTS: readonly { readonly from: string; readonly label: string }[] = [
  { from: 'rows', label: 'cells — disease × area × week' },
  { from: 'diseases', label: 'diseases' },
  { from: 'weeks', label: 'MMWR weeks' },
  { from: 'jurisdictions', label: 'reporting jurisdictions' },
  { from: 'views', label: 'views the dashboard declares' },
];

const isObject = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);

/** A whole, finite count — or `null`, which is never quietly turned into a zero. */
const whole = (v: unknown): number | null => (typeof v === 'number' && Number.isFinite(v) && Number.isInteger(v) && v >= 0 ? v : null);

const text = (v: unknown): string | null => (typeof v === 'string' && v.trim() !== '' ? v : null);

/**
 * An ISO instant as a person reads it, in UTC — the timestamp the source layer
 * vouched for, not a re-dated one. A string that is not an instant is handed
 * back untouched rather than turned into a plausible date.
 */
export function readableInstant(iso: string): string {
  const at = new Date(iso);
  if (Number.isNaN(at.getTime())) return iso;
  const pad = (n: number): string => String(n).padStart(2, '0');
  return `${String(at.getUTCFullYear())}-${pad(at.getUTCMonth() + 1)}-${pad(at.getUTCDate())} ${pad(at.getUTCHours())}:${pad(at.getUTCMinutes())} UTC`;
}

/**
 * The closed door, in the words the fault deserves. Silence means start the
 * server; a reply that was not a summary means the server is there and is not
 * this demo's build — telling a reader the first when it is the second sends
 * them to the wrong place.
 */
const shut = (because: string, answered: boolean): FrontDoor => ({
  state: 'unreachable',
  heading: answered ? 'The demo server answered, but not with this page\'s figures.' : 'The demo server is not answering.',
  because,
  advice: answered
    ? `Something is listening on ${API_ORIGIN}, but it did not serve ${SUMMARY_DOOR} — most likely an older build of this demo. Restart it with “npm run serve” and reload this page.`
    : `It should be listening on ${API_ORIGIN} — start it with “npm run serve” in the repo, then reload this page.`,
  enter: null,
});

/** English for a list, so a refusal reads as a sentence and not as a dump. */
const andList = (parts: readonly string[]): string =>
  parts.length <= 1 ? (parts[0] ?? '') : `${parts.slice(0, -1).join(', ')} and ${String(parts[parts.length - 1])}`;

/**
 * The reading → the page. The `answered` branch is the only one that can open
 * the door, and only when every figure and both declared words arrived: a
 * summary that came back short is reported as a summary that came back short,
 * by name, and the door stays shut.
 */
export function frontDoor(reading: Reading): FrontDoor {
  if (reading.status === 'reading') {
    return { state: 'reading', waitingFor: `asking the demo server what this snapshot holds (${SUMMARY_DOOR})`, enter: null };
  }
  if (reading.status === 'unreachable') return shut(reading.because, reading.answered === true);
  const body = reading.body;
  if (!isObject(body)) return shut(`${SUMMARY_DOOR} answered with something that is not a summary`, true);

  const figures: Figure[] = [];
  const missing: string[] = [];
  for (const spec of COUNTS) {
    const value = whole(body[spec.from]);
    if (value === null) {
      missing.push(`a count of ${spec.from}`);
      continue;
    }
    figures.push({ from: spec.from, value, shown: value.toLocaleString('en-US'), label: spec.label });
  }

  const words = isObject(body['words']) ? body['words'] : {};
  const title = text(words['title']);
  const caption = text(words['caption']);
  if (title === null) missing.push("the dashboard's declared title");
  if (caption === null) missing.push('its declared summary');

  if (missing.length > 0 || title === null || caption === null) {
    return shut(`${SUMMARY_DOOR} answered, but without ${andList(missing)} — this page prints the server's figures or none, so there is nothing to show`, true);
  }

  const absence = isObject(body['absence']) ? body['absence'] : {};
  const states = absence['states'];
  const vocabulary = Array.isArray(states) ? states.filter((s): s is string => typeof s === 'string') : [];

  const mode = body['mode'];
  const analyst =
    mode === 'live' ? 'the analyst is live' : mode === 'mock' ? 'the analyst runs one scripted turn (no API key)' : null;

  const snapshot = isObject(body['snapshot']) ? body['snapshot'] : {};
  const readAt = text(snapshot['retrievedAt']);

  return {
    state: 'ready',
    title,
    caption,
    figures,
    vocabulary,
    analyst,
    snapshotRead: readAt === null ? null : readableInstant(readAt),
    enter: { label: 'Open the dashboard' },
  };
}
