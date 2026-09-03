/**
 * THE ANALYST PANEL — the agent as a principal on the same dashboard.
 *
 * A chat whose every reply is read against the commit log: under each
 * answer, the acts the analyst took are listed FRAMED BY THE GRAMMAR — the
 * verb first (select, filter, analyze, bookmark, …), then what it touched,
 * then how it ended (landed / refused / read). The framing is derived from
 * the tool call itself, never from the model's prose, so a reply that claims
 * an act it did not take is visible as such.
 */
import { ProseText } from 'vizfootprint-ui';
import { useEffect, useState } from 'react';

export interface ActivityStep {
  readonly tool: string;
  readonly args: Record<string, unknown>;
  readonly result: unknown;
}
export interface TranscriptLine {
  readonly role: 'user' | 'analyst' | 'error';
  readonly text: string;
  readonly activity?: readonly ActivityStep[];
  readonly context?: string;
  readonly refs?: readonly TranscriptRef[];
  /** What was lost reading this reply, in plain words — shown under it, because a silent drop is not honest about what the analyst cited. */
  readonly note?: string;
}
export interface AnalystWire {
  readonly mode: 'mock' | 'live';
  readonly model?: string;
  readonly turnActive: boolean;
  readonly transcript: readonly TranscriptLine[];
  readonly suggestions: readonly string[];
  readonly tools: readonly string[];
}

/** A span of the reply tied to the record: a COMMIT to seek, or a BEAT (a tag) to go to — a bookmark lands no commit, so it is cited by its tag. */
export interface TranscriptRef {
  readonly span: readonly [number, number];
  readonly commit?: string;
  readonly bookmark?: string;
  readonly label?: string;
}

/** A reply's ref names either a commit or a bookmark (a tag). Both travel onto a note — a bookmark lands no commit, so filtering to commits used to lose every bookmark citation. */
export type KeptRef = TranscriptRef;

export interface FramedAct {
  readonly verb: string;
  readonly what: string;
  readonly outcome: 'landed' | 'refused' | 'read';
}

const str = (v: unknown): string => (typeof v === 'string' ? v : JSON.stringify(v));

/** One act, framed by the grammar: the verb, what it touched, how it ended. */
export function frameStep(step: ActivityStep): FramedAct {
  const a = step.args;
  const r = step.result as { ok?: unknown; error?: unknown; gap?: unknown } | null;
  const refused = r !== null && typeof r === 'object' && (r.ok === false || r.error !== undefined || r.gap !== undefined);
  const outcome = refused ? 'refused' : 'landed';
  switch (step.tool) {
    case 'whats_here':
      return { verb: 'orient', what: 'read the declaration — views, encodings, columns, selections, analyses, ledger, gaps, paths', outcome: refused ? 'refused' : 'read' };
    case 'dispatch': {
      const where = `${str(a['viewId'])} · ${str(a['field'] ?? a['channel'] ?? '')}`;
      const how = a['value'] !== undefined ? ` = ${str(a['value'])}` : Array.isArray(a['range']) ? ` in [${(a['range'] as unknown[]).map(str).join(', ')}]` : a['range'] === null ? ' cleared' : '';
      return { verb: str(a['verb']), what: `${where}${how}${typeof a['intent'] === 'string' ? ` — "${a['intent']}"` : ''}`, outcome };
    }
    case 'declare_analysis':
      return { verb: 'analyze', what: str(a['analysisId']), outcome };
    case 'bookmark':
      return { verb: 'bookmark', what: `"${str(a['label'])}"`, outcome };
    case 'fork':
      return { verb: 'fork', what: str(a['commitId'] ?? 'from the cursor'), outcome };
    case 'propose_chart':
      return { verb: 'propose', what: str(a['id']), outcome };
    case 'why':
      return { verb: 'why', what: str(a['target']), outcome: refused ? 'refused' : 'read' };
    case 'compare':
      return { verb: 'compare', what: `${str(a['a'])} vs ${str(a['b'])}`, outcome: refused ? 'refused' : 'read' };
    case 'paths':
      return { verb: 'paths', what: str(a['action'] ?? 'list'), outcome: refused ? 'refused' : a['action'] === undefined || a['action'] === 'list' ? 'read' : 'landed' };
    default:
      return { verb: step.tool, what: JSON.stringify(a), outcome };
  }
}

