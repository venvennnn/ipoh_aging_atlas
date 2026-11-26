import { useState, type MouseEvent } from 'react';
import { fmt } from '../../lib/format';
import type { Stats } from '../../lib/types';
import { CURVE_STYLE } from './derive';

const XMAX = 90;
const X0 = 40;
const XW = 410;
const Y0 = 250;
const YH = 240;
const sx = (m: number) => X0 + (m / XMAX) * XW;
const sy = (v: number) => Y0 - (v / 100) * YH;

/** Cumulative share of residents 65+ within each number of minutes (0–90). */
export function AccessCurves({ stats }: { stats: Stats }) {
  const [cross, setCross] = useState<number | null>(null);
  const series = Object.entries(stats.health.cumulative_curves_minutes_0_120).map(([name, y]) => ({
    name,
    y,
    ...(CURVE_STYLE[name] ?? { label: name, color: '#44443F', dash: '' }),
  }));
  const valAt = (y: number[], m: number) => (m < y.length ? y[m] : y[y.length - 1]);

  const onMove = (e: MouseEvent<SVGRectElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    const m = Math.max(0, Math.min(XMAX, Math.round(((e.clientX - r.left) / r.width) * XMAX)));
    if (m !== cross) setCross(m);
  };

  return (
    <div className="card pad-22">
      <h3>Share of residents 65+ within each travel time</h3>
      <p className="small" style={{ margin: '0 0 10px' }}>
        Hover to read values. Dashed line = 30 minutes.
      </p>
      <div className="keys" style={{ marginBottom: 8 }}>
        {series.map((c) => (
          <span key={c.name}>
            <svg width="22" height="8" aria-hidden="true">
              <line x1="0" y1="4" x2="22" y2="4" stroke={c.color} strokeWidth="2.5" strokeDasharray={c.dash} />
            </svg>
            {c.label}
          </span>
        ))}
      </div>
      <div style={{ position: 'relative' }}>
        <svg
          viewBox="0 0 460 280"
          role="img"
          aria-label={`Cumulative share of residents aged 65+ reaching a clinic or hospital within each number of minutes, walking and driving. At 30 minutes: ${series
            .map((c) => `${c.label} ${valAt(c.y, 30).toFixed(0)}%`)
            .join(', ')}.`}
          style={{ width: '100%', height: 'auto', display: 'block' }}
        >
          {[0, 25, 50, 75, 100].map((v) => (
            <g key={v}>
              <line x1={40} x2={450} y1={sy(v)} y2={sy(v)} stroke="#EEECE6" strokeWidth={1} />
              <text x={34} y={sy(v) + 4} textAnchor="end" fontSize={11} fill="#5A5A55">
                {v}%
              </text>
            </g>
          ))}
          {[0, 15, 30, 45, 60, 75, 90].map((v) => (
            <text key={v} x={sx(v)} y={270} textAnchor="middle" fontSize={11} fill="#5A5A55">
              {v}
            </text>
          ))}
          <line x1={sx(30)} x2={sx(30)} y1={10} y2={250} stroke="#15181D" strokeWidth={1} strokeDasharray="3 3" />
          {series.map((c) => {
            const pts: string[] = [];
            for (let m = 0; m <= XMAX; m++) pts.push(`${sx(m).toFixed(1)},${sy(valAt(c.y, m)).toFixed(1)}`);
            return (
              <path
                key={c.name}
                d={`M${pts.join('L')}`}
                fill="none"
                stroke={c.color}
                strokeWidth={2.2}
                strokeDasharray={c.dash}
                strokeLinejoin="round"
              />
            );
          })}
          {cross != null && (
            <g>
              <line x1={sx(cross)} x2={sx(cross)} y1={10} y2={250} stroke="#5A5A55" strokeWidth={1} />
              {series.map((c) => (
                <circle key={c.name} cx={sx(cross)} cy={sy(valAt(c.y, cross))} r={4.5} fill={c.color} stroke="#FFFFFF" strokeWidth={2} />
              ))}
            </g>
          )}
          <rect x={40} y={10} width={410} height={240} fill="transparent" onMouseMove={onMove} onMouseLeave={() => setCross(null)} />
        </svg>
        {cross != null && (
          <div
            style={{
              position: 'absolute',
              top: 8,
              ...(cross > 45 ? { left: '12%' } : { right: '4%' }),
              background: '#FFFFFF',
              border: '1px solid #DAD8D0',
              borderRadius: 8,
              padding: '8px 10px',
              fontSize: 12,
              minWidth: 150,
              boxShadow: '0 2px 8px rgba(0,0,0,0.08)',
              pointerEvents: 'none',
            }}
          >
            <p style={{ margin: '0 0 4px', fontWeight: 700 }}>Within {cross} min</p>
            {series.map((c) => (
              <p key={c.name} style={{ margin: 0, display: 'flex', justifyContent: 'space-between', gap: 12 }}>
                <span>{c.label}</span>
                <strong>{valAt(c.y, cross).toFixed(0)}%</strong>
              </p>
            ))}
          </div>
        )}
      </div>
      <p style={{ margin: '8px 0 0', fontSize: 12, color: '#5A5A55', textAlign: 'center' }}>Minutes</p>
    </div>
  );
}

