/**
 * THE GRAMMAR PANEL — the interaction grammar, rendered from the declaration.
 *
 * The verbs come off the wire from the library's own list, each view's
 * channel vocabulary from the def, the current bindings from the session's
 * fold, and the wiring rule from the one word the server sends — the
 * `drives` column is derived from that word. The ONE authored thing here is
 * the gesture column: how THIS cockpit produces each verb (and which verbs
 * it does not). When declared links land, `drives` becomes a matrix.
 *
 * The same data the agent reads through `whats_here` — one grammar, two readers.
 */
import type { ColumnView, LinkEdit, LinkGraphView, RuleLineView, ViewView } from 'vizfootprint-ui';
import { LinkMatrix } from 'vizfootprint-ui/links';
import { NNDSS_GESTURES } from '../../src/nndss/cards.js';

export interface GrammarWire {
  readonly verbs: readonly string[];
  readonly encodings: readonly { readonly viewId: string; readonly chartKind: string; readonly channels: readonly string[]; readonly initial?: Readonly<Record<string, string>> }[];
  readonly links: string;
  readonly linksMeaning: string;
}

/**
 * How a person produces each verb in THIS cockpit — the gesture side of the
 * grammar, and the ONE hand-written thing on this panel.
 *
 * The table itself lives in `src/nndss/cards.ts`, because the demo's feature
 * card needs the same answer and two hand-written copies of an underivable fact
 * are two facts. `gesture: null` there is a verb this build declares and wires
 * nothing to; the sentence for it is this panel's phrasing of that null.
 */
const UNWIRED = 'no gesture in this build (a declared verb, unwired here)';
const GESTURE: Readonly<Record<string, string>> = Object.fromEntries(NNDSS_GESTURES.map((note) => [note.verb, note.gesture ?? UNWIRED]));

/** What a view's selection drives — read off the wiring word, never hand-written per view. */
function drivesOf(links: string, actor: string): string {
  if (actor === 'agent') return '— (acts through verbs, not a selection)';
  return links === 'implicit-crossfilter' ? 'every other view (self excluded)' : `per the "${links}" wiring`;
}

