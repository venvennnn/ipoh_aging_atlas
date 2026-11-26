// Geometry for the zoomable maps. Everything is derived from ipoh_data_v2.json:
// SVG paths live in a 740×800 frame that maps linearly onto `bounds`, and the
// population cells sit on the pipeline's 100 m grid (handoff/pipeline/cells.py).
import { KM_PER_DEG_LAT, KM_PER_DEG_LON } from '../engine/core';
import type { AtlasData, Cells, Facility } from '../lib/types';

export type LngLat = [number, number];
type Bounds = [number, number, number, number]; // lon0, lat0, lon1, lat1

/** SVG frame point → [lon, lat], using the data file's bounds and frame size. */
export function frameToLngLat(D: Pick<AtlasData, 'W' | 'H' | 'bounds'>, x: number, y: number): LngLat {
  const [lon0, lat0, lon1, lat1] = D.bounds;
  return [lon0 + (x / D.W) * (lon1 - lon0), lat1 - (y / D.H) * (lat1 - lat0)];
}

/** "M x,y L x,y … Z" (one ring, as in the data file) → closed [lon, lat] ring. */
export function pathToRing(D: Pick<AtlasData, 'W' | 'H' | 'bounds'>, d: string): LngLat[] {
  const nums = d.match(/-?\d+(?:\.\d+)?/g) ?? [];
  const ring: LngLat[] = [];
  for (let i = 0; i + 1 < nums.length; i += 2) ring.push(frameToLngLat(D, Number(nums[i]), Number(nums[i + 1])));
  if (ring.length && (ring[0][0] !== ring[ring.length - 1][0] || ring[0][1] !== ring[ring.length - 1][1])) ring.push(ring[0]);
  return ring;
}

/** Image source corners (top-left, top-right, bottom-right, bottom-left) for a raster covering `bounds`. */
export function rasterCorners(bounds: Bounds): [LngLat, LngLat, LngLat, LngLat] {
  const [lon0, lat0, lon1, lat1] = bounds;
  return [
    [lon0, lat1],
    [lon1, lat1],
    [lon1, lat0],
    [lon0, lat0],
  ];
}

const CELL_KM = 0.1;

/** The 100 m grid square a cell's (population-weighted) centre falls in. */
export function cellSquare(lon: number, lat: number): LngLat[] {
  const gx = Math.floor((lon * KM_PER_DEG_LON) / CELL_KM);
  const gy = Math.floor((lat * KM_PER_DEG_LAT) / CELL_KM);
  const x0 = (gx * CELL_KM) / KM_PER_DEG_LON;
  const x1 = ((gx + 1) * CELL_KM) / KM_PER_DEG_LON;
  const y0 = (gy * CELL_KM) / KM_PER_DEG_LAT;
  const y1 = ((gy + 1) * CELL_KM) / KM_PER_DEG_LAT;
  return [
    [x0, y0],
    [x1, y0],
    [x1, y1],
    [x0, y1],
    [x0, y0],
  ];
}

type Props = Record<string, string | number | null>;
type Feature = { type: 'Feature'; id?: number; properties: Props; geometry: { type: 'Polygon'; coordinates: LngLat[][] } | { type: 'Point'; coordinates: LngLat } };
export type FC = { type: 'FeatureCollection'; features: Feature[] };

/** One square polygon per population cell; feature id = cell index (used for feature-state). */
export function cellsGeoJSON(C: Cells, hex: AtlasData['hex']): FC {
  const features: Feature[] = new Array(C.lon.length);
  for (let i = 0; i < C.lon.length; i++) {
    const h = hex[C.hex[i]];
    features[i] = {
      type: 'Feature',
      id: i,
      properties: { p65: C.p65[i], pop: C.pop[i], pct: h.pct, hex: C.hex[i], dun: h.dun, area: h.area },
      geometry: { type: 'Polygon', coordinates: [cellSquare(C.lon[i], C.lat[i])] },
    };
  }
  return { type: 'FeatureCollection', features };
}

export function dunGeoJSON(D: AtlasData): FC {
  return {
    type: 'FeatureCollection',
    features: D.dun.map((d, i) => ({
      type: 'Feature',
      id: i,
      properties: { name: d.name, code: d.code, income: d.income },
      geometry: { type: 'Polygon', coordinates: [pathToRing(D, d.d)] },
    })),
  };
}

/** DUN label points (the data file's label positions). */
export function dunLabelGeoJSON(D: AtlasData): FC {
  return {
    type: 'FeatureCollection',
    features: D.dun.map((d) => ({
      type: 'Feature',
      properties: { name: d.name, income: d.income, label: `${d.name}\nRM${Math.round(d.income).toLocaleString('en-US')}` },
      geometry: { type: 'Point', coordinates: frameToLngLat(D, d.x, d.y) },
    })),
  };
}

export function boundaryGeoJSON(D: AtlasData): FC {
  return { type: 'FeatureCollection', features: [{ type: 'Feature', properties: {}, geometry: { type: 'Polygon', coordinates: [pathToRing(D, D.boundary)] } }] };
}

/** All facilities of a type, including those outside the old 740×800 frame. */
export function pointsGeoJSON(list: Facility[]): FC {
  return {
    type: 'FeatureCollection',
    features: list.map((p, i) => ({ type: 'Feature', id: i, properties: { name: p.n || '' }, geometry: { type: 'Point', coordinates: [p.lon, p.lat] } })),
  };
}

const signedArea = (r: LngLat[]) => r.reduce((a, p, i) => a + (i ? (r[i - 1][0] * p[1] - p[0] * r[i - 1][1]) : 0), 0) / 2;

/** Everything around the city (a wide frame with the city as a hole), used to fade the outside. */
export function outsideGeoJSON(D: AtlasData): FC {
  const [lon0, lat0, lon1, lat1] = D.bounds;
  const outer: LngLat[] = [
    [lon0 - 2, lat0 - 2],
    [lon1 + 2, lat0 - 2],
    [lon1 + 2, lat1 + 2],
    [lon0 - 2, lat1 + 2],
    [lon0 - 2, lat0 - 2],
  ]; // counter-clockwise
  let hole = pathToRing(D, D.boundary);
  if (signedArea(hole) > 0) hole = [...hole].reverse(); // holes run clockwise
  return { type: 'FeatureCollection', features: [{ type: 'Feature', properties: {}, geometry: { type: 'Polygon', coordinates: [outer, hole] } }] };
}
