/**
 * SOMEBODY ELSE'S SECRET — the four promises the published page makes.
 *
 * 1. The driver is chosen by what the environment OFFERS: a key runs the live
 *    analyst, no key runs the scripted turn over the same tools.
 * 2. The key goes to Anthropic and nowhere else — in a header, never in a URL,
 *    never in a body, and never in the wire the panel renders.
 * 3. A missing key leaves the page fully usable: the scripted turn lands the
 *    same agent-badged acts, and nothing at all reaches the network.
 * 4. The clear control really clears it — and a private window that refuses to
 *    remember says so instead of breaking the page.
 */
import { describe, expect, it } from 'vitest';
import { MODEL, chooseDriver } from '../src/nndss/analyst.js';
import { KEY_SLOT, keyOffered, keyStore, type KeyStorage } from '../src/nndss/key.js';
import { createBrowserDesk } from '../src/nndss/browserDesk.js';
import { buildNndssSurface } from '../src/nndss/surface.js';

const KEY = 'sk-ant-a-visitors-own-key-0123456789';

/** A browser's storage, as a Map — what `window.localStorage` is, minus the browser. */
function fakeStorage(seed: Readonly<Record<string, string>> = {}): KeyStorage & { readonly held: Map<string, string> } {
  const held = new Map(Object.entries(seed));
  return {
    held,
    getItem: (name) => held.get(name) ?? null,
    setItem: (name, value) => void held.set(name, value),
    removeItem: (name) => void held.delete(name),
  };
}

/** A browser with site data blocked: it answers reads and throws on every write. */
function blockedStorage(): KeyStorage {
  return {
    getItem: () => null,
    setItem: () => {
      throw new Error('The operation is insecure.');
    },
    removeItem: () => {
      throw new Error('The operation is insecure.');
    },
  };
}

/** One request, remembered — and an answer shaped like Anthropic's, so a turn can finish. */
function recordingFetch(reply: string): { readonly calls: { url: string; init: RequestInit }[]; readonly fetch: typeof fetch } {
  const calls: { url: string; init: RequestInit }[] = [];
  const fake: typeof fetch = (input, init) => {
    calls.push({ url: String(input), init: init ?? {} });
    const body = { id: 'msg_1', model: MODEL, role: 'assistant', content: [{ type: 'text', text: reply }], stop_reason: 'end_turn', usage: { input_tokens: 1, output_tokens: 1 } };
    return Promise.resolve(new Response(JSON.stringify(body), { status: 200, headers: { 'content-type': 'application/json' } }));
  };
  return { calls, fetch: fake };
}

describe('the driver is chosen by what the environment offers', () => {
  it('runs the live analyst on a key and the scripted turn without one', () => {
    expect(chooseDriver(KEY)).toMatchObject({ mode: 'live', model: MODEL });
    expect(chooseDriver(KEY).provider.name).toBe('browser-anthropic');
    expect(chooseDriver(undefined)).toMatchObject({ mode: 'mock' });
    expect(chooseDriver(undefined).model).toBeUndefined();
    // a field with spaces in it is not a key
    expect(chooseDriver('   ').mode).toBe('mock');
    expect(keyOffered('  ')).toBeUndefined();
    expect(keyOffered(` ${KEY} `)).toBe(KEY);
  });

  it('reads the offer out of the browser the visitor is holding', () => {
    const store = keyStore(fakeStorage({ [KEY_SLOT]: KEY }));
    expect(store.read()).toBe(KEY);
    expect(chooseDriver(store.read()).mode).toBe('live');
  });
});

describe('the key never leaves local storage except for Anthropic', () => {
  it('travels in the header to the API and appears in no URL, no body and no wire', async () => {
    const seen = recordingFetch(JSON.stringify({ text: 'read against the table.', refs: [] }));
    const store = keyStore(fakeStorage({ [KEY_SLOT]: KEY }));
    const desk = createBrowserDesk(buildNndssSurface(), store.read(), seen.fetch);
    const wire = await desk.send('what is on screen?');

    expect(seen.calls).toHaveLength(1);
    const call = seen.calls[0]!;
    expect(call.url).toBe('https://api.anthropic.com/v1/messages');
    expect(call.url).not.toContain(KEY); // a secret in a URL is a secret in a log
    const headers = call.init.headers as Record<string, string>;
    expect(headers['x-api-key']).toBe(KEY);
    // the header Anthropic requires before it will answer a page at all
    expect(headers['anthropic-dangerous-direct-browser-access']).toBe('true');
    expect(String(call.init.body)).not.toContain(KEY);
    // the panel renders the wire; the key is not in it, and neither is the storage slot
    expect(JSON.stringify(wire)).not.toContain(KEY);
    expect(wire.mode).toBe('live');
    expect(wire.model).toBe(MODEL);
    expect(wire.transcript.map((line) => line.role)).toEqual(['user', 'analyst']);
  });
});

describe('a missing key falls back to the scripted turn', () => {
  it('drives the same tools, lands the same acts and touches no network', async () => {
    const seen = recordingFetch('never asked for');
    const store = keyStore(fakeStorage()); // nothing kept — a first visit
    expect(store.read()).toBeUndefined();

    const desk = createBrowserDesk(buildNndssSurface(), store.read(), seen.fetch);
    expect(desk.wire().mode).toBe('mock');
    const wire = await desk.send('which region reports the most pertussis?');

    expect(seen.calls).toEqual([]); // no key, no request — not a refusal, a different driver
    expect(wire.mode).toBe('mock');
    expect(wire.model).toBeUndefined();
    const acts = wire.transcript.at(-1)?.activity ?? [];
    expect(acts.map((step) => step.tool)).toEqual(['whats_here', 'dispatch', 'declare_analysis', 'bookmark']);
    expect(wire.transcript.at(-1)?.role).toBe('analyst');
  });
});

describe('the clear control really clears it', () => {
  it('takes the key out of the browser, and the next desk is the scripted one', () => {
    const storage = fakeStorage();
    const store = keyStore(storage);
    expect(store.write(KEY)).toBeUndefined();
    expect(storage.held.get(KEY_SLOT)).toBe(KEY);

    expect(store.clear()).toBeUndefined();
    expect(storage.held.has(KEY_SLOT)).toBe(false);
    expect(store.read()).toBeUndefined();
    expect(chooseDriver(store.read()).mode).toBe('mock');
  });

  it('treats a key typed as blank as a clear, rather than keeping an empty secret', () => {
    const storage = fakeStorage({ [KEY_SLOT]: KEY });
    keyStore(storage).write('   ');
    expect(storage.held.has(KEY_SLOT)).toBe(false);
  });
});

describe('a browser that will not remember', () => {
  it('says so in words that name the slot and never the secret, and leaves the page usable', () => {
    const store = keyStore(blockedStorage());
    expect(store.remembers()).toBe(false);
    const refusal = store.write(KEY);
    expect(refusal).toContain(KEY_SLOT);
    expect(refusal).toContain('The operation is insecure.');
    expect(refusal).not.toContain(KEY);
    expect(store.read()).toBeUndefined();
    expect(chooseDriver(store.read()).mode).toBe('mock'); // the scripted turn is still there
  });

  it('answers honestly when the browser offers no storage at all', () => {
    const store = keyStore(undefined);
    expect(store.remembers()).toBe(false);
    expect(store.read()).toBeUndefined();
    expect(store.write(KEY)).toContain('did not offer local storage');
    expect(store.clear()).toBeUndefined(); // nothing was kept, so nothing is left
  });
});
