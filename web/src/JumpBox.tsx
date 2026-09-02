/**
 * THE JUMP BOX — "go to #34" when the timeline has ninety commits.
 *
 * Every commit on this surface has an id `s<n>`; the box takes the number,
 * checks the commit is on the active lineage, and SEEKS — a cursor move,
 * never a rewrite. An id that is not on this lineage is refused in a
 * sentence (it may be on another path — switch paths to reach it).
 */
import { useState } from 'react';

export function JumpBox(props: { readonly commitIds: readonly string[]; readonly onSeek: (id: string) => void }): JSX.Element {
  const [text, setText] = useState('');
  const [note, setNote] = useState<string | null>(null);
  const go = (): void => {
    const n = text.trim().replace(/^#/, '').replace(/^\D+/, '');
    if (n === '' || !/^\d+$/.test(n)) {
      setNote('type a commit number, e.g. 34');
      return;
    }
    // ids are `<prefix><n>` on this surface; match by the number so the prefix is not this box's business
    const id = props.commitIds.find((c) => c.replace(/^\D+/, '') === n);
    if (id === undefined) {
      setNote(`#${n} is not on this lineage — it may be on another path`);
      return;
    }
    setNote(null);
    props.onSeek(id);
  };
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        go();
      }}
      style={{ display: 'inline-flex', alignItems: 'center', gap: 6, marginLeft: 8, fontSize: 12 }}
      title="Seek to a commit by its number (a cursor move — never a rewrite)"
    >
      <label style={{ opacity: 0.7 }}>go to #</label>
      <input value={text} onChange={(e) => setText(e.target.value)} placeholder="34" style={{ width: 52, padding: '3px 6px', font: 'inherit' }} aria-label="commit number" />
      <button type="submit" style={{ font: 'inherit', padding: '3px 8px' }}>
        seek
      </button>
      {note === null ? null : (
        <span role="status" style={{ color: '#a83a3a' }}>
          {note}
        </span>
      )}
    </form>
  );
}
