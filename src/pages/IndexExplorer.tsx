import { useMemo, useState } from 'react';
import IndexMap from '../components/IndexMap';
import { LoadError } from '../components/ui';
import { fmt } from '../lib/format';
import { weightedScore, type Weights } from '../lib/indexScore';
import { DOMAINS, type DunIndex, type Domain } from '../lib/types';
import { useAtlas, useStats } from '../lib/useData';
import { robustRule } from './overview/derive';

const NAMES: Record<Domain, string> = { money: 'Money', health: 'Health', care: 'Care', social: 'Social', access: 'Access' };
const DESC: Record<Domain, string> = {
  money: 'Estimated household income (DOSM DUN median)',
  health: 'Walk/drive to clinic and hospital, clinic capacity',
  care: 'Walk/drive to a care home',
  social: 'Kinds of meeting place within 10 min walk',
  access: 'Bus stops and frequency, internet speed',
};
const EQUAL: Weights = [1, 1, 1, 1, 1];
const PRESETS: { label: string; w: Weights }[] = [
  { label: 'Equal (study)', w: EQUAL },
  { label: 'Health first', w: [1, 4, 2, 1, 1] },
  { label: 'Money first', w: [4, 1, 1, 1, 1] },
  { label: 'Getting around', w: [1, 2, 1, 1, 4] },
];

const rankOf = (rows: DunIndex[], w: Weights) =>
  rows.map((d) => ({ d, s: weightedScore(d, w) })).sort((a, b) => b.s - a.s);

function heat(v: number) {
  const bg = v >= 80 ? '#6E2408' : v >= 60 ? '#B9461A' : v >= 40 ? '#F8B48C' : v >= 20 ? '#FDE0CC' : '#FFF4EC';
  const fg = v >= 60 ? '#FFFFFF' : '#15181D';
  return { textAlign: 'center' as const, padding: 6, background: bg, color: fg, border: '2px solid #FFFFFF' };
}

