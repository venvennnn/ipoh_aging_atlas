import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { THRESHOLDS, modeFor, unitFor, type Goal, type OptimiseResult, type Pick } from '../engine/core';
import { CancelledError, getEngine } from '../engine/client';
import { LoadError } from '../components/ui';
import { fmt } from '../lib/format';
import { FAC_TYPES, type FacType } from '../lib/types';
import { useAtlas } from '../lib/useData';
import { KnownLimits, MapKeys, ReachControls, TYPE_META, existingPoints, hexFills, modelCheck } from './sim/shared';

const GOALS: { key: Goal; label: string; desc: string }[] = [
  { key: 'cover', label: 'Reach the most people', desc: 'Most residents 65+ newly within the travel time.' },
  { key: 'median', label: 'Shortest average trip', desc: 'Biggest cut in average travel time for residents 65+.' },
  { key: 'equity', label: 'Worst-off first', desc: 'Residents in high-index constituencies count for more.' },
];

interface Settings {
  type: FacType;
  walkDrive: 'walk' | 'drive';
  thrIdx: number;
  n: number;
  goal: Goal;
  dun: string;
}

const keyOf = (s: Settings) => {
  const mode = modeFor(s.type, s.walkDrive);
  const ti = Math.min(s.thrIdx, THRESHOLDS[mode].length - 1);
  return [s.type, mode, ti, s.goal, s.dun, s.n].join('|');
};