/** Median household income by DUN, 2019 → 2024. */
export function IncomeDumbbell({ stats }: { stats: Stats }) {
  const rows = stats.money.dun_income;
  const dx = (v: number) => 120 + ((v - 3000) / 4500) * 330;
  const byName = Object.fromEntries(rows.map((r) => [r.dun, r]));
  const pp = byName['Pasir Pinji'];
  const ca = byName['Canning'];
  return (
    <div className="card pad-22">
      <h3>Income moved unevenly, 2019 → 2024</h3>
      <div className="keys" style={{ gap: 16, margin: '6px 0 12px' }}>
        <span>
          <span className="swatch dot" style={{ width: 10, height: 10, background: '#A8A59B' }} />
          2019
        </span>
        <span>
          <span className="swatch dot" style={{ width: 10, height: 10, background: '#1C5CAB' }} />
          2024
        </span>
      </div>
      <svg
        viewBox="0 0 460 400"
        role="img"
        aria-label="Median household income by constituency in 2019 and 2024"
        style={{ width: '100%', height: 'auto', display: 'block' }}
      >
        <title>
          {rows.map((r) => `${r.dun}: RM${fmt(r.median_2019)} to RM${fmt(r.median_2024)}`).join('; ')}
        </title>
        {[3000, 4000, 5000, 6000, 7000].map((v) => (
          <g key={v}>
            <line x1={dx(v)} x2={dx(v)} y1={8} y2={376} stroke="#EEECE6" />
            <text x={dx(v)} y={394} textAnchor="middle" fontSize={11} fill="#5A5A55">
              RM{v / 1000}k
            </text>
          </g>
        ))}
        {rows.map((r, i) => {
          const y = 18 + i * 27.5;
          return (
            <g key={r.dun}>
              <text x={108} y={y + 4} textAnchor="end" fontSize={12} fill="#15181D">
                {r.dun}
              </text>
              <line
                x1={dx(r.median_2019)}
                x2={dx(r.median_2024)}
                y1={y}
                y2={y}
                stroke={r.median_2024 < r.median_2019 ? '#B9461A' : '#86B6EF'}
                strokeWidth={2}
              />
              <circle cx={dx(r.median_2019)} cy={y} r={5} fill="#A8A59B" stroke="#FFFFFF" strokeWidth={1.5} />
              <circle cx={dx(r.median_2024)} cy={y} r={6} fill="#1C5CAB" stroke="#FFFFFF" strokeWidth={1.5}>
                <title>{`${r.dun}: RM${fmt(r.median_2019)} → RM${fmt(r.median_2024)}`}</title>
              </circle>
            </g>
          );
        })}
      </svg>
      {pp && ca && (
        <p style={{ margin: '8px 0 0', fontSize: 13, lineHeight: 1.5, color: '#44443F' }}>
          Pasir Pinji fell from RM{fmt(pp.median_2019)} to RM{fmt(pp.median_2024)}; Canning rose from RM{fmt(ca.median_2019)} to RM
          {fmt(ca.median_2024)}. Nominal RM per month.
        </p>
      )}
    </div>
  );
}
