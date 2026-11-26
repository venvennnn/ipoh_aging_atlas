// Access engine shared by the Web Worker and the tests.
//
// Travel time is straight-line distance from each 100 m population cell to the
// nearest facility, converted with the calibration stored in the data file:
//   walk minutes      = d * k / walk_speed_km_per_min
//   drive minutes     = drive_access_min + d / s
//   bus street metres = d * k * 1000
// k and s were fitted (pipeline/calib.py) so the existing facilities reproduce
// the notebook's street-routed results. This is NOT true street routing.

import type { Calib, Cells, FacType } from '../lib/types';

export type Mode = 'walk' | 'drive' | 'bus';
export type Goal = 'cover' | 'median' | 'equity';

/** Thresholds offered in the designs, per mode: [value, label]. */
export const THRESHOLDS: Record<Mode, [number, string][]> = {
  walk: [
    [15, '15 min walk'],
    [30, '30 min walk'],
    [45, '45 min walk'],
  ],
  drive: [
    [5, '5 min drive'],
    [10, '10 min drive'],
    [15, '15 min drive'],
  ],
  bus: [
    [400, '400 m walk'],
    [500, '500 m walk'],
  ],
};

/** Bus stops are walking only. */
export const modeFor = (type: FacType, mode: 'walk' | 'drive'): Mode => (type === 'bus' ? 'bus' : mode);

export const unitFor = (mode: Mode) => (mode === 'bus' ? ' m' : ' min');

// Degrees → km, as specified (and as used by the pipeline).
export const KM_PER_DEG_LON = 110.95;
export const KM_PER_DEG_LAT = 110.574;

export interface EngineInput {
  cells: Cells;
  fac: Record<FacType, { n: string; lat: number; lon: number }[]>;
  hex: { lat: number; lon: number; pop: number; dun: string | null; area: string }[];
  calib: Calib;
  /** DUN name → overall index score (stats.index.dun). Used by the "worst-off first" goal. */
  dunIndex: Record<string, number>;
}

export interface Engine {
  input: EngineInput;
  n: number;
  X: Float64Array;
  Y: Float64Array;
  W: Float64Array;
  HX: Int32Array;
  tot: number;
  /** Median of the DUN index scores; the equity weight is index / this. */
  indexMedian: number;
  base: Partial<Record<FacType, Float64Array>>;
}

export function prepare(input: EngineInput): Engine {
  const C = input.cells;
  const n = C.lon.length;
  const X = new Float64Array(n);
  const Y = new Float64Array(n);
  const W = new Float64Array(n);
  const HX = new Int32Array(n);
  let tot = 0;
  for (let i = 0; i < n; i++) {
    X[i] = C.lon[i] * KM_PER_DEG_LON;
    Y[i] = C.lat[i] * KM_PER_DEG_LAT;
    W[i] = C.p65[i];
    HX[i] = C.hex[i];
    tot += W[i];
  }
  const idx = Object.values(input.dunIndex).sort((a, b) => a - b);
  const mid = idx.length >> 1;
  const indexMedian = idx.length === 0 ? 1 : idx.length % 2 ? idx[mid] : (idx[mid - 1] + idx[mid]) / 2;
  return { input, n, X, Y, W, HX, tot, indexMedian, base: {} };
}

/** Straight-line km from every cell to the nearest existing facility of a type (computed once, cached). */
export function baseDistances(E: Engine, type: FacType): Float64Array {
  const cached = E.base[type];
  if (cached) return cached;
  const F = E.input.fac[type];
  const FX = F.map((p) => p.lon * KM_PER_DEG_LON);
  const FY = F.map((p) => p.lat * KM_PER_DEG_LAT);
  const d = new Float64Array(E.n);
  for (let i = 0; i < E.n; i++) {
    let m = Infinity;
    for (let k = 0; k < FX.length; k++) {
      const dx = E.X[i] - FX[k];
      const dy = E.Y[i] - FY[k];
      const v = dx * dx + dy * dy;
      if (v < m) m = v;
    }
    d[i] = Math.sqrt(m);
  }
  E.base[type] = d;
  return d;
}

