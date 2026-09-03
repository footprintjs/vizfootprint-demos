import { describe, expect, it } from 'vitest';
import { parseReply, readReply, type KnownTargets, type ParsedReply } from '../server/doors.js';
import type { ActivityStep } from '../src/nndss/analyst.js';
import { buildNndssSurface } from '../src/nndss/surface.js';
import { createNndssAnalyst, scriptedNndssMock } from '../src/nndss/analyst.js';

/**
 * READING THE REPLY HONESTLY. The analyst is asked for one JSON envelope, and
 * models write prose around it anyway — before it, after it, in a fence, or cut
 * off halfway. The door must find the envelope wherever it landed, show the
 * person the WORDS and never the machinery, say plainly what it could not read,
 * and turn the model's quotes into real spans — dropping every citation the
 * record cannot vouch for.
 */

/** One turn's acts, as the tool port really shapes them: two dispatches that landed commits, an analysis whose commit rides under `analysis`, and a bookmark — a TAG, which lands no commit and is cited by its tag id. */
const ACTS: readonly ActivityStep[] = [
  { tool: 'whats_here', args: {}, result: { ok: true } },
  { tool: 'dispatch', args: { verb: 'select', viewId: 'diseases', field: 'disease', intent: 'focus on pertussis' }, result: { ok: true, verb: 'select', intent: 'focus on pertussis', commit: { id: 's67' } } },
  { tool: 'dispatch', args: { verb: 'filter', viewId: 'weeks', field: 't' }, result: { ok: true, verb: 'filter', commit: { id: 's69' } } },
  { tool: 'declare_analysis', args: { analysisId: 'casesByArea' }, result: { ok: true, verb: 'analyze', analysis: { analysisId: 'casesByArea', commit: { id: 's70' } } } },
  { tool: 'bookmark', args: { label: 'Pertussis by region' }, result: { ok: true, verb: 'bookmark', bookmark: { id: 't1', label: 'Pertussis by region' } } },
];
const KNOWN: KnownTargets = { commits: new Set(['s67', 's68', 's69', 's70']), bookmarks: new Set(['t1']) };
const read = (raw: string): ParsedReply => parseReply(raw, KNOWN, ACTS);
/** What a ref actually points at in the words the person reads — the span cut back out of the text. */
const quoted = (r: ParsedReply): readonly string[] => r.refs.map((ref) => r.text.slice(ref.span[0], ref.span[1]));

const WORDS = 'I selected disease Pertussis, switched the area kind to region and filtered weeks to 2026-01-01 onward. South Atlantic has the highest pertussis load, a mean of 19.09 cases/week over the present cells.';
const ENVELOPE =
  `{"text": "${WORDS}", ` +
  '"refs": [{"quote": "selected disease Pertussis", "commit": "s67"}, {"quote": "switched the area kind to region", "commit": "s68"}, {"quote": "filtered weeks to 2026-01-01 onward", "commit": "s69"}, {"quote": "South Atlantic has the highest pertussis load", "act": 4}]}';

