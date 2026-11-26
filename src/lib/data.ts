import type { AtlasData, Stats } from './types';

// Bump when a file in public/data changes: the files are served with a long cache.
const DATA_VERSION = '2026-11-26';

let atlasPromise: Promise<AtlasData> | null = null;
let statsPromise: Promise<Stats> | null = null;

async function getJson<T>(url: string): Promise<T> {
  const r = await fetch(`${url}?v=${DATA_VERSION}`);
  if (!r.ok) throw new Error(`Could not load ${url} (HTTP ${r.status})`);
  return (await r.json()) as T;
}

/** The ~850 KB simulation store. Fetched once per page load and shared. */
export function loadAtlas(): Promise<AtlasData> {
  if (!atlasPromise) {
    atlasPromise = getJson<AtlasData>('/data/ipoh_data_v2.json');
    atlasPromise.catch(() => (atlasPromise = null));
  }
  return atlasPromise;
}

/** Headline figures and chart series from the notebook. */
export function loadStats(): Promise<Stats> {
  if (!statsPromise) {
    statsPromise = getJson<Stats>('/data/stats.json');
    statsPromise.catch(() => (statsPromise = null));
  }
  return statsPromise;
}