export function metricFor(calib: Calib, type: FacType, mode: Mode): (d: number) => number {
  const cal = calib.types[type];
  const SP = calib.walk_speed_km_per_min;
  const ACC = calib.drive_access_min;
  if (mode === 'walk') return (d) => (d * cal.k) / SP;
  if (mode === 'drive') {
    if (cal.s == null) throw new Error(`No driving calibration for ${type}`);
    const s = cal.s;
    return (d) => ACC + d / s;
  }
  return (d) => d * cal.k * 1000;
}

/** Largest straight-line km that can still be within `thr` (used only as a pre-filter). */
function reachKm(calib: Calib, type: FacType, mode: Mode, thr: number): number {
  const cal = calib.types[type];
  if (mode === 'walk') return (thr * calib.walk_speed_km_per_min) / cal.k;
  if (mode === 'drive') return Math.max(0, (thr - calib.drive_access_min) * (cal.s ?? 0));
  return thr / (cal.k * 1000);
}

/** Model check value and the notebook's routed value for this setting, if printed. */
export function checkFor(calib: Calib, type: FacType, mode: Mode, ti: number) {
  const chk = calib.check[type];
  const key = mode === 'bus' ? 'walk' : mode;
  const model = chk?.[key]?.[ti] ?? null;
  const routed = chk?.[`${key}_routed` as 'walk_routed' | 'drive_routed']?.[ti] ?? null;
  return { model, routed };
}

/** Share (%) of residents 65+ within the threshold with existing facilities only. */
export function baselineShare(E: Engine, type: FacType, mode: Mode, thr: number): number {
  const metric = metricFor(E.input.calib, type, mode);
  const base = baseDistances(E, type);
  let cov = 0;
  for (let i = 0; i < E.n; i++) if (metric(base[i]) <= thr) cov += E.W[i];
  return (cov / E.tot) * 100;
}

// ---------------------------------------------------------------- Place a facility

export interface PlaceParams {
  type: FacType;
  mode: Mode;
  thr: number;
  sites: { lon: number; lat: number }[];
}

export interface PlaceResult {
  tot: number;
  baseIn: number;
  afterIn: number;
  gain: number;
  baseAvg: number;
  afterAvg: number;
  perSite: number[];
  /** Residents 65+ newly within reach, per hexagon index. */
  hexNew: Float64Array;
  /** [DUN name, residents 65+ newly in reach], largest first. Cells outside every DUN are grouped. */
  gainsByDun: [string, number][];
}

export const OUTSIDE_DUNS = 'Outside DUNs';

export function evaluatePlacement(E: Engine, p: PlaceParams): PlaceResult {
  const metric = metricFor(E.input.calib, p.type, p.mode);
  const base = baseDistances(E, p.type);
  const { n, X, Y, W, HX, tot } = E;
  const PX = p.sites.map((s) => s.lon * KM_PER_DEG_LON);
  const PY = p.sites.map((s) => s.lat * KM_PER_DEG_LAT);
  const hexNew = new Float64Array(E.input.hex.length);
  const perSite = p.sites.map(() => 0);
  let baseIn = 0;
  let afterIn = 0;
  let sumB = 0;
  let sumA = 0;
  for (let i = 0; i < n; i++) {
    const b = base[i];
    let a = b;
    let who = -1;
    for (let k = 0; k < PX.length; k++) {
      const dx = X[i] - PX[k];
      const dy = Y[i] - PY[k];
      const d = Math.sqrt(dx * dx + dy * dy);
      if (d < a) {
        a = d;
        who = k;
      }
    }
    const mb = metric(b);
    const ma = metric(a);
    sumB += W[i] * mb;
    sumA += W[i] * ma;
    if (mb <= p.thr) baseIn += W[i];
    if (ma <= p.thr) {
      afterIn += W[i];
      if (mb > p.thr) {
        hexNew[HX[i]] += W[i];
        if (who >= 0) perSite[who] += W[i];
      }
    }
  }
  const by = new Map<string, number>();
  E.input.hex.forEach((h, j) => {
    if (hexNew[j] > 0) {
      const k = h.dun || OUTSIDE_DUNS;
      by.set(k, (by.get(k) ?? 0) + hexNew[j]);
    }
  });
  const gainsByDun = [...by.entries()].sort((a, b) => b[1] - a[1]);
  return {
    tot,
    baseIn,
    afterIn,
    gain: afterIn - baseIn,
    baseAvg: sumB / tot,
    afterAvg: sumA / tot,
    perSite,
    hexNew,
    gainsByDun,
  };
}

