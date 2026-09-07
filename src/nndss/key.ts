/**
 * THE VISITOR'S KEY — somebody else's secret, in one place.
 *
 * On the published site there is no server and no key of ours. A visitor who
 * wants a live analyst types their own Anthropic key, and this module is the
 * whole of what this repository does with it:
 *
 *   1. it is kept in THEIR browser's local storage and nowhere else — no
 *      cookie, no query string, no fetch of ours, no console line;
 *   2. it is read back only to build the provider that calls Anthropic;
 *   3. a visible control clears it, and clearing really removes it.
 *
 * WHY a port and not `localStorage` directly: the root tsconfig has no DOM
 * lib, the tests run in node, and a private window can throw on the very act
 * of reaching for storage. Three methods is all this needs, so three methods
 * is what it asks for — and every call sits inside a try/catch, because a
 * browser that refuses to remember must leave the page working, not broken.
 *
 * WHY no refusal sentence ever quotes the value: the house rule is that a
 * refusal quotes what it refused. A key is the one value where that rule is
 * the wrong one — the sentences below name the storage slot and repeat what
 * the browser said, and never the secret itself.
 */

/** Where the key is kept. Named after this demo so it cannot collide with another page on the same host. */
export const KEY_SLOT = 'vizfootprint-demo:anthropic-key';

/** The slice of Web Storage this module uses. `window.localStorage` satisfies it; so does a Map in a test. */
export interface KeyStorage {
  getItem(name: string): string | null;
  setItem(name: string, value: string): void;
  removeItem(name: string): void;
}

/**
 * What the browser did with the secret: nothing to say, or a sentence saying
 * what it would not do. `undefined` means it is done.
 */
export type Refusal = string | undefined;

export interface KeyStore {
  /** The key this browser is holding, or `undefined` — a blank slot and a browser that would not answer read the same. */
  read(): string | undefined;
  /** Keep it. A key that is only whitespace clears the slot instead, because a field with spaces in it is not a key. */
  write(raw: string): Refusal;
  /** Forget it. What the visible control calls. */
  clear(): Refusal;
  /** Will this browser remember anything at all? A private window says no — the page then still runs, on the scripted turn. */
  remembers(): boolean;
}

/**
 * A key as offered by a person: trimmed, and empty read as absent.
 *
 * WHY no format check: refusing a key whose prefix we did not recognise would
 * turn our guess about Anthropic's key format into the visitor's problem. The
 * API is the judge of a key; this only decides whether one was given.
 */
export function keyOffered(raw: string | undefined | null): string | undefined {
  const key = (raw ?? '').trim();
  return key === '' ? undefined : key;
}

/**
 * The browser's own storage, if reaching for it does not throw.
 *
 * WHY the try around the ACCESS and not just the call: with site data blocked,
 * some browsers throw on the property read itself, before any method runs.
 */
export function ambientStorage(): KeyStorage | undefined {
  try {
    return (globalThis as { localStorage?: KeyStorage }).localStorage ?? undefined;
  } catch {
    return undefined;
  }
}

const NO_STORAGE = `this browser did not offer local storage, so the key cannot be remembered here — it will be used for this page and forgotten on reload`;

/** How a browser's own complaint is repeated: its words, never the value it refused to hold. */
function said(slot: string, verb: string, error: unknown): string {
  const words = error instanceof Error ? error.message : String(error);
  return `this browser would not ${verb} "${slot}": ${words}`;
}

/**
 * The key store over one browser's storage — or over nothing, when the browser
 * would not offer any. A store with no storage answers honestly every time
 * rather than pretending to remember.
 */
export function keyStore(storage: KeyStorage | undefined = ambientStorage()): KeyStore {
  return {
    read(): string | undefined {
      if (storage === undefined) return undefined;
      try {
        return keyOffered(storage.getItem(KEY_SLOT));
      } catch {
        return undefined; // a browser that will not answer holds nothing, as far as this page is concerned
      }
    },
    write(raw: string): Refusal {
      const key = keyOffered(raw);
      if (storage === undefined) return NO_STORAGE;
      if (key === undefined) return this.clear();
      try {
        storage.setItem(KEY_SLOT, key);
        return undefined;
      } catch (error) {
        return said(KEY_SLOT, 'keep', error);
      }
    },
    clear(): Refusal {
      if (storage === undefined) return undefined; // nothing was kept, so nothing is left — the control did what it promised
      try {
        storage.removeItem(KEY_SLOT);
        return undefined;
      } catch (error) {
        return said(KEY_SLOT, 'clear', error);
      }
    },
    remembers(): boolean {
      if (storage === undefined) return false;
      // WHY a probe and not a read: Safari's private window offers a storage
      // object that reads fine and throws on the first write. The only honest
      // answer comes from writing something and taking it away again.
      const probe = `${KEY_SLOT}:probe`;
      try {
        storage.setItem(probe, '1');
        storage.removeItem(probe);
        return true;
      } catch {
        return false;
      }
    },
  };
}