export default function IndexExplorer() {
  const stats = useStats();
  const atlas = useAtlas();
  const S = stats.data;
  const [w, setW] = useState<Weights>(EQUAL);
  const total = w.reduce((a, b) => a + b, 0);

  const { ranking, eqRank } = useMemo(() => {
    if (!S) return { ranking: [], eqRank: {} as Record<string, number> };
    const eq: Record<string, number> = {};
    rankOf(S.index.dun, EQUAL).forEach((x, i) => (eq[x.d.dun] = i + 1));
    return { ranking: rankOf(S.index.dun, w), eqRank: eq };
  }, [S, w]);

  return (
    <main className="page">
      <h1>Who needs help most?</h1>
      <p className="lede" style={{ maxWidth: 820 }}>
        The ageing-vulnerability index scores every area 0–100 in five domains, where higher means worse for an older person. Decide how much
        each domain matters and the constituency ranking updates.
      </p>
      {stats.error && <LoadError error={stats.error} />}
      {S && (
        <div className="row">
          <aside aria-label="Domain weights" className="card panel-aside" style={{ flex: '1 1 320px', maxWidth: 360, padding: 22, borderColor: '#DAD8D0' }}>
            <h2 style={{ margin: '0 0 4px', fontSize: 13, fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase', color: '#5A5A55' }}>
              How much does each domain count?
            </h2>
            <p className="small" style={{ margin: '0 0 18px' }}>
              0 leaves a domain out. Equal weights match the study.
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
              {DOMAINS.map((dom, i) => (
                <div key={dom}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 8 }}>
                    <label htmlFor={`w-${dom}`} style={{ fontSize: 15, fontWeight: 600 }}>
                      {NAMES[dom]}
                    </label>
                    <span className="tabular" style={{ fontSize: 14, color: '#44443F' }}>
                      {total ? `${Math.round((w[i] / total) * 100)}% of index` : '—'}
                    </span>
                  </div>
                  <p id={`w-${dom}-desc`} style={{ margin: '2px 0 8px', fontSize: 12, color: '#5A5A55' }}>
                    {DESC[dom]}
                  </p>
                  <input
                    id={`w-${dom}`}
                    type="range"
                    min={0}
                    max={5}
                    step={1}
                    value={w[i]}
                    aria-describedby={`w-${dom}-desc`}
                    aria-valuetext={`weight ${w[i]} of 5`}
                    onChange={(e) => {
                      const next = [...w] as Weights;
                      next[i] = Number(e.target.value);
                      setW(next);
                    }}
                    style={{ width: '100%', height: 44, accentColor: '#1C5CAB' }}
                  />
                </div>
              ))}
            </div>
            <div style={{ height: 1, background: '#E6E4DD', margin: '22px 0 16px' }} />
            <p style={{ margin: '0 0 10px', fontSize: 13, fontWeight: 600, color: '#44443F' }}>Presets</p>
            <div className="toggle-row">
              {PRESETS.map((p) => {
                const on = p.w.every((v, i) => v === w[i]);
                return (
                  <button
                    key={p.label}
                    type="button"
                    aria-pressed={on}
                    onClick={() => setW(p.w)}
                    style={{
                      minHeight: 44,
                      padding: '0 12px',
                      border: `1px solid ${on ? '#15181D' : '#C9C6BC'}`,
                      background: on ? '#15181D' : '#FFFFFF',
                      color: on ? '#FFFFFF' : '#15181D',
                      borderRadius: 999,
                      fontSize: 13,
                      fontWeight: 500,
                      cursor: 'pointer',
                    }}
                  >
                    {p.label}
                  </button>
                );
              })}
            </div>
          </aside>

          <div className="col" style={{ flex: '999 1 640px' }}>
            <section aria-label="Constituency ranking" className="card pad-22" style={{ borderColor: '#DAD8D0' }}>
              <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'baseline', gap: 8, marginBottom: 16 }}>
                <h2 style={{ margin: 0, fontSize: 18, fontWeight: 600 }}>Constituencies, most vulnerable first</h2>
                <span className="small">Domain scores weighted by residents 65+</span>
              </div>
              <div className="table-scroll">
                <table className="data" style={{ minWidth: 640, fontSize: 14 }} aria-live="polite">
                  <thead>
                    <tr>
                      <th scope="col" style={{ width: 28, paddingBottom: 6 }}>
                        #
                      </th>
                      <th scope="col" style={{ width: 150, paddingBottom: 6 }}>
                        DUN
                      </th>
                      <th scope="col" style={{ paddingBottom: 6 }}>
                        Index
                      </th>
                      <th scope="col" style={{ width: 56, textAlign: 'right', paddingBottom: 6 }}>
                        Score
                      </th>
                      <th scope="col" style={{ width: 70, textAlign: 'right', paddingBottom: 6 }}>
                        vs equal
                      </th>
                      <th scope="col" style={{ width: 80, textAlign: 'right', paddingBottom: 6 }}>
                        Aged 65+
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {ranking.map((x, i) => {
                      const mv = eqRank[x.d.dun] - (i + 1);
                      const td = { padding: '8px 12px 8px 0', borderBottom: 0 };
                      return (
                        <tr key={x.d.dun}>
                          <td style={{ ...td, fontWeight: 700, color: '#44443F' }}>{i + 1}</td>
                          <th scope="row" style={{ ...td, fontWeight: 500, textAlign: 'left' }}>
                            {x.d.dun}
                          </th>
                          <td style={td}>
                            <div style={{ height: 20, background: '#F0EEE8', borderRadius: 4, overflow: 'hidden' }}>
                              <div style={{ width: `${x.s.toFixed(1)}%`, height: '100%', background: x.s >= 45 ? '#B9461A' : '#1C5CAB' }} />
                            </div>
                          </td>
                          <td className="tabular" style={{ ...td, textAlign: 'right', fontWeight: 700 }}>
                            {x.s.toFixed(0)}
                          </td>
                          <td
                            style={{ ...td, textAlign: 'right', fontSize: 13, fontWeight: 600, color: mv > 0 ? '#B9461A' : mv < 0 ? '#1C5CAB' : '#5A5A55' }}
                            aria-label={mv > 0 ? `up ${mv}` : mv < 0 ? `down ${-mv}` : 'no change'}
                          >
                            {mv > 0 ? `▲ ${mv}` : mv < 0 ? `▼ ${-mv}` : '–'}
                          </td>
                          <td className="tabular" style={{ ...td, textAlign: 'right', color: '#44443F' }}>
                            {fmt(x.d.aged65)}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              {(() => {
                const off = S.index.dun.filter((d) => Math.round(weightedScore(d, EQUAL)) !== d.index);
                return off.length ? (
                  <p className="note" style={{ margin: '12px 0 0' }}>
                    Scores are recalculated from the rounded domain scores, so with equal weights{' '}
                    {off.map((d) => `${d.dun} shows ${Math.round(weightedScore(d, EQUAL))}`).join(', ')} where the study's index gives{' '}
                    {off.map((d) => d.index).join(', ')}.
                  </p>
                ) : null;
              })()}
            </section>

            <div className="row">
              <section aria-label="Index map" className="card" style={{ flex: '999 1 460px', padding: 16, borderColor: '#DAD8D0' }}>
                <h2 style={{ margin: '0 0 4px', fontSize: 18, fontWeight: 600 }}>Where the index is high</h2>
                <p className="small" style={{ margin: '0 0 12px' }}>
                  Hexagon scores with equal weights, from the notebook. The sliders re-rank constituencies; they don't redraw this map.
                </p>
                <IndexMap atlas={atlas.data} stats={S} />
              </section>
              <section className="col" style={{ flex: '1 1 300px' }}>
                <div className="card pad-22" style={{ borderColor: '#DAD8D0' }}>
                  <h2 style={{ margin: '0 0 8px', fontSize: 13, fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase', color: '#5A5A55' }}>
                    Robust under any weighting
                  </h2>
                  <p style={{ margin: 0, fontWeight: 700, fontSize: 44 }}>{S.index.robust.hexagons}</p>
                  <p style={{ margin: '4px 0 0', fontSize: 14, lineHeight: 1.5, color: '#44443F' }}>
                    {(() => {
                      const r = robustRule(S);
                      return `hexagons stay in the worst ${r.worst}% under at least ${r.share}% of ${r.runs} random weightings. ${fmt(S.index.robust.aged65)} residents aged 65+ live in them.`;
                    })()}
                  </p>
                </div>
                <div className="card pad-22" style={{ borderColor: '#DAD8D0' }}>
                  <h2 style={{ margin: '0 0 8px', fontSize: 13, fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase', color: '#5A5A55' }}>
                    Read this first
                  </h2>
                  <p style={{ margin: 0, fontSize: 14, lineHeight: 1.55, color: '#44443F' }}>
                    Care and Social are measured only by distance to places. How people are actually doing (illness, loneliness, who cares
                    for them) needs the survey.
                  </p>
                </div>
              </section>
            </div>

            <section aria-label="Domain scores by DUN" className="card pad-22" style={{ borderColor: '#DAD8D0' }}>
              <h2 style={{ margin: '0 0 4px', fontSize: 18, fontWeight: 600 }}>What drives each score</h2>
              <p className="small" style={{ margin: '0 0 14px' }}>
                Domain scores, 0–100, higher = worse. Darker = higher.
              </p>
              <div className="table-scroll">
                <table style={{ width: '100%', minWidth: 460, borderCollapse: 'collapse', fontSize: 13 }} className="tabular">
                  <thead>
                    <tr style={{ color: '#5A5A55', fontSize: 12, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                      <th scope="col" style={{ textAlign: 'left', padding: '8px 6px', borderBottom: '1px solid #DAD8D0' }}>
                        DUN
                      </th>
                      {DOMAINS.map((d) => (
                        <th key={d} scope="col" style={{ padding: '8px 6px', borderBottom: '1px solid #DAD8D0', textAlign: 'center' }}>
                          {NAMES[d]}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {ranking.map((x) => (
                      <tr key={x.d.dun}>
                        <th scope="row" style={{ textAlign: 'left', fontWeight: 500, padding: '4px 6px' }}>
                          {x.d.dun}
                        </th>
                        {DOMAINS.map((d) => (
                          <td key={d} style={heat(x.d[d])}>
                            {x.d[d]}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>

            <section aria-label="Index bands" className="card pad-22" style={{ borderColor: '#DAD8D0' }}>
              <h2 style={{ margin: '0 0 4px', fontSize: 18, fontWeight: 600 }}>Best-off to worst-off fifth of Ipoh</h2>
              <p className="small" style={{ margin: '0 0 14px' }}>
                Hexagons in five bands with equal numbers of residents 65+, by overall index (equal weights).
              </p>
              <div className="table-scroll">
                <table style={{ width: '100%', minWidth: 560, borderCollapse: 'collapse', fontSize: 14 }} className="tabular">
                  <thead>
                    <tr style={{ color: '#5A5A55', fontSize: 12, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                      <th scope="col" style={{ textAlign: 'left', padding: 8, borderBottom: '1px solid #DAD8D0' }}>
                        Band
                      </th>
                      <th scope="col" style={{ textAlign: 'right', padding: 8, borderBottom: '1px solid #DAD8D0' }}>
                        Aged 65+
                      </th>
                      {DOMAINS.map((d) => (
                        <th key={d} scope="col" style={{ padding: 8, borderBottom: '1px solid #DAD8D0', textAlign: 'center' }}>
                          {NAMES[d]}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {S.index.bands.names.map((name, i) => (
                      <tr key={name}>
                        <th scope="row" style={{ textAlign: 'left', fontWeight: 500, padding: '4px 8px' }}>
                          {name}
                        </th>
                        <td style={{ textAlign: 'right', padding: '4px 8px' }}>{fmt(S.index.bands.aged65[i])}</td>
                        {DOMAINS.map((d) => {
                          const v = S.index.bands[d][i];
                          return (
                            <td key={d} style={heat(Math.round(v))} title={v.toFixed(1)}>
                              {Math.round(v)}
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          </div>
        </div>
      )}
    </main>
  );
}