// ---------------------------------------------------------------- Optimiser

export interface OptimiseParams {
  type: FacType;
  mode: Mode;
  thr: number;
  n: number;
  goal: Goal;
  /** DUN name, or 'all'. */
  dun: string;
}

export interface Pick {
  hex: number;
  /** Residents 65+ newly within the threshold from this site. */
  gain: number;
  /** Coverage (%) after this site. */
  cov: number;
  /** 65+-weighted average travel time (or street metres) after this site. */
  avg: number;
  nearN: string;
  nearD: number;
}

export interface OptimiseResult {
  picks: Pick[];
  baseCov: number;
  finalCov: number;
  added: number;
  baseAvg: number;
  finalAvg: number;
  hexNew: Float64Array;
  candidates: number;
}

/**
 * Greedy facility siting. Each step adds the candidate hexagon centre that most
 * improves the goal, keeping every existing facility and earlier pick.
 *  - cover:  maximal covering (residents 65+ newly within the threshold)
 *  - median: p-median on the 65+-weighted travel time
 *  - equity: covering with each cell weighted by its DUN's index / median DUN index
 * Yields after every step so callers can report progress or stop.
 */
export function* optimise(E: Engine, p: OptimiseParams): Generator<Pick, OptimiseResult, void> {
  const { calib, hex, fac } = E.input;
  const metric = metricFor(calib, p.type, p.mode);
  const base = baseDistances(E, p.type);
  const { n, X, Y, W, HX, tot } = E;
  const thr = p.thr;

  const wt = new Float64Array(n);
  const cur = new Float64Array(n);
  const cur2 = new Float64Array(n);
  const curM = new Float64Array(n);
  for (let i = 0; i < n; i++) {
    const dn = hex[HX[i]].dun;
    const idx = dn != null && E.input.dunIndex[dn] != null ? E.input.dunIndex[dn] : E.indexMedian;
    wt[i] = p.goal === 'equity' ? (W[i] * idx) / E.indexMedian : W[i];
    cur[i] = base[i];
    cur2[i] = base[i] * base[i];
    curM[i] = metric(base[i]);
  }

  const cand: number[] = [];
  hex.forEach((h, j) => {
    if (p.dun === 'all' || h.dun === p.dun) cand.push(j);
  });
  const CX = new Float64Array(cand.map((j) => hex[j].lon * KM_PER_DEG_LON));
  const CY = new Float64Array(cand.map((j) => hex[j].lat * KM_PER_DEG_LAT));
  const used = new Uint8Array(cand.length);

  const covered = () => {
    let t = 0;
    for (let q = 0; q < n; q++) if (curM[q] <= thr) t += W[q];
    return t;
  };
  const avg = () => {
    let t = 0;
    for (let q = 0; q < n; q++) t += W[q] * curM[q];
    return t / tot;
  };

  // Pre-filter radius for covering goals (slightly loose; the exact test is metric(d) <= thr).
  const r = reachKm(calib, p.type, p.mode, thr) * (1 + 1e-9) + 1e-12;
  const r2 = r * r;

  const baseCov = covered();
  const baseAvg = avg();
  const picks: Pick[] = [];

  for (let step = 0; step < p.n; step++) {
    let best = -1;
    let bestScore = 0;

    if (p.goal === 'median') {
      for (let a = 0; a < cand.length; a++) {
        if (used[a]) continue;
        const ax = CX[a];
        const ay = CY[a];
        let sc = 0;
        for (let q = 0; q < n; q++) {
          const dx = X[q] - ax;
          const dy = Y[q] - ay;
          const d2 = dx * dx + dy * dy;
          if (d2 >= cur2[q]) continue;
          const d = Math.sqrt(d2);
          if (d >= cur[q]) continue;
          sc += wt[q] * (curM[q] - metric(d));
        }
        if (sc > bestScore) {
          bestScore = sc;
          best = a;
        }
      }
    } else {
      // Only cells still outside the threshold can be gained.
      const open: number[] = [];
      for (let q = 0; q < n; q++) if (curM[q] > thr) open.push(q);
      const OX = new Float64Array(open.length);
      const OY = new Float64Array(open.length);
      const OW = new Float64Array(open.length);
      const OC = new Float64Array(open.length);
      open.forEach((q, i) => {
        OX[i] = X[q];
        OY[i] = Y[q];
        OW[i] = wt[q];
        OC[i] = cur[q];
      });
      for (let a = 0; a < cand.length; a++) {
        if (used[a]) continue;
        const ax = CX[a];
        const ay = CY[a];
        let sc = 0;
        for (let i = 0; i < OX.length; i++) {
          const dx = OX[i] - ax;
          const dy = OY[i] - ay;
          const d2 = dx * dx + dy * dy;
          if (d2 > r2) continue;
          const d = Math.sqrt(d2);
          if (d >= OC[i]) continue;
          if (metric(d) <= thr) sc += OW[i];
        }
        if (sc > bestScore) {
          bestScore = sc;
          best = a;
        }
      }
    }

    if (best < 0) break; // nothing left to gain
    used[best] = 1;
    const before = covered();
    const bx = CX[best];
    const by = CY[best];
    for (let q = 0; q < n; q++) {
      const dx = X[q] - bx;
      const dy = Y[q] - by;
      const d = Math.sqrt(dx * dx + dy * dy);
      if (d < cur[q]) {
        cur[q] = d;
        cur2[q] = d * d;
        curM[q] = metric(d);
      }
    }
    const after = covered();
    const hj = cand[best];
    let nearD = Infinity;
    let nearN = '';
    for (const f of fac[p.type]) {
      const dx = (f.lon - hex[hj].lon) * KM_PER_DEG_LON;
      const dy = (f.lat - hex[hj].lat) * KM_PER_DEG_LAT;
      const d = Math.sqrt(dx * dx + dy * dy);
      if (d < nearD) {
        nearD = d;
        nearN = f.n;
      }
    }
    const pick: Pick = { hex: hj, gain: after - before, cov: (after / tot) * 100, avg: avg(), nearN, nearD };
    picks.push(pick);
    yield pick;
  }

  const hexNew = new Float64Array(hex.length);
  for (let q = 0; q < n; q++) if (curM[q] <= thr && metric(base[q]) > thr) hexNew[HX[q]] += W[q];
  const fin = covered();
  return {
    picks,
    baseCov: (baseCov / tot) * 100,
    finalCov: (fin / tot) * 100,
    added: fin - baseCov,
    baseAvg,
    finalAvg: avg(),
    hexNew,
    candidates: cand.length,
  };
}

