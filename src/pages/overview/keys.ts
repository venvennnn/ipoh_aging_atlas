// Colour keys shared by the opening chapters and Parts 1–7. Stops and labels
// follow exactly how each map is coloured.
import { rasterTicks, rasterUnit } from '../../components/ColorKey';
import { fmt, ramp } from '../../lib/format';
import type { Stats } from '../../lib/types';
import { rampExpr } from '../../map/expr';

export const BLUES = ['#EEF4FC', '#CDE2FB', '#86B6EF', '#1C5CAB', '#0D366B'];
export const ORANGES = ['#FFF4EC', '#FDE0CC', '#F8B48C', '#B9461A', '#6E2408'];

export type PeopleKey = 'p65' | 'pop' | 'pct';

/** People map: colour runs on √value from 0 to the largest cell, or linearly 8–14% for the share. */
export function peopleScale(layer: PeopleKey, max: { p65: number; pop: number }) {
  if (layer === 'pct') {
    return {
      expr: rampExpr(ORANGES, ['get', 'pct'], 8, 14),
      key: { title: 'Share aged 65+ (Census 2020, by census area), %', stops: ORANGES, ticks: ['8', '9.5', '11', '12.5', '14+'] },
    };
  }
  const m = max[layer];
  const stops = layer === 'p65' ? ORANGES : BLUES;
  // Bar positions 0, ¼, ½, ¾, 1 on a square-root scale are values m × position².
  const ticks = [0, 0.25, 0.5, 0.75, 1].map((t) => {
    const v = m * t * t;
    return layer === 'p65' ? (v === 0 ? '0' : v.toFixed(1)) : fmt(v);
  });
  return {
    expr: rampExpr(stops, ['sqrt', ['get', layer]], 0, Math.sqrt(m)),
    key: { title: layer === 'p65' ? 'Residents aged 65+ in each 100 m square' : 'Residents in each 100 m square', stops, ticks },
  };
}

/** Money map: income colours use the BLUES ramp from position 0.1 to 1. */
export function moneyScale(lo: number, hi: number) {
  const color = (income: number) => ramp(BLUES, 0.1 + ((income - lo) / (hi - lo)) * 0.9);
  const steps = [0, 0.25, 0.5, 0.75, 1];
  return {
    color,
    key: {
      title: 'Median household income per month, 2024 (DOSM)',
      stops: steps.map((t) => ramp(BLUES, 0.1 + t * 0.9)),
      ticks: steps.map((t) => `RM${fmt(lo + (hi - lo) * t)}`),
    },
  };
}

/** Key for a notebook raster layer (stats.rasters.layers[name]). */
export function rasterKey(S: Stats, name: string, title: string) {
  const meta = S.rasters.layers[name];
  const withUnit = meta.unit === 'min' || meta.unit === 'score';
  return { title: withUnit ? `${title}, ${rasterUnit(meta.unit)}` : title, stops: S.rasters.ramps[meta.ramp], ticks: rasterTicks(meta) };
}
