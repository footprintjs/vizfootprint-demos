import { epochLocations, receiptAt } from 'agentfootprint';
import { servedRowForEpoch, verify } from 'agentfootprint-lens/core';
import { beforeAll, describe, expect, it } from 'vitest';
import { createNndssAnalyst, scriptedNndssMock, type ActivityStep, type TurnResult } from '../src/nndss/analyst.js';
import { buildNndssSurface } from '../src/nndss/surface.js';
import { analystWire, forgetConversation, runTurn, type DrivenDesk } from '../src/nndss/turn.js';

/**
 * WHAT THE MODEL WAS SERVED. The analyst keeps a recording of every turn —
 * what `recordRun` froze, detached — and the agent commits a receipt per LLM
 * call (agentfootprint 9.88+). The Why Lens's Served tab reads the receipt
 * against the request it rebuilds from the log; `verify` is that reading, and
 * on a scripted turn every hashed row must come back Verified. The dial off
 * keeps nothing, and the reply is the same bytes either way: a recording is a
 * reader's copy, never a hand on the run.
 */
const ASK = 'Focus on pertussis by area and save the moment.';
/** The scripted turn asks the model five times: four tool calls, then the reply. */
const CALLS = 5;

describe('what the model was served — one recording per turn, one receipt per call', () => {
  let on: TurnResult;
  beforeAll(async () => {
    const { port } = buildNndssSurface();
    const analyst = createNndssAnalyst(port, { provider: scriptedNndssMock() });
    expect(analyst.keepsRecording).toBe(true);
    on = await analyst.send(ASK);
    expect(analyst.recording()).toBe(on.recording);
  });

  it('keeps a detached recording of the turn, with a receipt for every epoch', () => {
    expect(on.recordingLost).toBeUndefined();
    expect(on.recording).toBeDefined();
    const { snapshot } = on.recording!;
    const epochs = epochLocations(snapshot);
    expect(epochs.map((e) => e.epoch)).toEqual(Array.from({ length: CALLS }, (_, i) => i + 1));
    for (const { epoch } of epochs) {
      const receipt = receiptAt(snapshot, epoch);
      expect(receipt).toBeDefined();
      expect(receipt!.basis.epoch).toBe(epoch);
    }
    // detached: the library's own detach is text, and what came back is plain data — it clones without a complaint
    expect(() => structuredClone(on.recording)).not.toThrow();
  });

  it('verify reads every hashed row Verified on every epoch of the turn', () => {
    // the served reading takes the run's SNAPSHOT — the log the receipts were committed into — the way the lens's own fixtures hand it over
    const { snapshot } = on.recording!;
    for (const { epoch } of epochLocations(snapshot)) {
      const row = servedRowForEpoch(snapshot, epoch);
      expect(row, `epoch ${String(epoch)}`).toBeDefined();
      expect(row!.receipt, `epoch ${String(epoch)} carries a receipt`).toBeDefined();
      const checks = verify(row!.view, row!.receipt, row!.receipt!.basis.runId);
      expect(checks.basis).toBe('on-receipt');
      expect(checks.system.status).toBe('verified');
      expect(checks.pieces.map((p) => p.status)).toEqual(checks.pieces.map(() => 'verified'));
      expect(checks.messages.length).toBeGreaterThan(0);
      expect(checks.messages.map((m) => m.status)).toEqual(checks.messages.map(() => 'verified'));
      // names carry no hash, so the library never calls them verified — it hands the receipt's list back as data (the lens's own law, asserted in its tests the same way)
      expect(checks.toolNames.status).toBe('reconstructed');
      expect(checks.namesOnReceipt).toEqual(row!.receipt!.tools.names);
      const schemas = Object.entries(checks.toolSchemas);
      expect(schemas.length).toBe(9); // the fixed tool surface, every schema hashed
      expect(schemas.map(([, s]) => s.status)).toEqual(schemas.map(() => 'verified'));
      expect(checks.onReceiptOnly.schemas).toEqual([]);
      expect(checks.rebuiltOnly.schemas).toEqual([]);
      expect(checks.damaged).toBe(false);
    }
  });

  it('the dial off keeps no recording — and the reply is the same bytes', async () => {
    const { port } = buildNndssSurface();
    const analyst = createNndssAnalyst(port, { provider: scriptedNndssMock(), keepRecording: false });
    expect(analyst.keepsRecording).toBe(false);
    const off = await analyst.send(ASK);
    expect(off.recording).toBeUndefined();
    expect(off.recordingLost).toBeUndefined();
    expect(analyst.recording()).toBeUndefined();
    expect(off.text).toBe(on.text);
    expect(off.correlationId).toBe(on.correlationId);
  });

  it('a desk keeps one recording per turn, says so on the line, keeps it off the wire, and forgets it with the chat', async () => {
    const { session, port } = buildNndssSurface();
    const activity: ActivityStep[] = [];
    const desk: DrivenDesk = {
      analyst: createNndssAnalyst(port, { provider: scriptedNndssMock(), onActivity: (s) => activity.push(s) }),
      mode: 'mock',
      activity,
      recordings: new Map(),
      transcript: [],
      turnActive: false,
    };
    const out = await runTurn(desk, session, ASK);
    expect(out.ok).toBe(true);
    const line = desk.transcript.find((l) => l.role === 'analyst');
    expect(line?.correlationId).toBe('turn-1');
    expect(line?.recording).toEqual({ kind: 'kept' });
    expect([...desk.recordings!.keys()]).toEqual(['turn-1']);
    expect(epochLocations(desk.recordings!.get('turn-1')!.snapshot).length).toBe(CALLS);
    // the wire says a recording was kept and carries none of it — a turn's whole log is read when asked, never on every poll
    const wire = JSON.stringify(analystWire(desk));
    expect(wire).toContain('"recording":{"kind":"kept"}');
    expect(wire).not.toContain('commitLog');
    forgetConversation(desk);
    expect(desk.recordings!.size).toBe(0);
    expect(desk.analyst.recording()).toBeUndefined();
  });
});
