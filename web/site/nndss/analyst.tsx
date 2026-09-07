/**
 * THE ANALYST ON THE PUBLISHED PAGE — the visitor's own key, the visitor's own
 * browser, and otherwise the same analyst the served desk runs.
 *
 * The served cockpit posts to `/api/chat` and a process answers. Here there is
 * no process, so this component holds the desk itself (`createBrowserDesk`) and
 * hands the panel a host that runs the turn in the tab. Everything else — the
 * fixed tool surface, the acts landing as agent-badged commits on the session
 * the charts are drawn from, the reply read against the log — is the same code.
 *
 * THE KEY'S WHOLE LIFE IS IN THIS FILE:
 *   read   — `store.read()` once, on mount, out of this browser's local storage
 *   used   — handed to `createBrowserDesk`, which hands it to the provider
 *   kept   — `store.write()` when the person presses the button, and only then
 *   gone   — `store.clear()` from the visible control, and the desk becomes the
 *            scripted one again in the same gesture
 * It is never logged, never put in a URL, and never sent anywhere but Anthropic.
 *
 * A new key is a NEW CONVERSATION: the panel is remounted (`key={generation}`),
 * because a chat that began on the scripted turn is not one a live model should
 * be handed as its own. The commit log is untouched — a chat is not the record.
 */
import { useMemo, useState } from 'react';
import { chipWords } from 'vizfootprint-ui';
import type { DeskProjection } from 'vizfootprint-studio/desk';
import { createBrowserDesk } from '../../../src/nndss/browserDesk.js';
import { keyStore } from '../../../src/nndss/key.js';
import type { NndssSurface } from '../../../src/nndss/session.js';
import { AnalystPanel, type AnalystHost } from '../../src/AnalystPanel.js';
import { KeyGate } from '../../src/KeyGate.js';

export function BrowserAnalyst({ surface, desk }: { readonly surface: NndssSurface; readonly desk: DeskProjection }): JSX.Element {
  const [store] = useState(() => keyStore());
  const [key, setKey] = useState<string | undefined>(() => store.read());
  // asked ONCE: `remembers()` writes a probe and takes it away again, and a
  // page that probed the visitor's storage on every render would be answering
  // a question nobody asked over and over
  const [remembers] = useState(() => store.remembers());
  const [problem, setProblem] = useState<string | undefined>(undefined);
  // a fresh number per driver change — React remounts the panel, and the new
  // desk's empty conversation is what the person sees
  const [generation, setGeneration] = useState(0);

  const analyst = useMemo(() => createBrowserDesk(surface, key), [surface, key]);
  const host = useMemo<AnalystHost>(
    () => ({
      load: () => Promise.resolve(analyst.wire()),
      send: (message) => analyst.send(message).then(() => undefined),
      clear: () => Promise.resolve(analyst.forget()),
    }),
    [analyst],
  );

  const use = (typed: string): void => {
    setProblem(store.write(typed)); // the browser's own refusal, or nothing
    setKey(typed);
    setGeneration((n) => n + 1);
  };
  const forget = (): void => {
    setProblem(store.clear());
    setKey(undefined);
    setGeneration((n) => n + 1);
  };

  return (
    <AnalystPanel
      key={generation}
      host={host}
      readOnly={desk.readOnly}
      beside={<KeyGate mode={key === undefined ? 'mock' : 'live'} model={analyst.wire().model} held={key !== undefined} remembers={remembers} problem={problem} onUse={use} onClear={forget} />}
      onTurn={() => void desk.view.refresh()}
      onScreen={{ selections: desk.state.selections.map((sel) => `${desk.label(sel.viewId)}: ${chipWords(sel)}`), cursor: desk.state.cursor }}
      describeCommit={desk.describeCommit}
      onSeek={(id) => void desk.view.seek(id)}
      onBookmark={desk.seekBookmark}
    />
  );
}