describe('parseReply — the envelope wherever the model put it', () => {
  it('the reply that broke it: prose FIRST, then a ```json fence — the words are the envelope\'s, the JSON is never shown, and all four links land', () => {
    const raw = `Selected disease **Pertussis** (diseases:point, commit s67), switched the area kind to region (s68) and filtered weeks to 2026-01-01 onward (s69). **South Atlantic** leads with a mean of **19.09 cases/week**.\n\n\`\`\`json\n${ENVELOPE}\n\`\`\``;
    const out = read(raw);
    expect(out.text).toBe(WORDS);
    expect(out.text).not.toMatch(/```|"refs"/); // no machinery on the screen
    expect(out.note).toBeUndefined();
    expect(quoted(out)).toEqual(['selected disease Pertussis', 'switched the area kind to region', 'filtered weeks to 2026-01-01 onward', 'South Atlantic has the highest pertussis load']);
    expect(out.refs.map((r) => r.commit)).toEqual(['s67', 's68', 's69', 's70']); // act 4 → the commit that act landed
    expect(out.refs[0]?.label).toBe('dispatch · select · focus on pertussis'); // the act's own framing, for the anchor
  });

  it('words AFTER the object — the shape the prompt now asks for — still show the words, never the blob', () => {
    const out = read(`${ENVELOPE}\n\nLet me know if you want more.`);
    expect(out.text).toBe(WORDS);
    expect(out.text).not.toMatch(/\{|"refs"/);
    expect(out.refs).toHaveLength(4);
  });

  it('a whole-body envelope reads as it always did, and words on BOTH sides are dropped for the envelope\'s own', () => {
    expect(read(ENVELOPE).text).toBe(WORDS);
    const both = read(`Here is what I did.\n\n${ENVELOPE}\n\nHope that helps.`);
    expect(both.text).toBe(WORDS);
    expect(both.refs).toHaveLength(4);
  });

  it('a bare trailing object is the envelope; a brace in the prose is not', () => {
    const out = read(`Here is what I did.\n\n${ENVELOPE}`);
    expect(out.text).toBe(WORDS);
    expect(out.refs).toHaveLength(4);
    const plain = read('The cells are shaped {area, disease, week} and the last one is empty.');
    expect(plain).toEqual({ text: 'The cells are shaped {area, disease, week} and the last one is empty.', refs: [] });
    const other = read('The tool answered {"ok": true} and nothing else.');
    expect(other.text).toBe('The tool answered {"ok": true} and nothing else.'); // a JSON object that is not the envelope stays in the words
  });

  it('the LAST parseable candidate wins, so a self-correction comes out right — and the reply SAYS there was more than one', () => {
    const out = read('Format: {"text": "...", "refs": []}\n\n{"text": "South Atlantic leads.", "refs": []}');
    expect(out.text).toBe('South Atlantic leads.');
    expect(out.note).toBe('the reply carried 2 envelopes; the last one was read as the answer');
    const fences = read('One moment.\n\n```json\n{"text": "a first try"}\n```\n\nActually:\n\n```json\n{"text": "the second try"}\n```');
    expect(fences.text).toBe('the second try');
    expect(fences.note).toBe('the reply carried 2 envelopes; the last one was read as the answer');
  });

  it('a field we do not know does not cost the person the reply: it is READ, and the note names what was ignored', () => {
    const out = read('{"text": "South Atlantic leads.", "refs": [{"quote": "South Atlantic", "commit": "s67"}], "confidence": 0.9}');
    expect(out.text).toBe('South Atlantic leads.'); // never the raw JSON — the owner's original bug does not come back through this door
    expect(quoted(out)).toEqual(['South Atlantic']);
    expect(out.note).toBe("the analyst's envelope carried fields I do not know: confidence; its words and links were read anyway");
    const two = read('```json\n{"text": "South Atlantic leads.", "confidence": 0.9, "model": "x"}\n```');
    expect(two.note).toBe("the analyst's envelope carried fields I do not know: confidence, model; its words and links were read anyway");
  });

  it('an EXACT envelope is preferred over a loose one wherever each sits, so neither case rests on luck', () => {
    // the loose one comes last, and still does not win
    const looseLast = read('{"text": "the exact one", "refs": []}\n\n{"text": "the loose one", "confidence": 0.9}');
    expect(looseLast.text).toBe('the exact one');
    expect(looseLast.note).toBeUndefined();
    // and the other way round: a stray key first, the exact envelope after it
    const exactLast = read('{"text": "the loose one", "confidence": 0.9}\n\n{"text": "the exact one", "refs": []}');
    expect(exactLast.text).toBe('the exact one');
    expect(exactLast.note).toBeUndefined();
  });

  it('an object that is NOT the envelope cannot replace the answer, however much it looks like one', () => {
    // this product's prose records are objects with a `text` of their own — a chart caption quoted in the words is not the reply
    const out = read('{"text": "The map caption is stale.", "refs": [{"quote": "map caption", "commit": "s67"}]}\n\nThe record reads {"text": "Cases by disease", "author": {"kind": "agent"}}.');
    expect(out.text).toBe('The map caption is stale.');
    expect(quoted(out)).toEqual(['map caption']);
    expect(out.note).toBeUndefined(); // one envelope, one answer
  });

  it('a triple backtick inside the envelope\'s OWN words does not close the fence early', () => {
    const out = read('Here:\n\n```json\n{"text": "write it as ```json and the fence closes at the start of a line", "refs": []}\n```');
    expect(out.text).toBe('write it as ```json and the fence closes at the start of a line');
    expect(out.note).toBeUndefined();
  });

  it('an envelope with no words of its own leaves the prose standing, fence and all removed', () => {
    const out = read('South Atlantic leads.\n\n```json\n{"refs": [{"quote": "South Atlantic", "commit": "s67"}]}\n```');
    expect(out.text).toBe('South Atlantic leads.');
    expect(quoted(out)).toEqual(['South Atlantic']);
    expect(read('{"text": "   ", "refs": []}').text).toBe('(the analyst replied with no words)');
  });

  it('no envelope at all: the prose exactly as written, no refs, nothing invented', () => {
    expect(read('South Atlantic leads on pertussis this year.')).toEqual({ text: 'South Atlantic leads on pertussis this year.', refs: [] });
  });
});

describe('parseReply — a reply that could not be read whole', () => {
  it('cut off at the token ceiling: the words it managed are kept, the machinery is not, and it ALWAYS says so', () => {
    const out = read('```json\n{"text": "South Atlantic leads with a mean of 19.09 cases');
    expect(out.text).toBe('South Atlantic leads with a mean of 19.09 cases'); // salvaged from the half-written "text"
    expect(out.text).not.toMatch(/```|\{/);
    expect(out.note).toBe("the analyst's reply was cut off before it finished");
    const bare = read('{"text": "half a th');
    expect(bare.text).toBe('half a th');
    expect(bare.note).toBe("the analyst's reply was cut off before it finished");
  });

  it('cut off before any words arrived: the machinery is stripped and the reason is said out loud', () => {
    const out = read('```json\n{"refs": [{"quote": "South');
    expect(out.text).toBe("(the analyst's reply was cut off before any words arrived)");
    expect(out.note).toBe("the analyst's reply was cut off before it finished");
    const withProse = read('South Atlantic leads.\n\n```json\n{"refs": [{"quote": "South');
    expect(withProse.text).toBe('South Atlantic leads.'); // the words it did write stand
    expect(withProse.note).toBe("the analyst's reply was cut off before it finished");
  });

  it('malformed but closed: the words are salvaged, the failure is named, and no stack trace goes near the person', () => {
    const out = read('South Atlantic leads.\n\n```json\n{"text": "South Atlantic leads", "refs": [oops]}\n```');
    expect(out.text).toBe('South Atlantic leads');
    expect(out.refs).toEqual([]);
    expect(out.note).toBe("the analyst's envelope could not be read as JSON, so its links were lost");
    expect(out.note).not.toMatch(/\n {4}at /);
    const nothingToSalvage = read('```json\n{"refs": [oops],}\n```');
    expect(nothingToSalvage.text).toBe("(the analyst's reply was cut off before any words arrived)");
    expect(nothingToSalvage.note).toBeDefined();
  });

  it('a half-written escape does not throw: the characters as they arrived', () => {
    const out = read('{"text": "a line\nand another');
    expect(out.text).toBe('a line\nand another');
    expect(out.note).toBeDefined();
  });
});

describe('parseReply — links the record can vouch for', () => {
  it('a quote that is not in the text is dropped — a span is never guessed', () => {
    const out = read('{"text": "South Atlantic leads.", "refs": [{"quote": "the Pacific leads", "commit": "s67"}]}');
    expect(out.refs).toEqual([]);
    expect(out.note).toBe('1 of 1 links could not be verified and was dropped');
  });

  it('a commit the log does not hold and a tag nobody named are dropped', () => {
    const out = read('{"text": "South Atlantic leads, and I named the moment.", "refs": [{"quote": "South Atlantic", "commit": "s99"}, {"quote": "named the moment", "bookmark": "t9"}, {"quote": "leads", "act": 2}]}');
    expect(quoted(out)).toEqual(['leads']);
    expect(out.note).toBe('2 of 3 links could not be verified and were dropped');
  });

  it('a CHECKPOINT is citable: the act that named it resolves to its tag, and so does the tag id itself', () => {
    const out = read('{"text": "I named this moment Pertussis by region, and the bookmark is here.", "refs": [{"quote": "named this moment", "act": 5}, {"quote": "the bookmark is here", "bookmark": "t1"}]}');
    expect(out.refs.map((r) => [r.bookmark, r.commit])).toEqual([['t1', undefined], ['t1', undefined]]);
    expect(out.refs[0]?.label).toBe('bookmark · Pertussis by region');
    expect(out.note).toBeUndefined();
  });

  it('two quotes that overlap keep the first — and that is said DIFFERENTLY from a link that did not resolve', () => {
    const out = read('{"text": "South Atlantic leads this year.", "refs": [{"quote": "South Atlantic leads", "commit": "s67"}, {"quote": "Atlantic leads this year", "commit": "s68"}, {"quote": "nowhere in the text", "commit": "s69"}]}');
    expect(quoted(out)).toEqual(['South Atlantic leads']);
    expect(out.note).toBe('1 of 3 links could not be verified and was dropped; 1 of 3 links repeated words already linked and was dropped');
  });

  it('a ref that is not a ref is dropped, and links that are not a list are said out loud', () => {
    const out = read('{"text": "South Atlantic leads.", "refs": [{"quote": "", "commit": "s67"}, {"quote": 7, "commit": "s67"}, null, {"quote": "South Atlantic", "commit": "s67"}]}');
    expect(quoted(out)).toEqual(['South Atlantic']);
    expect(out.note).toBe('3 of 4 links could not be verified and were dropped');
    expect(read('{"text": "plain words", "refs": "not a list"}')).toEqual({ text: 'plain words', refs: [], note: "the analyst's links were not a list, so none could be kept" });
  });
});

describe('parseReply — what it will not do to the words', () => {
  it('an unreadable object INSIDE a sentence stays in the sentence: words are never deleted to tidy up', () => {
    const raw = 'The row is {"text": oops, "id": 1} and South Atlantic leads.';
    expect(read(raw)).toEqual({ text: raw, refs: [] });
    const unclosed = 'The row is {"text": oops and I never closed it';
    expect(read(unclosed)).toEqual({ text: unclosed, refs: [] });
  });

  it('an empty or blank reply says it has no words, instead of showing a blank bubble', () => {
    expect(read('')).toEqual({ text: '(the analyst replied with no words)', refs: [] });
    expect(read('   \n\t ')).toEqual({ text: '(the analyst replied with no words)', refs: [] });
  });

  it('words that are not text are named as such — the failure is the WORDS, not the links', () => {
    const out = read('{"text": 42, "refs": [{"quote": "x", "commit": "s67"}]}');
    expect(out.text).toBe('(the analyst replied with no words)');
    expect(out.note).toBe("the analyst's words were not text, so none of its links could be placed");
    const withProse = read('South Atlantic leads.\n\n```json\n{"text": 42, "refs": []}\n```');
    expect(withProse.text).toBe('South Atlantic leads.');
    expect(withProse.note).toBe("the analyst's words were not text, so none of its links could be placed");
  });

  it('a long reply full of unclosed braces is read in one pass, not once per brace', () => {
    const raw = `South Atlantic leads. ${'{ '.repeat(20000)}`; // ~40KB, well inside a model's budget
    const began = performance.now();
    const out = read(raw);
    expect(performance.now() - began).toBeLessThan(300); // was ~700ms when every brace scanned to the end
    expect(out.text).toBe(raw); // and none of it is machinery: no brace here names the envelope
  });
});

describe('readReply', () => {
  it('says plainly what a reply is carrying, or that it is carrying nothing', () => {
    expect(readReply('just words')).toEqual({ kind: 'words' });
    expect(readReply('```\nnot json\n```')).toEqual({ kind: 'words' });
    expect(readReply('a list is not an envelope\n```json\n[1, 2]\n```')).toEqual({ kind: 'words' });
    expect(readReply('  {"text": "x"}  ')).toEqual({ kind: 'envelope', value: { text: 'x' }, prose: '', envelopes: 1, strays: [] });
    expect(readReply('prose\n```json\n{"text": "x"}\n```')).toEqual({ kind: 'envelope', value: { text: 'x' }, prose: 'prose', envelopes: 1, strays: [] });
    expect(readReply('The record reads {"text": "a caption", "author": "x"}.')).toEqual({ kind: 'words' }); // a shape we cannot recognise on sight, written INSIDE a sentence, is words
  });
});

describe('a real scripted turn', () => {
  it('the acts the analyst really took resolve to what they really landed — commits for the dispatches, the TAG for the bookmark', async () => {
    const { session, port } = buildNndssSurface();
    const acts: ActivityStep[] = [];
    const analyst = createNndssAnalyst(port, { provider: scriptedNndssMock(), onActivity: (s) => acts.push(s) });
    const turn = await analyst.send('Focus on pertussis by area and save the moment.');
    const known: KnownTargets = { commits: new Set(session.log.records.map((r) => r.id)), bookmarks: new Set(session.bookmarkViews().map((c) => c.id)) };
    const out = parseReply(turn.text, known, acts);
    expect(out.text.startsWith('I selected Pertussis')).toBe(true);
    expect(quoted(out)).toEqual(['selected Pertussis on the diseases view', 'ran casesByArea over the present cells', 'named this position "Pertussis by area"']);
    expect(out.refs.filter((r) => r.commit !== undefined).every((r) => session.log.records.some((rec) => rec.id === r.commit))).toBe(true);
    expect(out.refs.filter((r) => r.bookmark !== undefined).map((r) => r.bookmark)).toEqual(session.bookmarkViews().map((c) => c.id)); // the bookmark it named is citable
    expect(out.note).toBeUndefined(); // every citation the analyst offered resolved
  });
});
