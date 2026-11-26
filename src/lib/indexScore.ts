import { DOMAINS, type DunIndex } from './types';

export type Weights = [number, number, number, number, number];

/** Weighted average of a DUN's five domain scores (stats.index.dun). */
export function weightedScore(d: DunIndex, w: Weights): number {
  const t = w.reduce((a, b) => a + b, 0);
  if (!t) return 0;
  return DOMAINS.reduce((s, dom, i) => s + w[i] * d[dom], 0) / t;
}
