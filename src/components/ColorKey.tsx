import type { ReactNode } from 'react';
import { gradient } from '../lib/format';

/**
 * Colour key under a map: what the colour measures, the colour bar, and labelled
 * steps under it. Ticks are spread evenly along the bar, matching evenly spaced stops.
 */
export function ColorKey({ title, stops, ticks, extra }: { title: string; stops: string[]; ticks: string[]; extra?: ReactNode }) {
  const n = ticks.length;
  return (
    <div className="color-key" role="group" aria-label={`Colour key: ${title}, from ${ticks[0]} to ${ticks[n - 1]}`}>
      <p className="ck-title">{title}</p>
      <div className="ck-bar" style={{ background: gradient(stops) }} aria-hidden="true" />
      <div className="ck-ticks" aria-hidden="true">
        {ticks.map((t, i) => {
          const pos = n === 1 ? 0 : (i / (n - 1)) * 100;
          const shift = i === 0 ? '0' : i === n - 1 ? '-100%' : '-50%';
          return (
            <span key={i} style={{ left: `${pos}%`, transform: `translateX(${shift})` }}>
              {t}
            </span>
          );
        })}
      </div>
      {extra && <div className="ck-extra">{extra}</div>}
    </div>
  );
}

/** A small marker + label for the key's extra row. */
export function KeyItem({ swatch, children }: { swatch: ReactNode; children: ReactNode }) {
  return (
    <span className="ck-item">
      {swatch}
      {children}
    </span>
  );
}

export const Dot = ({ color, size = 10, ring = true }: { color: string; size?: number; ring?: boolean }) => (
  <span
    aria-hidden="true"
    style={{
      width: size,
      height: size,
      borderRadius: '50%',
      background: color,
      flex: '0 0 auto',
      border: ring ? '2px solid #FFFFFF' : undefined,
      boxShadow: ring ? '0 0 0 1px #C9C6BC' : undefined,
    }}
  />
);

export const LineSwatch = ({ color = '#15181D', width = 2, opacity = 1 }: { color?: string; width?: number; opacity?: number }) => (
  <span aria-hidden="true" style={{ width: 18, height: 0, borderTop: `${width}px solid ${color}`, opacity, flex: '0 0 auto' }} />
);

/** Evenly spaced ticks for a notebook raster layer (stats.rasters.layers). */
export function rasterTicks(meta: { min: number; max: number; unit: string }, steps = 5): string[] {
  const out: string[] = [];
  for (let i = 0; i < steps; i++) {
    const v = meta.min + ((meta.max - meta.min) * i) / (steps - 1);
    const s = Number.isInteger(meta.max) && Number.isInteger(meta.min) && Number.isInteger(v) ? String(v) : v.toFixed(2);
    out.push(i === steps - 1 && meta.unit === 'min' ? `${s}+` : s);
  }
  return out;
}

/** Title for a raster layer's key, e.g. "Walking time, minutes". */
export const rasterUnit = (unit: string) => (unit === 'min' ? 'minutes' : unit === 'score' ? 'score (0 better, 100 worse)' : unit);

/** A white border between two filled areas, as drawn on the income map. */
export const BorderSwatch = ({ fill = '#86B6EF' }: { fill?: string }) => (
  <span aria-hidden="true" style={{ display: 'inline-flex', gap: 3, background: '#FFFFFF', boxShadow: '0 0 0 1px #C9C6BC', flex: '0 0 auto' }}>
    <span style={{ width: 9, height: 11, background: fill }} />
    <span style={{ width: 9, height: 11, background: fill }} />
  </span>
);
