/// <reference lib="webworker" />
// Runs the simulation engines off the main thread so the UI never freezes.
import { evaluatePlacement, optimise, prepare, type Engine } from './core';
import type { FromWorker, ToWorker } from './protocol';

declare const self: DedicatedWorkerGlobalScope;

let E: Engine | null = null;
const cancelled = new Set<number>();
const post = (m: FromWorker) => self.postMessage(m);
const tick = () => new Promise<void>((r) => setTimeout(r, 0));

self.onmessage = async (ev: MessageEvent<ToWorker>) => {
  const msg = ev.data;
  try {
    if (msg.type === 'init') {
      E = prepare(msg.input);
      post({ type: 'ready' });
      return;
    }
    if (msg.type === 'cancel') {
      cancelled.add(msg.id);
      return;
    }
    if (!E) throw new Error('Engine not initialised');
    if (msg.type === 'place') {
      post({ type: 'placeResult', id: msg.id, result: evaluatePlacement(E, msg.params) });
      return;
    }
    if (msg.type === 'optimise') {
      const t0 = performance.now();
      const it = optimise(E, msg.params);
      let step = 0;
      for (;;) {
        // Yield between sites so a cancel message can arrive.
        await tick();
        if (cancelled.has(msg.id)) {
          cancelled.delete(msg.id);
          post({ type: 'cancelled', id: msg.id });
          return;
        }
        const r = it.next();
        if (r.done) {
          post({ type: 'optimiseResult', id: msg.id, result: r.value, ms: performance.now() - t0 });
          return;
        }
        step += 1;
        post({ type: 'progress', id: msg.id, step, total: msg.params.n, pick: r.value });
      }
    }
  } catch (e) {
    post({ type: 'error', id: 'id' in msg ? msg.id : null, message: e instanceof Error ? e.message : String(e) });
  }
};
