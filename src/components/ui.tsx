import type { ReactNode } from 'react';
import { gradient } from '../lib/format';

export interface Option<K extends string> {
  key: K;
  label: string;
}

/** A row of toggle buttons (aria-pressed). */
export function ToggleGroup<K extends string>({
  label,
  options,
  value,
  onChange,
  className = 'toggle-row',
  buttonClass = 'tab-btn',
}: {
  label: string;
  options: Option<K>[];
  value: K;
  onChange: (k: K) => void;
  className?: string;
  buttonClass?: string;
}) {
  return (
    <div role="group" aria-label={label} className={className}>
      {options.map((o) => (
        <button
          key={o.key}
          type="button"
          className={buttonClass}
          aria-pressed={o.key === value}
          onClick={() => onChange(o.key)}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

export function HoverCard({ title, body }: { title: string; body: string }) {
  return (
    <div className="hover-card" aria-live="polite">
      <p className="t">{title}</p>
      <p className="b">{body}</p>
    </div>
  );
}

export function RampLegend({ lo, hi, stops, unit, extra }: { lo: string; hi: string; stops: string[]; unit?: string; extra?: ReactNode }) {
  return (
    <div className="legend">
      <span>{lo}</span>
      <span className="ramp" style={{ background: gradient(stops) }} aria-hidden="true" />
      <span>{hi}</span>
      {unit && <span className="unit">{unit}</span>}
      {extra}
    </div>
  );
}

/** Horizontal bar row: label · bar · value. */
export function BarRow({
  label,
  value,
  widthPct,
  color,
  cols,
  height = 18,
  strong = true,
  marker,
}: {
  label: ReactNode;
  value: ReactNode;
  widthPct: number;
  color: string;
  cols: string;
  height?: number;
  strong?: boolean;
  marker?: number;
}) {
  return (
    <div className="hbar" style={{ gridTemplateColumns: cols, marginBottom: 10 }}>
      <span>{label}</span>
      <div className="track" style={{ height }}>
        <div className="fill" style={{ width: `${Math.max(0, Math.min(100, widthPct)).toFixed(1)}%`, background: color }} />
        {marker != null && (
          <div
            aria-hidden="true"
            style={{ position: 'absolute', top: -4, bottom: -4, left: `${marker}%`, borderLeft: '1.5px dashed #15181D' }}
          />
        )}
      </div>
      {strong ? (
        <strong className="tabular" style={{ textAlign: 'right' }}>
          {value}
        </strong>
      ) : (
        <span className="tabular" style={{ textAlign: 'right' }}>
          {value}
        </span>
      )}
    </div>
  );
}

export function LoadError({ error }: { error: string }) {
  return (
    <p role="alert" style={{ color: '#B9461A', fontWeight: 600 }}>
      The data could not be loaded: {error}. Reload the page to try again.
    </p>
  );
}
