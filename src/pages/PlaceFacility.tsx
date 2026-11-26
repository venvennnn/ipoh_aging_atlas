import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { CELL_NEW, CELL_TODAY, THRESHOLDS, modeFor, unitFor, type PlaceResult } from '../engine/core';
import { getEngine } from '../engine/client';
import { HoverCard, LoadError } from '../components/ui';
import { fmt } from '../lib/format';
import AtlasMap, { type CellProps } from '../map/AtlasMap';
import { FAC_TYPES, type FacType } from '../lib/types';
import { useAtlas } from '../lib/useData';
import { KnownLimits, MapKeys, ReachControls, TYPE_META, existingStyle, modelCheck } from './sim/shared';

interface Site {
  lon: number;
  lat: number;
}

export default function PlaceFacility() {
  const atlas = useAtlas();
  const D = atlas.data;
  const [type, setType] = useState<FacType>('clinic');
  const [walkDrive, setWalkDrive] = useState<'walk' | 'drive'>('walk');
  const [thrIdx, setThrIdx] = useState(1);
  const [placed, setPlaced] = useState<Site[]>([]);
  const [hover, setHover] = useState<CellProps | null>(null);
  const [result, setResult] = useState<PlaceResult | null>(null);
  const [engineError, setEngineError] = useState<string | null>(null);
  const reqRef = useRef(0);

  const mode = modeFor(type, walkDrive);
  const list = THRESHOLDS[mode];
  const ti = Math.min(thrIdx, list.length - 1);
  const [thr, thrLabel] = list[ti];
  const meta = TYPE_META[type];
  const unit = unitFor(mode);
  const dec = mode === 'bus' ? 0 : 1;

  // Recalculate in the worker whenever the plan or settings change.
  useEffect(() => {
    if (!D) return;
    const req = ++reqRef.current;
    getEngine()
      .place({ type, mode, thr, sites: placed.map(({ lon, lat }) => ({ lon, lat })) })
      .then(
        (r) => req === reqRef.current && setResult(r),
        (e: Error) => setEngineError(e.message),
      );
  }, [D, type, mode, thr, placed]);

  const points = useMemo(() => (D ? { list: D.fac[type], ...existingStyle(type) } : null), [D, type]);
  const pins = useMemo(
    () => placed.map((p, i) => ({ ...p, n: i + 1, color: meta.color, label: `Your ${meta.label.toLowerCase()} ${i + 1}` })),
    [placed, meta],
  );
  const addAt = useCallback((lon: number, lat: number) => setPlaced((p) => [...p, { lon, lat }]), []);

  const tot = result?.tot ?? 0;
  const hoverStatus =
    hover && result
      ? result.cellState[hover.id] === CELL_TODAY
        ? 'Within reach today'
        : result.cellState[hover.id] === CELL_NEW
          ? 'Newly in reach with your plan'
          : 'Still out of reach'
      : '';
  const chk = D ? modelCheck(D, type, mode, ti) : { model: null, routed: null };
  const gains = (result?.gainsByDun ?? []).slice(0, 6);
  const gmax = gains.length ? gains[0][1] : 1;

  return (
    <main className="page">
      <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'flex-end', justifyContent: 'space-between', gap: 16, marginBottom: 24 }}>
        <div>
          <h1>What if we build here?</h1>
          <p className="lede" style={{ margin: '8px 0 0' }}>
            Pick a facility, then click anywhere on the map to add it. Results recalculate on{' '}
            {D ? fmt(D.cells.lon.length) : '…'} real population cells.
          </p>
        </div>
        <button type="button" className="btn-outline" onClick={() => setPlaced([])}>
          Clear my facilities
        </button>
      </div>
      {atlas.error && <LoadError error={atlas.error} />}
      {engineError && <LoadError error={engineError} />}

      <div className="row">
        <aside aria-label="Simulation settings" className="col panel-aside" style={{ flex: '1 1 280px', maxWidth: 320, gap: 16 }}>
          <section className="card">
            <h2 className="eyebrow" style={{ marginBottom: 12 }}>
              1 · Facility
            </h2>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {FAC_TYPES.map((k) => {
                const on = k === type;
                return (
                  <button
                    key={k}
                    type="button"
                    aria-pressed={on}
                    onClick={() => {
                      setType(k);
                      setPlaced([]);
                      setThrIdx(1);
                    }}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 10,
                      minHeight: 44,
                      padding: '0 12px',
                      borderRadius: 8,
                      fontSize: 14,
                      fontWeight: on ? 700 : 500,
                      cursor: 'pointer',
                      color: '#15181D',
                      background: on ? '#EEF4FC' : '#FFFFFF',
                      border: `1px solid ${on ? '#1C5CAB' : '#E6E4DD'}`,
                    }}
                  >
                    <span style={{ width: 12, height: 12, borderRadius: '50%', flex: '0 0 auto', background: TYPE_META[k].color }} />
                    <span style={{ flex: '1 1 auto', textAlign: 'left' }}>{TYPE_META[k].label}</span>
                    <span style={{ fontSize: 12, fontWeight: 500, color: '#5A5A55' }}>{D ? `${fmt(D.fac[k].length)} today` : ''}</span>
                  </button>
                );
              })}
            </div>
            <p className="note" style={{ margin: '10px 0 0' }}>
              Senior activity centres can be added once JKM's PAWE list loads. It failed to download for the notebook.
            </p>
          </section>

          <section className="card">
            <h2 className="eyebrow" style={{ marginBottom: 12 }}>
              2 · Counts as within reach
            </h2>
            <ReachControls type={type} mode={mode} onMode={setWalkDrive} ti={ti} onThreshold={setThrIdx} />
          </section>

          <section className="card">
            <h2 className="eyebrow" style={{ marginBottom: 6 }}>
              Your facilities
            </h2>
            {placed.length === 0 && <p className="small" style={{ margin: 0 }}>None yet. Click the map.</p>}
            {placed.map((p, i) => (
              <div key={`${p.lon}-${p.lat}-${i}`} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 0', borderBottom: '1px solid #F0EEE8', fontSize: 13 }}>
                <span
                  aria-hidden="true"
                  style={{
                    flex: '0 0 auto',
                    width: 26,
                    height: 26,
                    borderRadius: '50%',
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: 12,
                    fontWeight: 800,
                    color: '#FFFFFF',
                    background: meta.color,
                  }}
                >
                  {i + 1}
                </span>
                <span style={{ flex: '1 1 auto', minWidth: 0 }}>
                  <strong>+{fmt(result?.perSite[i] ?? 0)}</strong> residents 65+ newly in reach
                  <br />
                  <span style={{ color: '#5A5A55' }}>
                    {p.lat.toFixed(4)}, {p.lon.toFixed(4)}
                  </span>
                </span>
                <button
                  type="button"
                  aria-label={`Remove site ${i + 1}`}
                  onClick={() => setPlaced((s) => s.filter((_, q) => q !== i))}
                  style={{ width: 44, height: 44, border: '1px solid #E6E4DD', background: '#FFFFFF', borderRadius: 8, cursor: 'pointer', color: '#44443F', fontSize: 18 }}
                >
                  ×
                </button>
              </div>
            ))}
          </section>
        </aside>

        <section aria-label="Map" className="card pad-14" style={{ flex: '999 1 480px' }}>
          <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center', gap: 8, padding: '2px 4px 10px' }}>
            <p style={{ margin: 0, fontSize: 14, fontWeight: 600 }}>
              Adding: <span style={{ color: meta.color }}>{meta.label}</span> · click to place
            </p>
            <MapKeys />
          </div>
          <div className="map-wrap">
            <AtlasMap
              D={D}
              cooperative={false}
              label={`Zoomable street map of Ipoh. Click to add a ${meta.label.toLowerCase()}; with the map focused, press Enter to add one at the centre.`}
              pickHint={`Arrow keys move the map, plus and minus zoom, Enter adds a ${meta.label.toLowerCase()} at the centre cross-hair.`}
              cellState={result?.cellState ?? null}
              points={points}
              pins={pins}
              onCellHover={setHover}
              onPick={addAt}
            >
              <HoverCard
                title={hover ? hover.dun || hover.area : `Click anywhere to add a ${meta.label.toLowerCase()}`}
                body={
                  hover
                    ? `${hoverStatus}\nThis 100 m cell: ${hover.p65.toFixed(1)} residents 65+ of ${hover.pop.toFixed(0)}`
                    : 'Drag to pan, scroll or + − to zoom. Remove a site with × in the list.'
                }
              />
            </AtlasMap>
          </div>
        </section>

        <aside aria-label="Results" className="col panel-aside" style={{ flex: '1 1 320px', maxWidth: 380, gap: 16 }}>
          <section className="card" aria-live="polite">
            <h2 className="eyebrow">Residents 65+ within reach</h2>
            <p className="small" style={{ margin: '4px 0 14px' }}>
              {meta.label} · {thrLabel}
            </p>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 10 }}>
              <div style={{ background: '#F6F5F1', borderRadius: 10, padding: 14 }}>
                <p style={{ margin: 0, fontSize: 11, fontWeight: 700, letterSpacing: '0.06em', color: '#5A5A55' }}>TODAY</p>
                <p style={{ margin: '6px 0 0', fontWeight: 800, fontSize: 30 }}>{result ? `${((result.baseIn / tot) * 100).toFixed(1)}%` : '…'}</p>
                <p style={{ margin: '2px 0 0', fontSize: 13, color: '#44443F' }}>{result ? `${fmt(result.baseIn)} people` : ''}</p>
              </div>
              <div style={{ background: '#EEF4FC', borderRadius: 10, padding: 14 }}>
                <p style={{ margin: 0, fontSize: 11, fontWeight: 700, letterSpacing: '0.06em', color: '#1C5CAB' }}>WITH YOUR PLAN</p>
                <p style={{ margin: '6px 0 0', fontWeight: 800, fontSize: 30, color: '#0D366B' }}>
                  {result ? `${((result.afterIn / tot) * 100).toFixed(1)}%` : '…'}
                </p>
                <p style={{ margin: '2px 0 0', fontSize: 13, color: '#44443F' }}>{result ? `${fmt(result.afterIn)} people` : ''}</p>
              </div>
            </div>
            <div
              aria-hidden="true"
              style={{ marginTop: 14, height: 14, background: '#F3F2EE', borderRadius: 3, display: 'flex', overflow: 'hidden' }}
            >
              <div style={{ height: '100%', background: '#86B6EF', width: `${result ? ((result.baseIn / tot) * 100).toFixed(2) : 0}%` }} />
              <div style={{ height: '100%', background: '#0D366B', width: `${result ? ((result.gain / tot) * 100).toFixed(2) : 0}%` }} />
            </div>
            <p style={{ margin: '12px 0 0', fontSize: 22, fontWeight: 800, color: '#0D366B' }}>
              {placed.length ? `+${fmt(result?.gain ?? 0)} residents 65+` : 'Click the map to add one'}
            </p>
            <p style={{ margin: '2px 0 0', fontSize: 13, color: '#44443F' }}>
              {result
                ? `Average for residents 65+: ${result.baseAvg.toFixed(dec)}${unit} today${placed.length ? ` → ${result.afterAvg.toFixed(dec)}${unit}` : ''}`
                : ''}
            </p>
          </section>

          <section className="card">
            <h2 className="eyebrow" style={{ marginBottom: 12 }}>
              Gains by constituency
            </h2>
            {gains.length === 0 && <p className="small" style={{ margin: 0 }}>Add a facility to see which DUNs gain.</p>}
            {gains.map(([dun, n]) => (
              <div
                key={dun}
                style={{ display: 'grid', gridTemplateColumns: '110px minmax(0, 1fr) 54px', alignItems: 'center', gap: 8, fontSize: 13, marginBottom: 8 }}
              >
                <span>{dun}</span>
                <div style={{ height: 12, background: '#F3F2EE', borderRadius: 2 }}>
                  <div style={{ height: '100%', borderRadius: 2, background: '#1C5CAB', width: `${((n / gmax) * 100).toFixed(1)}%` }} />
                </div>
                <strong className="tabular" style={{ textAlign: 'right' }}>
                  +{fmt(n)}
                </strong>
              </div>
            ))}
          </section>

          <section className="card">
            <h2 className="eyebrow" style={{ marginBottom: 8 }}>
              Model check against the notebook
            </h2>
            <p style={{ margin: '0 0 10px', fontSize: 13, lineHeight: 1.5, color: '#44443F' }}>
              {chk.routed != null
                ? 'Today’s share from this model, next to the notebook’s street-routed figure for the same threshold.'
                : 'Care homes have no routed curve in the notebook, so this uses the average detour of the clinic and hospital fits. Treat care-home results as indicative.'}
            </p>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 8, fontSize: 13 }}>
              <div style={{ background: '#F6F5F1', borderRadius: 8, padding: 10 }}>
                <span style={{ color: '#5A5A55' }}>This model</span>
                <br />
                <strong style={{ fontSize: 18 }}>{chk.model != null ? `${chk.model.toFixed(1)}%` : '—'}</strong>
              </div>
              <div style={{ background: '#F6F5F1', borderRadius: 8, padding: 10 }}>
                <span style={{ color: '#5A5A55' }}>Notebook, routed</span>
                <br />
                <strong style={{ fontSize: 18 }}>{chk.routed != null ? `${chk.routed.toFixed(1)}%` : 'not printed'}</strong>
              </div>
            </div>
            <p className="note" style={{ margin: '10px 0 0' }}>
              Distance from each 100 m cell to the nearest facility, times a street-detour factor fitted to the notebook's routed results.
              Population: Meta 30 m layer scaled to 2026; 65+ shares: Census 2020.
            </p>
            {D && <KnownLimits D={D} />}
          </section>
        </aside>
      </div>
    </main>
  );
}
