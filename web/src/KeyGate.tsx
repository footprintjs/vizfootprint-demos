/**
 * THE KEY GATE — where a visitor hands over their own Anthropic key, and where
 * this page says, in plain words and BEFORE they type, what it will do with it.
 *
 * The disclosure is not a tooltip and not a link. It is the paragraph above the
 * field, because a person cannot consent to something they have to hover to
 * read. Every sentence in it is a promise some other file keeps:
 *
 *   kept in this browser only  → `src/nndss/key.ts` (local storage, nothing else)
 *   sent only to Anthropic     → `liveProvider` in `src/nndss/analyst.ts`
 *   never logged, never in a URL→ `tests/key.test.ts` reads the real request
 *   cleared by a control        → `onClear` below, proven by the same tests
 *
 * This component holds the typed characters and nothing else: it never reads
 * storage, never builds a provider, and hands the key up exactly once, when the
 * person presses the button. The page above it owns the secret's whole life.
 */
import { useState } from 'react';

// ── the words ───────────────────────────────────────────────────────────────

/** Where a live turn goes. Named on the page so a reader can check it against their own network tab. */
export const ANTHROPIC_ENDPOINT = 'https://api.anthropic.com/v1/messages';

export interface KeyGateProps {
  /** `live` = a key is driving a real model; `mock` = the scripted turn, same tools, no network. */
  readonly mode: 'live' | 'mock';
  /** The model a live turn names. */
  readonly model?: string;
  /** Is a key held in this browser right now? */
  readonly held: boolean;
  /** Will this browser remember anything at all? A private window will not — and the page says so rather than losing the key in silence. */
  readonly remembers: boolean;
  /** What the browser refused, in its own words — the storage slot is named, the key never is. */
  readonly problem?: string;
  /** Hand the typed key up. Called once, on the button. */
  readonly onUse: (key: string) => void;
  /** Forget it. The visible control the disclosure promises. */
  readonly onClear: () => void;
  /** A turn is in flight — changing the driver mid-turn is not offered. */
  readonly busy?: boolean;
}

const BOX: React.CSSProperties = { border: '1px solid #dfe4ea', borderRadius: 8, padding: '.6rem .75rem', background: '#fbfcfd', fontSize: 12.5, lineHeight: 1.5 };

// ── the gate ────────────────────────────────────────────────────────────────

export function KeyGate(props: KeyGateProps): JSX.Element {
  const [typed, setTyped] = useState('');
  const busy = props.busy ?? false;

  return (
    <div style={BOX} aria-label="your Anthropic key">
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginBottom: 4 }}>
        <b>Run the analyst with your own Anthropic key</b>
        <span style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: '.06em', opacity: 0.7 }}>{props.mode === 'live' ? `live · ${props.model ?? 'anthropic'}` : 'mock · scripted turn (no key)'}</span>
      </div>
      {/* the disclosure, above the field: what happens to the secret, in the order it happens */}
      <p style={{ margin: '0 0 .5rem' }}>
        There is no server behind this page, so a live analyst needs a key of yours. If you paste one: it is kept <b>only in this browser</b>, in its local storage, on this
        device. It is sent <b>only to Anthropic</b>, as a request header to <code>{ANTHROPIC_ENDPOINT}</code> — never to us, never to any other host, never written into a link or
        a URL, and never printed to the console or any log. It is never put in the page's address, so it cannot travel in a shared link. While a key is held, a{' '}
        <b>Forget my key</b> control sits beside the field, and it removes the key from this browser at once. Charges for what you ask are on your own Anthropic account.
      </p>
      <p style={{ margin: '0 0 .5rem' }}>
        <b>Without a key the page is fully usable.</b> The analyst then runs a <b>scripted turn</b> over the same fixed tools — it orients, selects a disease, runs a declared
        analysis and names a bookmark — so every act still lands in the commit log with an <b>agent</b> badge. Nothing reaches the network.
      </p>
      {!props.remembers ? (
        <p style={{ margin: '0 0 .5rem', color: '#8a5a2b' }}>
          This browser will not let the page remember anything — a private window usually does that. A key you paste here will drive this visit and be gone when you reload.
        </p>
      ) : null}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          const key = typed.trim();
          if (key === '' || busy) return;
          setTyped(''); // the field does not keep it: the store above is the one place it lives
          props.onUse(key);
        }}
        style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}
      >
        <input
          type="password"
          value={typed}
          onChange={(e) => setTyped(e.target.value)}
          placeholder={props.held ? 'a key is in this browser — paste another to replace it' : 'sk-ant-…'}
          aria-label="your Anthropic API key"
          autoComplete="off"
          spellCheck={false}
          disabled={busy}
          style={{ flex: '1 1 18rem', padding: '5px 8px', font: 'inherit' }}
        />
        <button type="submit" disabled={busy || typed.trim() === ''} style={{ font: 'inherit', padding: '5px 12px' }}>
          Use this key
        </button>
        {props.held ? (
          <button type="button" disabled={busy} onClick={() => props.onClear()} title="remove the key from this browser's storage and go back to the scripted turn" style={{ font: 'inherit', padding: '5px 12px' }}>
            Forget my key
          </button>
        ) : null}
      </form>
      {props.problem === undefined ? null : (
        <div role="alert" style={{ marginTop: 6, color: '#a83a3a' }}>
          ⚠ {props.problem}
        </div>
      )}
    </div>
  );
}