const OUTCOME_COLOR: Record<FramedAct['outcome'], string> = { landed: '#2f7d5b', refused: '#a83a3a', read: '#5f6f83' };

async function fetchJson<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, init);
  const body = (await res.json()) as T & { error?: string };
  if (!res.ok) throw new Error(body.error ?? `${url} answered ${String(res.status)}`);
  return body;
}

export function AnalystPanel(props: {
  readonly readOnly: boolean;
  readonly onTurn: (turns: number) => void;
  /** What the person sees on screen — shown in the composer as what rides with the next message (the server attaches the record's own view). */
  readonly onScreen?: { readonly selections: readonly string[]; readonly cursor: string | null };
  /** Words for a ref's anchor, by commit id. */
  readonly describeCommit?: (commitId: string) => string | undefined;
  /** Go to the commit a ref points at. */
  readonly onSeek?: (commitId: string) => void;
  /** Go to the bookmark (tag) a ref points at, by its ID — how a cited bookmark travels. */
  readonly onBookmark?: (beatId: string) => void;
  /** Put a reply on the dashboard as a note — its words and its refs travel, commits and bookmarks alike; absent = the door is closed (present mode). */
  readonly onAddToDashboard?: (line: { readonly text: string; readonly refs?: readonly KeptRef[] }, model?: string) => void;
}): JSX.Element {
  const [wire, setWire] = useState<AnalystWire | null>(null);
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);

  const load = async (): Promise<void> => {
    const w = await fetchJson<AnalystWire>('/api/analyst');
    setWire(w);
    props.onTurn(w.transcript.filter((l) => l.role === 'analyst').length);
  };
  useEffect(() => {
    void load().catch((e: unknown) => setProblem(e instanceof Error ? e.message : String(e)));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const send = async (message: string): Promise<void> => {
    const m = message.trim();
    if (m === '' || sending) return;
    setSending(true);
    setProblem(null);
    setText('');
    try {
      await fetchJson('/api/chat', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ message: m }) });
    } catch (e: unknown) {
      setProblem(e instanceof Error ? e.message : String(e));
    } finally {
      setSending(false);
      await load().catch(() => undefined);
    }
  };

  const busy = sending || (wire?.turnActive ?? false);
  const disabled = props.readOnly || busy;
  return (
    <div style={{ fontSize: 13, lineHeight: 1.5, display: 'flex', flexDirection: 'column', gap: 10 }}>
      <p style={{ margin: 0 }}>
        The analyst drives this dashboard through the same verbs you do, and never computes a number itself — every statistic is a declared analysis the session runs; every act lands
        as an <b>agent</b>-badged commit. Under each reply, the acts it took are framed by the grammar — read them against the commit log.
        {wire ? (
          <span style={{ marginLeft: 8, fontSize: 11, textTransform: 'uppercase', letterSpacing: '.06em', opacity: 0.7 }}>
            {wire.mode === 'live' ? `live · ${wire.model ?? 'anthropic'}` : 'mock · scripted turn (no key)'}
          </span>
        ) : null}
      </p>
      {wire && wire.transcript.length === 0 ? (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
          {wire.suggestions.map((s) => (
            <button key={s} type="button" disabled={disabled} onClick={() => void send(s)} style={{ font: 'inherit', fontSize: 12, padding: '4px 10px', borderRadius: 999 }}>
              {s}
            </button>
          ))}
        </div>
      ) : null}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, maxHeight: '45vh', overflowY: 'auto' }}>
        {(wire?.transcript ?? []).map((line, i) => (
          <div key={String(i)} style={{ alignSelf: line.role === 'user' ? 'flex-end' : 'flex-start', maxWidth: '85%' }}>
            <div
              style={{
                padding: '6px 10px',
                borderRadius: 10,
                background: line.role === 'user' ? 'rgba(76,110,245,.12)' : line.role === 'error' ? 'rgba(168,58,58,.10)' : 'rgba(0,0,0,.05)',
                whiteSpace: 'pre-wrap',
              }}
            >
              <span style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: '.06em', opacity: 0.6 }}>{line.role === 'user' ? 'you' : line.role === 'error' ? 'the turn failed' : 'analyst'}</span>
              {/* every analyst reply goes through the same renderer — one with links and one without read the same, and the light marks the model writes (**bold**, `code`) are formatting, not characters */}
              <div>{line.role === 'analyst' ? <ProseText markdown text={line.text} refs={line.refs ?? []} describeCommit={props.describeCommit} onSeek={props.onSeek} onBookmark={props.onBookmark} /> : line.text}</div>
              {line.role === 'analyst' && line.note !== undefined ? (
                <div style={{ marginTop: 4, fontSize: 11, opacity: 0.65 }} title="what the door could not verify in this reply">
                  {line.note}
                </div>
              ) : null}
              {line.role === 'analyst' && props.onAddToDashboard !== undefined ? (
                <button type="button" onClick={() => props.onAddToDashboard?.({ text: line.text, refs: line.refs ?? [] }, wire?.model)} style={{ marginTop: 6, font: 'inherit', fontSize: 11.5, padding: '2px 8px', borderRadius: 6, border: '1px solid #d8dee4', background: '#fff', cursor: 'pointer' }} title="Keep this reply on the dashboard as a note — its links travel with it">
                  + Add to dashboard
                </button>
              ) : null}
              {line.role === 'user' && line.context ? (
                <div style={{ marginTop: 4, fontSize: 11, opacity: 0.6, whiteSpace: 'pre-wrap' }} title="what rode with this message, from the record">
                  {line.context.split('\n').slice(1).join('\n')}
                </div>
              ) : null}
            </div>
            {line.activity && line.activity.length > 0 ? (
              <ol style={{ margin: '4px 0 0', paddingLeft: 18, fontSize: 12 }} aria-label="acts this turn, framed by the grammar">
                {line.activity.map((step, j) => {
                  const f = frameStep(step);
                  return (
                    <li key={String(j)}>
                      <code>{f.verb}</code> · {f.what} ·{' '}
                      <span style={{ color: OUTCOME_COLOR[f.outcome], fontWeight: 600 }}>{f.outcome}</span>
                    </li>
                  );
                })}
              </ol>
            ) : null}
          </div>
        ))}
        {busy ? <div style={{ opacity: 0.7 }}>the analyst is working — acts land in the log as they happen…</div> : null}
      </div>
      {problem === null ? null : (
        <div role="alert" style={{ color: '#a83a3a' }}>
          ⚠ {problem}
        </div>
      )}
      {(wire?.transcript.length ?? 0) > 0 ? (
        <div style={{ display: 'flex', justifyContent: 'flex-end', margin: '4px 0' }}>
          <button
            type="button"
            disabled={busy || props.readOnly}
            title="the analyst forgets this conversation; every commit it landed stays in the log"
            onClick={() => {
              void (async () => {
                try {
                  const w = await fetchJson<AnalystWire>('/api/analyst', { method: 'DELETE' });
                  setWire(w);
                  setProblem(null);
                  props.onTurn(0);
                } catch (e) {
                  setProblem(e instanceof Error ? e.message : String(e));
                }
              })();
            }}
            style={{ font: 'inherit', fontSize: 12, padding: '2px 8px', cursor: 'pointer' }}
          >
            clear chat
          </button>
        </div>
      ) : null}
      {props.onScreen !== undefined ? (
        <div style={{ fontSize: 11.5, opacity: 0.75, margin: '6px 0 2px' }} aria-label="on screen now" title="the record's own view of the screen rides with your next message">
          On screen now: {props.onScreen.selections.length > 0 ? props.onScreen.selections.join(' · ') : 'no selection'}
          {props.onScreen.cursor !== null ? ` · at #${props.onScreen.cursor}` : ''}
        </div>
      ) : null}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          void send(text);
        }}
        style={{ display: 'flex', gap: 6 }}
      >
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder={props.readOnly ? 'return to Explore mode to ask' : 'ask the analyst — e.g. "which region has the most pertussis this year? save it as a bookmark"'}
          disabled={disabled}
          aria-label="message to the analyst"
          style={{ flex: 1, padding: '6px 8px', font: 'inherit' }}
        />
        <button type="submit" disabled={disabled || text.trim() === ''} style={{ font: 'inherit', padding: '6px 12px' }}>
          Send
        </button>
      </form>
    </div>
  );
}
