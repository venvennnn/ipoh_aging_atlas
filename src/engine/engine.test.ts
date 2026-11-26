// Engine tests on the real data files in public/data/. No synthetic data.
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { beforeAll, describe, expect, it } from 'vitest';
import type { AtlasData, FacType, Stats } from '../lib/types';
import {
  THRESHOLDS,
  baselineShare,
  engineInputFrom,
  evaluatePlacement,
  optimiseAll,
  prepare,
  type Engine,
  type Mode,
} from './core';

const root = resolve(__dirname, '../..');
const atlas = JSON.parse(readFileSync(resolve(root, 'public/data/ipoh_data_v2.json'), 'utf8')) as AtlasData;
const stats = JSON.parse(readFileSync(resolve(root, 'public/data/stats.json'), 'utf8')) as Stats;

let E: Engine;
beforeAll(() => {
  E = prepare(engineInputFrom(atlas, stats.index.dun));
});

describe('baseline reproduces calib.check (model values, within 0.1 pt)', () => {
  const cases: [FacType, Mode, number][] = [
    ['clinic', 'walk', 0],
    ['clinic', 'walk', 1],
    ['clinic', 'walk', 2],
    ['clinic', 'drive', 0],
    ['clinic', 'drive', 1],
    ['clinic', 'drive', 2],
    ['hospital', 'walk', 0],
    ['hospital', 'walk', 1],
    ['hospital', 'walk', 2],
    ['hospital', 'drive', 0],
    ['hospital', 'drive', 1],
    ['hospital', 'drive', 2],
    ['bus', 'bus', 0],
    ['bus', 'bus', 1],
  ];
  it.each(cases)('%s %s threshold #%i', (type, mode, ti) => {
    const thr = THRESHOLDS[mode][ti][0];
    const key = mode === 'bus' ? 'walk' : mode;
    const expected = atlas.calib.check[type][key]![ti];
    expect(Math.abs(baselineShare(E, type, mode, thr) - expected)).toBeLessThanOrEqual(0.1);
  });
});

describe('optimiser acceptance check (clinic, walk, 30 min, N = 3, cover)', () => {
  it('gives 27.2% → 34.6%, +5,478, picks in Simpang Pulai, Canning, Canning', () => {
    const r = optimiseAll(E, { type: 'clinic', mode: 'walk', thr: 30, n: 3, goal: 'cover', dun: 'all' });
    expect(r.baseCov.toFixed(1)).toBe('27.2');
    expect(r.finalCov.toFixed(1)).toBe('34.6');
    expect(Math.round(r.added)).toBe(5478);
    expect(r.picks.map((p) => atlas.hex[p.hex].dun)).toEqual(['Simpang Pulai', 'Canning', 'Canning']);
    expect(r.candidates).toBe(841);
  });

  it('runs N = 20 quickly', () => {
    const t0 = performance.now();
    const r = optimiseAll(E, { type: 'clinic', mode: 'walk', thr: 30, n: 20, goal: 'cover', dun: 'all' });
    const ms = performance.now() - t0;
    expect(r.picks.length).toBe(20);
    expect(ms).toBeLessThan(4000);
  });
});

describe('adding a site never lowers coverage', () => {
  // Sites are hexagon centres from the data file, not invented points.
  const sites = [0, 100, 250, 420, 600, 840].map((j) => ({ lon: atlas.hex[j].lon, lat: atlas.hex[j].lat }));
  const settings: [FacType, Mode, number][] = [
    ['clinic', 'walk', 30],
    ['hospital', 'drive', 5],
    ['care', 'walk', 15],
    ['bus', 'bus', 400],
  ];
  it.each(settings)('placement: %s %s %i', (type, mode, thr) => {
    let prev = evaluatePlacement(E, { type, mode, thr, sites: [] });
    expect(prev.gain).toBe(0);
    for (let k = 1; k <= sites.length; k++) {
      const next = evaluatePlacement(E, { type, mode, thr, sites: sites.slice(0, k) });
      expect(next.afterIn).toBeGreaterThanOrEqual(prev.afterIn);
      expect(next.afterAvg).toBeLessThanOrEqual(prev.afterAvg + 1e-9);
      expect(next.afterIn).toBeGreaterThanOrEqual(next.baseIn);
      const perSiteSum = next.perSite.reduce((a, b) => a + b, 0);
      expect(perSiteSum).toBeCloseTo(next.gain, 6);
      prev = next;
    }
  });

  it.each(['cover', 'median', 'equity'] as const)('optimiser coverage is non-decreasing (%s)', (goal) => {
    const r = optimiseAll(E, { type: 'clinic', mode: 'drive', thr: 10, n: 5, goal, dun: 'all' });
    let last = r.baseCov;
    for (const p of r.picks) {
      expect(p.cov).toBeGreaterThanOrEqual(last);
      expect(p.gain).toBeGreaterThanOrEqual(0);
      last = p.cov;
    }
  });

  it('DUN restriction keeps every pick inside the DUN', () => {
    const r = optimiseAll(E, { type: 'care', mode: 'walk', thr: 30, n: 3, goal: 'cover', dun: 'Manjoi' });
    for (const p of r.picks) expect(atlas.hex[p.hex].dun).toBe('Manjoi');
  });
});

describe('index explorer', () => {
  it('equal weights reproduce the stored DUN index to within rounding', async () => {
    const { weightedScore } = await import('../lib/indexScore');
    for (const d of stats.index.dun) {
      expect(Math.abs(weightedScore(d, [1, 1, 1, 1, 1]) - d.index)).toBeLessThan(1);
    }
  });
});
