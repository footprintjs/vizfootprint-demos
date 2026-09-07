/**
 * WHAT THE PAGE SAYS BEFORE ANYBODY TYPES.
 *
 * The key gate's promises are only promises if they are on the page, next to
 * the field, in words a person reads without hovering anything. These render
 * the real component and read its words back — the four sentences that matter,
 * the control that clears, and the field that never keeps what was typed.
 *
 * Rendered to static markup, like `tests/cells.test.tsx` — no browser needed.
 */
import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { ANTHROPIC_ENDPOINT, KeyGate } from '../web/src/KeyGate.js';

const words = (markup: string): string => markup.replace(/<[^>]+>/g, ' ').replace(/&#x27;/g, "'").replace(/&quot;/g, '"').replace(/&#x2F;/g, '/').replace(/\s+/g, ' ');

const gate = (over: Partial<Parameters<typeof KeyGate>[0]> = {}): string =>
  words(renderToStaticMarkup(<KeyGate mode="mock" held={false} remembers onUse={() => undefined} onClear={() => undefined} {...over} />));

describe('the disclosure is on the page, before the field', () => {
  it('says where the key is kept, where it goes, and what it is never put in', () => {
    const said = gate();
    expect(said).toContain('only in this browser');
    expect(said).toContain('local storage');
    expect(said).toContain('only to Anthropic');
    expect(said).toContain(ANTHROPIC_ENDPOINT);
    expect(said).toContain('never written into a link or a URL');
    expect(said).toContain('never printed to the console or any log');
    expect(said).toContain('Forget my key');
  });

  it('says the page works without a key, and what runs instead', () => {
    const said = gate();
    expect(said).toContain('Without a key the page is fully usable');
    expect(said).toContain('scripted turn');
    expect(said).toContain('Nothing reaches the network');
    expect(said).toContain('mock · scripted turn (no key)'); // the mode is on screen, not inferred from an empty field
  });

  it('names the model when a key is driving a real one', () => {
    expect(gate({ mode: 'live', model: 'claude-sonnet-5', held: true })).toContain('claude-sonnet-5');
  });
});

describe('the clear control', () => {
  it('is offered exactly while a key is held', () => {
    expect(gate({ held: true })).toContain('Forget my key');
    // the promise is still stated with no key held; the BUTTON is what appears with one
    expect(gate({ held: false })).not.toMatch(/>\s*Forget my key\s*</);
  });
});

describe('a browser that will not remember', () => {
  it('says so on the page rather than losing the key in silence', () => {
    expect(gate({ remembers: false })).toContain('will not let the page remember');
    expect(gate({ remembers: true })).not.toContain('will not let the page remember');
  });

  it('shows the browser’s own refusal when there is one', () => {
    expect(gate({ problem: 'this browser would not keep "vizfootprint-demo:anthropic-key": The operation is insecure.' })).toContain('The operation is insecure.');
  });
});

describe('the field itself', () => {
  it('is a password field that no autofill or spellchecker reads', () => {
    const markup = renderToStaticMarkup(<KeyGate mode="mock" held={false} remembers onUse={() => undefined} onClear={() => undefined} />);
    expect(markup).toContain('type="password"');
    expect(markup).toContain('autoComplete="off"');
    expect(markup).toContain('spellcheck="false"');
    // nothing is pre-filled: the markup carries no value for the key input
    expect(markup).not.toContain('value="sk-');
  });
});