export default function Optimizer() {
  const atlas = useAtlas();
  const D = atlas.data;
  const [s, setS] = useState<Settings>({ type: 'clinic', walkDrive: 'walk', thrIdx: 1, n: 3, goal: 'cover', dun: 'all' });
  const [busy, setBusy] = useState(false);
  const [step, setStep] = useState(0);
  const [live, setLive] = useState<Pick[]>([]);
  const [res, setRes] = useState<{ key: string; settings: Settings; r: OptimiseResult; ms: number } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const runRef = useRef<number | null>(null);

  const set = (p: Partial<Settings>) => setS((o) => ({ ...o, ...p }));
  const mode = modeFor(s.type, s.walkDrive);
  const list = THRESHOLDS[mode];
  const ti = Math.min(s.thrIdx, list.length - 1);
  const tname = TYPE_META[s.type].label;
  const duns = useMemo(() => (D ? [...new Set(D.dun.map((d) => d.name))].sort() : []), [D]);

  const run = useCallback(
    (cfg: Settings) => {
      const m = modeFor(cfg.type, cfg.walkDrive);
      const t = Math.min(cfg.thrIdx, THRESHOLDS[m].length - 1);
      const t0 = performance.now();
      setBusy(true);
      setStep(0);
      setLive([]);
      setError(null);
      const job = getEngine().optimise(
        { type: cfg.type, mode: m, thr: THRESHOLDS[m][t][0], n: cfg.n, goal: cfg.goal, dun: cfg.dun },
        (k, _total, pick) => {
          setStep(k);
          setLive((l) => [...l, pick]);
        },
      );
      runRef.current = job.id;
      job.result.then(
        (r) => {
          if (runRef.current !== job.id) return;
          setRes({ key: keyOf(cfg), settings: cfg, r, ms: performance.now() - t0 });
          setBusy(false);
        },
        (e: Error) => {
          if (e instanceof CancelledError || runRef.current !== job.id) return;
          setError(e.message);
          setBusy(false);
        },
      );
    },
    [],
  );

  // Run once on load with the defaults.
  const ranOnce = useRef(false);
  useEffect(() => {
    if (D && !ranOnce.current) {
      ranOnce.current = true;
      run(s);
    }
  }, [D, run, s]);
  useEffect(
    () => () => {
      if (runRef.current != null) getEngine().cancel(runRef.current);
      runRef.current = null;
      ranOnce.current = false;
    },
    [],
  );

  const fresh = res != null && res.key === keyOf(s);
  const r = res?.r ?? null;
  // Results are shown with the settings they were computed for.
  const rs = res?.settings ?? s;
  const rMode = modeFor(rs.type, rs.walkDrive);
  const rTi = Math.min(rs.thrIdx, THRESHOLDS[rMode].length - 1);
  const rLabel = THRESHOLDS[rMode][rTi][1];
  const rUnit = unitFor(rMode);
  const dec = rMode === 'bus' ? 0 : 1;
  const picks = busy ? live : (r?.picks ?? []);

  const fills = useMemo(() => (D ? hexFills(D, busy ? null : (r?.hexNew ?? null)) : []), [D, r, busy]);
  const existing = useMemo(() => (D ? existingPoints(D, busy ? s.type : rs.type) : []), [D, s.type, rs.type, busy]);

  const vals = r && !busy ? [r.baseCov, ...r.picks.map((p) => p.cov)] : [];
  const bw = vals.length ? 276 / vals.length : 0;
  const chk = D ? modelCheck(D, s.type, mode, ti) : { model: null, routed: null };
  const stoppedEarly = r && !busy && r.picks.length < rs.n;

  return (
    <main className="page">
      <h1>Where is the best place to build?</h1>
      <p className="lede">
        Choose what to build and how many. The optimiser tests all {D ? fmt(D.hex.length) : '…'} hexagon centres against{' '}
        {D ? fmt(D.cells.lon.length) : '…'} real population cells and adds the best sites one at a time.
      </p>
      {atlas.error && <LoadError error={atlas.error} />}
      {error && <LoadError error={error} />}

      <div className="row">
        <aside aria-label="Optimiser settings" className="card panel-aside" style={{ flex: '1 1 300px', maxWidth: 340, padding: 20, display: 'flex', flexDirection: 'column', gap: 20 }}>
          <div>
            <h2 className="eyebrow" style={{ marginBottom: 10 }}>
              What to build
            </h2>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 6 }}>
              {FAC_TYPES.map((k) => {
                const on = k === s.type;
                return (
                  <button
                    key={k}
                    type="button"
                    aria-pressed={on}
                    onClick={() => set({ type: k, thrIdx: 1 })}
                    style={{
                      minHeight: 44,
                      padding: '0 10px',
                      borderRadius: 8,
                      fontSize: 14,
                      fontWeight: 700,
                      cursor: 'pointer',
                      border: `1px solid ${on ? '#1C5CAB' : '#C9C6BC'}`,
                      background: on ? '#1C5CAB' : '#FFFFFF',
                      color: on ? '#FFFFFF' : '#15181D',
                    }}
                  >
                    {TYPE_META[k].label}
                  </button>
                );
              })}
            </div>
          </div>

          <div>
            <h2 className="eyebrow" style={{ marginBottom: 10 }}>
              How many
            </h2>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <button type="button" aria-label="One fewer" onClick={() => set({ n: Math.max(1, s.n - 1) })} disabled={s.n <= 1} style={stepBtn}>
                −
              </button>
              <output aria-live="polite" aria-label="Number of sites" style={{ flex: '1 1 auto', textAlign: 'center', fontWeight: 800, fontSize: 40 }}>
                {s.n}
              </output>
              <button type="button" aria-label="One more" onClick={() => set({ n: Math.min(20, s.n + 1) })} disabled={s.n >= 20} style={stepBtn}>
                +
              </button>
            </div>
            <div role="group" aria-label="Presets" style={{ display: 'flex', gap: 6, marginTop: 10 }}>
              {[1, 2, 3, 5, 10].map((v) => {
                const on = v === s.n;
                return (
                  <button
                    key={v}
                    type="button"
                    aria-pressed={on}
                    aria-label={`${v} site${v > 1 ? 's' : ''}`}
                    onClick={() => set({ n: v })}
                    style={{
                      flex: '1 1 0',
                      minHeight: 44,
                      borderRadius: 8,
                      fontSize: 14,
                      fontWeight: 700,
                      cursor: 'pointer',
                      border: `1px solid ${on ? '#15181D' : '#E6E4DD'}`,
                      background: on ? '#15181D' : '#F6F5F1',
                      color: on ? '#FFFFFF' : '#15181D',
                    }}
                  >
                    {v}
                  </button>
                );
              })}
            </div>
          </div>

          <div>
            <h2 className="eyebrow" style={{ marginBottom: 10 }}>
              Goal
            </h2>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {GOALS.map((g) => {
                const on = g.key === s.goal;
                return (
                  <button
                    key={g.key}
                    type="button"
                    aria-pressed={on}
                    onClick={() => set({ goal: g.key })}
                    style={{
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'flex-start',
                      gap: 2,
                      textAlign: 'left',
                      minHeight: 44,
                      padding: '10px 12px',
                      borderRadius: 8,
                      cursor: 'pointer',
                      color: '#15181D',
                      border: `1px solid ${on ? '#1C5CAB' : '#E6E4DD'}`,
                      background: on ? '#EEF4FC' : '#FFFFFF',
                    }}
                  >
                    <span style={{ fontWeight: 700, fontSize: 14 }}>{g.label}</span>
                    <span style={{ fontSize: 12, color: '#5A5A55', lineHeight: 1.4 }}>{g.desc}</span>
                  </button>
                );
              })}
            </div>
          </div>

          <div>
            <h2 className="eyebrow" style={{ marginBottom: 10 }}>
              Within reach means
            </h2>
            <ReachControls type={s.type} mode={mode} onMode={(m) => set({ walkDrive: m })} ti={ti} onThreshold={(i) => set({ thrIdx: i })} />
          </div>

          <div>
            <label htmlFor="dun" style={{ display: 'block', fontSize: 14, fontWeight: 700, marginBottom: 6 }}>
              Only build inside
            </label>
            <select
              id="dun"
              value={s.dun}
              onChange={(e) => set({ dun: e.target.value })}
              style={{ width: '100%', minHeight: 44, padding: '0 10px', border: '1px solid #C9C6BC', borderRadius: 8, fontSize: 14, background: '#FFFFFF', color: '#15181D' }}
            >
              <option value="all">All of Ipoh</option>
              {duns.map((d) => (
                <option key={d} value={d}>
                  {d}
                </option>
              ))}
            </select>
          </div>

          <button type="button" className="btn-primary" disabled={busy || !D} onClick={() => run(s)}>
            {!D ? 'Loading data…' : busy ? `Finding site ${step + 1} of ${s.n}…` : fresh ? 'Up to date' : `Find the best ${s.n} site${s.n > 1 ? 's' : ''}`}
          </button>
        </aside>

        <div className="col" style={{ flex: '999 1 640px' }}>
          <div className="row">
            <section aria-label="Recommended sites map" className="card pad-14" style={{ flex: '999 1 420px' }}>
              <p style={{ margin: '2px 4px 10px', fontSize: 14, fontWeight: 700 }}>
                {r && !busy
                  ? `Best ${r.picks.length} new ${TYPE_META[rs.type].label.toLowerCase()}${r.picks.length > 1 ? 's' : ''}${fresh ? '' : ' · settings changed, press Find'}`
                  : tname}
              </p>
              <div className="map-wrap">
                <svg viewBox="0 0 740 800" role="img" aria-label="Map of Ipoh with the recommended sites numbered" className="map-svg">
                  {D?.hex.map((h, j) => <path key={h.id} d={h.d} fill={fills[j]} stroke="#FFFFFF" strokeWidth={0.6} />)}
                  {D && <path d={D.boundary} fill="none" stroke="#15181D" strokeWidth={1.6} />}
                  {existing.map((p, i) => (
                    <circle key={i} cx={p.x} cy={p.y} r={p.r} fill="#15181D" stroke="#FFFFFF" strokeWidth={p.sw} />
                  ))}
                  {D &&
                    picks.map((p, k) => {
                      const h = D.hex[p.hex];
                      return (
                        <g key={k}>
                          <circle cx={h.x} cy={h.y} r={14} fill="#B9461A" stroke="#FFFFFF" strokeWidth={3} />
                          <text x={h.x} y={h.y + 4.5} textAnchor="middle" fontSize={13} fontWeight={800} fill="#FFFFFF">
                            {k + 1}
                          </text>
                        </g>
                      );
                    })}
                </svg>
                {(!D || busy) && !atlas.error && (
                  <div className="map-overlay" role="status">
                    {!D
                      ? 'Loading population cells…'
                      : `Testing ${s.dun === 'all' ? fmt(D.hex.length) : 'all'} candidate sites · site ${step + 1} of ${s.n}`}
                  </div>
                )}
              </div>
              <div style={{ marginTop: 8 }}>
                <MapKeys recommended />
              </div>
            </section>

            <section aria-label="Coverage as you add sites" className="card" style={{ flex: '1 1 300px' }}>
              <h2 className="eyebrow">Coverage as you add sites</h2>
              <p className="small" style={{ margin: '4px 0 12px' }}>
                {TYPE_META[rs.type].label} · residents 65+ within {rLabel}
              </p>
              <svg
                viewBox="0 0 320 240"
                role="img"
                aria-label={
                  vals.length
                    ? `Share of residents 65+ within reach: ${vals.map((v, k) => `${k === 0 ? 'today' : `after site ${k}`} ${v.toFixed(1)}%`).join(', ')}`
                    : 'Share of residents 65+ within reach after each added site'
                }
                style={{ width: '100%', height: 'auto', display: 'block' }}
              >
                {[0, 25, 50, 75, 100].map((v) => {
                  const y = 210 - v * 2;
                  return (
                    <g key={v}>
                      <line x1={36} x2={312} y1={y} y2={y} stroke="#EEECE6" />
                      <text x={30} y={y + 3} textAnchor="end" fontSize={10} fill="#5A5A55">
                        {v}%
                      </text>
                    </g>
                  );
                })}
                {vals.map((v, k) => {
                  const hh = (v / 100) * 200;
                  return (
                    <g key={k}>
                      <rect x={36 + k * bw + bw * 0.15} y={210 - hh} width={bw * 0.7} height={hh} fill={k === 0 ? '#A8A59B' : '#1C5CAB'} rx={2}>
                        <title>{`${k === 0 ? 'Today' : `After site ${k}`}: ${v.toFixed(1)}%`}</title>
                      </rect>
                      {(k === 0 || vals.length <= 11 || k % 5 === 0) && (
                        <text x={36 + k * bw + bw / 2} y={232} textAnchor="middle" fontSize={10} fill="#5A5A55">
                          {k === 0 ? 'now' : k}
                        </text>
                      )}
                    </g>
                  );
                })}
              </svg>
              <p style={{ margin: '8px 0 0', fontSize: 13, lineHeight: 1.5, color: '#44443F' }}>
                {r && !busy ? `From ${r.baseCov.toFixed(1)}% today to ${r.finalCov.toFixed(1)}%.` : ''}
                {stoppedEarly ? ` Stopped after ${r.picks.length} site${r.picks.length === 1 ? '' : 's'}: no further site improves the goal.` : ''}
              </p>
            </section>
          </div>

          <section aria-label="Recommended sites" className="card">
            <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'baseline', gap: 8, marginBottom: 10 }}>
              <h2 style={{ margin: 0, fontSize: 18, fontWeight: 700 }}>Recommended sites, in build order</h2>
              <span className="small" aria-live="polite">
                {r && !busy
                  ? `+${fmt(r.added)} residents 65+ within ${rLabel} · average ${r.baseAvg.toFixed(dec)}${rUnit} → ${r.finalAvg.toFixed(dec)}${rUnit}`
                  : ''}
              </span>
            </div>
            <div className="table-scroll">
              <table className="data" style={{ minWidth: 700, fontSize: 14 }}>
                <thead>
                  <tr>
                    <th scope="col" style={{ padding: '10px 8px', width: 36 }}>
                      #
                    </th>
                    <th scope="col" style={{ padding: '10px 8px' }}>
                      Constituency
                    </th>
                    <th scope="col" style={{ padding: '10px 8px' }}>
                      Nearest existing
                    </th>
                    <th scope="col" style={{ padding: '10px 8px', textAlign: 'right' }}>
                      Residents 65+ added
                    </th>
                    <th scope="col" style={{ padding: '10px 8px', textAlign: 'right' }}>
                      Coverage after
                    </th>
                    <th scope="col" style={{ padding: '10px 8px', textAlign: 'right' }}>
                      Average after
                    </th>
                    <th scope="col" style={{ padding: '10px 8px', textAlign: 'right' }}>
                      Lat, lon
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {D &&
                    picks.map((p, k) => {
                      const h = D.hex[p.hex];
                      const td = { padding: '11px 8px' };
                      const num = { ...td, textAlign: 'right' as const, fontVariantNumeric: 'tabular-nums' };
                      return (
                        <tr key={k}>
                          <td style={{ ...td, fontWeight: 800, color: '#B9461A' }}>{k + 1}</td>
                          <td style={td}>{h.dun || h.area}</td>
                          <td style={{ ...td, color: '#44443F' }}>
                            {p.nearN || 'Unnamed'} · {p.nearD.toFixed(1)} km away
                          </td>
                          <td style={{ ...num, fontWeight: 700 }}>+{fmt(p.gain)}</td>
                          <td style={num}>{p.cov.toFixed(1)}%</td>
                          <td style={num}>
                            {p.avg.toFixed(dec)}
                            {rUnit}
                          </td>
                          <td style={{ ...num, color: '#5A5A55' }}>
                            {h.lat.toFixed(4)}, {h.lon.toFixed(4)}
                          </td>
                        </tr>
                      );
                    })}
                </tbody>
              </table>
            </div>
            {picks.length === 0 && (
              <p className="small" style={{ margin: '14px 0 0' }}>
                {busy ? 'Running…' : 'Press “Find” to run the optimiser.'}
              </p>
            )}
          </section>

          <section className="card">
            <h2 className="eyebrow" style={{ marginBottom: 8 }}>
              How it works, and how it checks out
            </h2>
            <p style={{ margin: 0, fontSize: 13, lineHeight: 1.6, color: '#2C2C29' }}>
              Demand is {D ? fmt(D.cells.lon.length) : '…'} cells of 100 m built from Meta's 30 m population layer, scaled to the notebook's 2026
              totals, with Census 2020 shares aged 65+. Each step adds the hexagon centre that helps most, keeping every existing facility.
              Travel time is straight-line distance times a street-detour factor fitted to the notebook's routed results.{' '}
              {chk.routed != null && chk.model != null
                ? `Check for this setting: the model puts ${chk.model.toFixed(1)}% of residents 65+ within ${list[ti][1]} today; the notebook’s street routing gives ${chk.routed.toFixed(1)}%.`
                : s.type === 'care'
                  ? 'Care homes have no routed curve in the notebook, so they use the average clinic and hospital fit; treat care-home results as indicative.'
                  : ''}
              {s.goal === 'equity' && D
                ? ' “Worst-off first” weights each cell by its constituency’s index score divided by the median constituency score.'
                : ''}
            </p>
            {D && <KnownLimits D={D} />}
            {res && !busy && (
              <p className="note" style={{ margin: '8px 0 0' }}>
                Last run: {fmt(r!.candidates)} candidates, {(res.ms / 1000).toFixed(1)} s.
              </p>
            )}
          </section>
        </div>
      </div>
    </main>
  );
}

const stepBtn = {
  width: 48,
  height: 48,
  border: '1px solid #C9C6BC',
  background: '#FFFFFF',
  borderRadius: 8,
  fontSize: 22,
  cursor: 'pointer',
  color: '#15181D',
} as const;
