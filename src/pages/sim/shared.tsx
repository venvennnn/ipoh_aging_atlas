import { THRESHOLDS, checkFor, type Mode } from '../../engine/core';
import { fmt } from '../../lib/format';
import { STATUS_COLORS } from '../../map/AtlasMap';
import type { AtlasData, FacType } from '../../lib/types';
import { ToggleGroup } from '../../components/ui';

export const TYPE_META: Record<FacType, { label: string; color: string }> = {
  clinic: { label: 'Public clinic', color: '#1C5CAB' },
  hospital: { label: 'Hospital', color: '#0D366B' },
  care: { label: 'Care home', color: '#B9461A' },
  bus: { label: 'Bus stop', color: '#44443F' },
};

/** How existing facilities of a type are drawn on the map. */
export const existingStyle = (type: FacType) =>
  type === 'bus' ? { color: '#15181D', radius: 3, strokeWidth: 1 } : { color: '#15181D', radius: 6, strokeWidth: 2 };

export function MapKeys({ recommended }: { recommended?: boolean }) {
  return (
    <div className="keys">
      <span>
        <span className="swatch" style={{ background: STATUS_COLORS.today, opacity: 0.6 }} />
        Within reach today
      </span>
      <span>
        <span className="swatch" style={{ background: STATUS_COLORS.gain }} />
        Newly in reach
      </span>
      <span>
        <span
          className="swatch"
          style={{ background: `repeating-linear-gradient(45deg, ${STATUS_COLORS.out} 0 3px, transparent 3px 6px)`, border: `1px solid ${STATUS_COLORS.out}` }}
        />
        Still out of reach
      </span>
      <span>
        <span className="swatch dot" style={{ width: 10, height: 10, background: '#15181D' }} />
        Existing
      </span>
      {recommended && (
        <span>
          <span className="swatch dot" style={{ background: '#B9461A' }} />
          Recommended
        </span>
      )}
    </div>
  );
}

/** Walking/driving switch (hidden for bus stops) plus the threshold pills. */
export function ReachControls({
  type,
  mode,
  onMode,
  ti,
  onThreshold,
}: {
  type: FacType;
  mode: Mode;
  onMode: (m: 'walk' | 'drive') => void;
  ti: number;
  onThreshold: (i: number) => void;
}) {
  const list = THRESHOLDS[mode];
  return (
    <>
      {type !== 'bus' && (
        <ToggleGroup
          label="Travel mode"
          className="segmented"
          buttonClass=""
          options={[
            { key: 'walk', label: 'Walking' },
            { key: 'drive', label: 'Driving' },
          ]}
          value={mode === 'drive' ? 'drive' : 'walk'}
          onChange={onMode}
        />
      )}
      <div role="group" aria-label="Threshold" className="toggle-row">
        {list.map(([, label], i) => (
          <button key={label} type="button" className="pill-btn" aria-pressed={i === ti} onClick={() => onThreshold(i)}>
            {label}
          </button>
        ))}
      </div>
    </>
  );
}

export function modelCheck(D: AtlasData, type: FacType, mode: Mode, ti: number) {
  return checkFor(D.calib, type, mode, ti);
}

/** The known limits of the simulators, stated on the page. Numbers come from calib.check. */
export function KnownLimits({ D }: { D: AtlasData }) {
  const h = D.calib.check.hospital;
  const k = D.calib.types;
  return (
    <p className="note" style={{ margin: '10px 0 0' }}>
      <strong style={{ color: '#2C2C29' }}>Known limits.</strong> Travel times are straight-line distance times a street-detour factor
      (walking k = {k.clinic.k} clinic, {k.hospital.k} hospital, {k.bus.k} bus stop), fitted to the notebook's routed results. They are not
      true street routes.
      {h.drive && h.drive_routed
        ? ` Hospital within a 5-minute drive fits poorly: ${h.drive[0].toFixed(1)}% model vs ${h.drive_routed[0].toFixed(1)}% routed.`
        : ''}{' '}
      Care homes have no routed curve, so they use the mean of the clinic and hospital fits (k = {k.care.k}); treat care-home results as
      indicative.
    </p>
  );
}

export const plural = (n: number, one: string, many = `${one}s`) => `${fmt(n)} ${n === 1 ? one : many}`;