/** Run the optimiser to completion (tests, non-worker callers). */
export function optimiseAll(E: Engine, p: OptimiseParams): OptimiseResult {
  const it = optimise(E, p);
  for (;;) {
    const r = it.next();
    if (r.done) return r.value;
  }
}

/** Build the engine input from the two data files. */
export function engineInputFrom(
  atlas: { cells: Cells; fac: EngineInput['fac']; hex: EngineInput['hex']; calib: Calib },
  dunIndexRows: { dun: string; index: number }[],
): EngineInput {
  const dunIndex: Record<string, number> = {};
  for (const r of dunIndexRows) dunIndex[r.dun] = r.index;
  return {
    cells: atlas.cells,
    fac: {
      clinic: atlas.fac.clinic.map(({ n, lat, lon }) => ({ n, lat, lon })),
      hospital: atlas.fac.hospital.map(({ n, lat, lon }) => ({ n, lat, lon })),
      care: atlas.fac.care.map(({ n, lat, lon }) => ({ n, lat, lon })),
      bus: atlas.fac.bus.map(({ n, lat, lon }) => ({ n, lat, lon })),
    },
    hex: atlas.hex.map(({ lat, lon, pop, dun, area }) => ({ lat, lon, pop, dun, area })),
    calib: atlas.calib,
    dunIndex,
  };
}
