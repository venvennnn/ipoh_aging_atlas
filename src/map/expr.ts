import type { ExpressionSpecification } from 'maplibre-gl';

/** Evenly spaced colour stops from `lo` to `hi` on `input` (values outside are clamped). */
export function rampExpr(stops: string[], input: unknown, lo: number, hi: number): ExpressionSpecification {
  const e: unknown[] = ['interpolate', ['linear'], input];
  stops.forEach((c, i) => e.push(lo + ((hi - lo) * i) / (stops.length - 1), c));
  return e as ExpressionSpecification;
}
