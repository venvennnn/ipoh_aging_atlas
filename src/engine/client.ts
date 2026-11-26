// Main-thread handle on the engine worker. One worker per page load, initialised once.
import { loadAtlas, loadStats } from '../lib/data';
import { engineInputFrom, type OptimiseParams, type OptimiseResult, type Pick, type PlaceParams, type PlaceResult } from './core';
import type { FromWorker, ToWorker } from './protocol';

type Pending = {
  resolve: (v: unknown) => void;
  reject: (e: Error) => void;
  onProgress?: (step: number, total: number, pick: Pick) => void;
};

class EngineClient {
  private worker: Worker;
  private ready: Promise<void>;
  private nextId = 1;
  private pending = new Map<number, Pending>();
  private cancelledEarly = new Set<number>();

  constructor() {
    this.worker = new Worker(new URL('./worker.ts', import.meta.url), { type: 'module' });
    let markReady!: () => void;
    let failReady!: (e: Error) => void;
    this.ready = new Promise<void>((res, rej) => {
      markReady = res;
      failReady = rej;
    });
    this.worker.onmessage = (ev: MessageEvent<FromWorker>) => {
      const m = ev.data;
      if (m.type === 'ready') return markReady();
      if (m.type === 'error' && m.id == null) return failReady(new Error(m.message));
      const p = this.pending.get(m.id as number);
      if (!p) return;
      switch (m.type) {
        case 'progress':
          p.onProgress?.(m.step, m.total, m.pick);
          break;
        case 'placeResult':
          this.pending.delete(m.id);
          p.resolve(m.result);
          break;
        case 'optimiseResult':
          this.pending.delete(m.id);
          p.resolve(m.result);
          break;
        case 'cancelled':
          this.pending.delete(m.id);
          p.reject(new CancelledError());
          break;
        case 'error':
          this.pending.delete(m.id as number);
          p.reject(new Error(m.message));
          break;
      }
    };
    this.worker.onerror = (e) => failReady(new Error(e.message || 'Engine worker failed to start'));
    Promise.all([loadAtlas(), loadStats()]).then(
      ([atlas, stats]) => this.send({ type: 'init', input: engineInputFrom(atlas, stats.index.dun) }),
      (e: Error) => failReady(e),
    );
  }

  private send(m: ToWorker) {
    this.worker.postMessage(m);
  }

  whenReady() {
    return this.ready;
  }

  async place(params: PlaceParams): Promise<PlaceResult> {
    await this.ready;
    const id = this.nextId++;
    return new Promise<PlaceResult>((resolve, reject) => {
      this.pending.set(id, { resolve: resolve as (v: unknown) => void, reject });
      this.send({ type: 'place', id, params });
    });
  }

  /** Returns the run id (for cancel) and a promise of the result. */
  optimise(params: OptimiseParams, onProgress: Pending['onProgress']): { id: number; result: Promise<OptimiseResult> } {
    const id = this.nextId++;
    const result = this.ready.then(
      () =>
        new Promise<OptimiseResult>((resolve, reject) => {
          if (this.cancelledEarly.delete(id)) return reject(new CancelledError());
          this.pending.set(id, { resolve: resolve as (v: unknown) => void, reject, onProgress });
          this.send({ type: 'optimise', id, params });
        }),
    );
    return { id, result };
  }

  cancel(id: number) {
    if (this.pending.has(id)) this.send({ type: 'cancel', id });
    else this.cancelledEarly.add(id);
  }
}

export class CancelledError extends Error {
  constructor() {
    super('cancelled');
  }
}

let client: EngineClient | null = null;
export function getEngine(): EngineClient {
  if (!client) client = new EngineClient();
  return client;
}