export function GrammarPanel(props: {
  readonly grammar: GrammarWire | null;
  readonly views: readonly ViewView[];
  readonly encodings: Readonly<Record<string, Readonly<Record<string, string>>>>;
  readonly columns: readonly ColumnView[];
  /** Layer 4: the link graph at the cursor — rendered as the matrix; absent on an older server. */
  readonly links?: LinkGraphView;
  readonly labels?: Readonly<Record<string, string>>;
  /** Present mode: the matrix reads, never edits. */
  readonly readOnly?: boolean;
  /** Layer 4: an edit in the matrix — the host lands it as a `link` commit. */
  readonly onLink?: (edge: LinkEdit) => void;
  /** The encoding plane: the house rules as sentences (built-in first) and the policy — absent on an older server. */
  readonly rules?: readonly RuleLineView[];
  readonly policy?: { readonly onInvalid: string; readonly ruleScope: 'view' | 'dashboard' };
}): JSX.Element {
  const { grammar, views, encodings, columns, links, labels, readOnly, onLink, rules, policy } = props;
  if (grammar === null) return <div style={{ opacity: 0.7 }}>the grammar has not arrived yet</div>;
  const declared = new Map(grammar.encodings.map((e) => [e.viewId, e]));
  const absence = columns.find((c) => c.absence !== undefined);
  return (
    <div style={{ fontSize: 13, lineHeight: 1.5 }}>
      <p style={{ margin: '0 0 8px' }}>
        <b>Verbs</b> — every interaction is one of these, and every one lands as a commit with a cause:
      </p>
      <table style={{ borderCollapse: 'collapse', width: '100%', marginBottom: 12 }}>
        <tbody>
          {grammar.verbs.map((v) => (
            <tr key={v}>
              <td style={{ padding: '2px 8px 2px 0' }}>
                <code>{v}</code>
              </td>
              <td style={{ padding: '2px 0', opacity: 0.85 }}>{GESTURE[v] ?? '—'}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <p style={{ margin: '0 0 6px' }}>
        <b>Views</b> — who drives each, what it emits, which channels it may rebind, and what it drives:
      </p>
      <div style={{ overflowX: 'auto' }}>
        <table style={{ borderCollapse: 'collapse', width: '100%', minWidth: 520 }}>
          <thead>
            <tr style={{ textAlign: 'left', fontSize: 11, textTransform: 'uppercase', letterSpacing: '.05em', opacity: 0.7 }}>
              <th style={{ padding: '4px 8px 4px 0' }}>view</th>
              <th style={{ padding: 4 }}>driver</th>
              <th style={{ padding: 4 }}>emits</th>
              <th style={{ padding: 4 }}>channels → bound now</th>
              <th style={{ padding: 4 }}>drives</th>
            </tr>
          </thead>
          <tbody>
            {views.map((v) => {
              const d = declared.get(v.viewId);
              const own = encodings[v.viewId] ?? {};
              const eff = v.effective; // encoding links: what the view shows, which channels follow, which follows were refused
              const now = eff?.bindings ?? own;
              return (
                <tr key={v.viewId} style={{ borderTop: '1px solid rgba(0,0,0,.08)' }}>
                  <td style={{ padding: '4px 8px 4px 0' }}>
                    <b>{v.viewId}</b>
                    {d ? <span style={{ opacity: 0.6 }}> ({d.chartKind})</span> : null}
                  </td>
                  <td style={{ padding: 4 }}>{v.actor}</td>
                  <td style={{ padding: 4 }}>{v.selectionKinds.join(', ') || '—'}</td>
                  <td style={{ padding: 4 }}>
                    {d
                      ? d.channels.map((ch) => (
                          <span key={ch} style={{ marginRight: 8 }}>
                            <code>{ch}</code>
                            {now[ch] !== undefined ? <span style={{ opacity: 0.7 }}> → {now[ch]}</span> : <span style={{ opacity: 0.4 }}> → (unbound)</span>}
                            {eff?.followed[ch] !== undefined && own[ch] !== undefined && own[ch] !== now[ch] ? <span style={{ opacity: 0.5 }} title="the view's own binding, shadowed by the follow"> (own: {own[ch]})</span> : null}
                            {eff?.followed[ch] !== undefined ? (
                              <span style={{ color: '#0e6f69' }} title={`follows ${eff.followed[ch]!.from}.${eff.followed[ch]!.sourceChannel} through edge ${eff.followed[ch]!.edge}`}>
                                {' '}⇠ follows {eff.followed[ch]!.from}
                              </span>
                            ) : null}
                            {eff?.refused[ch] !== undefined ? (
                              <span style={{ color: '#a8661a' }} title={eff.refused[ch]!.sentence}>
                                {' '}⇠ refused to follow "{eff.refused[ch]!.field}"
                              </span>
                            ) : null}
                            {v.fits?.[ch] !== undefined ? (
                              <span style={{ opacity: 0.5 }} title={v.fits[ch]!.filter((f) => !f.ok).map((f) => `${f.field}: ${f.because}`).join('\n')}>
                                {' '}({v.fits[ch]!.filter((f) => f.ok).length} of {v.fits[ch]!.length} columns fit)
                              </span>
                            ) : null}
                          </span>
                        ))
                      : <span style={{ opacity: 0.5 }}>no encoding surface — cannot be re-encoded (by declaration)</span>}
                  </td>
                  <td style={{ padding: 4 }}>{links ? links.edges.filter((e) => e.source === v.viewId && e.response !== 'none').map((e) => `${e.target} (${e.response})`).filter((x, i, a) => a.indexOf(x) === i).join(', ') || '—' : drivesOf(grammar.links, v.actor)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <p style={{ margin: '10px 0 0' }}>
        <b>Wiring:</b> <code>{grammar.links}</code> — {grammar.linksMeaning}.
      </p>
      {links ? (
        <div style={{ marginTop: 10 }}>
          <p style={{ margin: '0 0 6px' }}>
            <b>The links, as declared — and editable</b> — rows are a source view and what it emits, columns are targets, a cell is what the target does with it. The default rule is written out; a declared edge is what someone chose; an edit made here is a commit like any act (undo it from the log); <i>none</i> is off on purpose; a blank cell would be silence.
          </p>
          <LinkMatrix graph={links} labels={labels} readOnly={readOnly} onChange={onLink} />
        </div>
      ) : null}
      {views.some((v) => (v.prose ?? []).length > 0) ? (
        <div style={{ marginTop: 10 }}>
          <p style={{ margin: '0 0 4px' }}>
            <b>Words (the prose plane)</b> — every title, caption and alt text is a record with an author; a caption whose basis no longer matches the screen is shown as stale, never hidden or rewritten; a derived line is written by the library from the chart's bindings, every read.
          </p>
          <ul style={{ margin: 0, paddingLeft: 18 }}>
            {views.flatMap((v) =>
              (v.prose ?? []).map((p) => (
                <li key={`${v.viewId}:${p.slot}`}>
                  <b>{v.viewId}</b>.<code>{p.slot}</code> — {p.text}{' '}
                  <span style={{ opacity: 0.6, fontSize: 11 }}>
                    {p.status === 'stale' ? `stale (${p.changed.join(', ')} moved)` : p.status} · {p.author.kind}
                    {p.author.by ? ` · ${p.author.by}` : ''}
                    {p.author.model ? ` · ${p.author.model}` : ''}
                  </span>
                </li>
              )),
            )}
          </ul>
        </div>
      ) : null}
      {rules !== undefined ? (
        <div style={{ marginTop: 10 }}>
          <p style={{ margin: '0 0 4px' }}>
            <b>House rules (the encoding plane)</b> — which column may sit on which channel, stated as data. The same sentence refuses a bad initial binding at build, a bad rebind at dispatch (yours or the analyst's), and greys the picker.
            {policy ? (
              <span style={{ opacity: 0.7 }}>
                {' '}A misfit is <code>{policy.onInvalid === 'refuse' ? 'refused' : `coerced by ${policy.onInvalid}`}</code>; a two-column rule reaches the <code>{policy.ruleScope}</code>.
              </span>
            ) : null}
          </p>
          <ul style={{ margin: 0, paddingLeft: 18 }}>
            {rules.map((r) => (
              <li key={r.id}>
                {r.sentence} <span style={{ opacity: 0.5, fontSize: 11 }}>{r.builtIn ? 'built in' : r.id}</span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
      {absence ? (
        <p style={{ margin: '6px 0 0' }}>
          <b>Absence:</b> column <code>{absence.field}</code> speaks {absence.absence!.map((w) => <code key={w} style={{ marginRight: 4 }}>{w}</code>)} — a kind of silence, refused on every magnitude channel.
        </p>
      ) : null}
    </div>
  );
}
