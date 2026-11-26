import type { EngineInput, OptimiseParams, OptimiseResult, Pick, PlaceParams, PlaceResult } from './core';

export type ToWorker =
  | { type: 'init'; input: EngineInput }
  | { type: 'place'; id: number; params: PlaceParams }
  | { type: 'optimise'; id: number; params: OptimiseParams }
  | { type: 'cancel'; id: number };

export type FromWorker =
  | { type: 'ready' }
  | { type: 'placeResult'; id: number; result: PlaceResult }
  | { type: 'progress'; id: number; step: number; total: number; pick: Pick }
  | { type: 'optimiseResult'; id: number; result: OptimiseResult; ms: number }
  | { type: 'cancelled'; id: number }
  | { type: 'error'; id: number | null; message: string };
