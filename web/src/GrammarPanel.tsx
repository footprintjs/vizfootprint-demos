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
import type { ColumnView, ViewView } from 'vizfootprint-ui';

export interface GrammarWire {
  readonly verbs: readonly string[];
  readonly encodings: readonly { readonly viewId: string; readonly chartKind: string; readonly channels: readonly string[]; readonly initial?: Readonly<Record<string, string>> }[];
  readonly links: string;
  readonly linksMeaning: string;
}

/** How a person produces each verb in THIS cockpit — the gesture side of the grammar. */
const GESTURE: Record<string, string> = {
  select: 'click a bar, a row, or a state on the map',
  filter: 'drag across an axis',
  reencode: 'click an axis label and pick a column',
  checkpoint: 'press ⚑ and name the position',
  fork: 'act while viewing the past',
  analyze: 'ask the analyst — it runs a declared analysis',
  annotate: 'no gesture in this build (a declared verb, unwired here)',
  navigate: 'switch the layout (Flow / Grid / Focus)',
};

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
}): JSX.Element {
  const { grammar, views, encodings, columns } = props;
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
              const now = encodings[v.viewId] ?? {};
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
                          </span>
                        ))
                      : <span style={{ opacity: 0.5 }}>no encoding surface — cannot be re-encoded (by declaration)</span>}
                  </td>
                  <td style={{ padding: 4 }}>{drivesOf(grammar.links, v.actor)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <p style={{ margin: '10px 0 0' }}>
        <b>Wiring:</b> <code>{grammar.links}</code> — {grammar.linksMeaning}.
      </p>
      {absence ? (
        <p style={{ margin: '6px 0 0' }}>
          <b>Absence:</b> column <code>{absence.field}</code> speaks {absence.absence!.map((w) => <code key={w} style={{ marginRight: 4 }}>{w}</code>)} — a kind of silence, refused on every magnitude channel.
        </p>
      ) : null}
    </div>
  );
}
