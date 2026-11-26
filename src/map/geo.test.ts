// Geometry checks on the real data file: the map layers must sit where the data says.
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import type { AtlasData } from '../lib/types';
import { cellSquare, outsideGeoJSON, pathToRing } from './geo';

const D = JSON.parse(readFileSync(resolve(__dirname, '../../public/data/ipoh_data_v2.json'), 'utf8')) as AtlasData;

describe('map geometry', () => {
  it('hexagon paths convert to rings centred on the hexagon lon/lat', () => {
    for (const h of D.hex.filter((_, i) => i % 50 === 0)) {
      const ring = pathToRing(D, h.d).slice(0, -1);
      const lon = ring.reduce((a, p) => a + p[0], 0) / ring.length;
      const lat = ring.reduce((a, p) => a + p[1], 0) / ring.length;
      expect(Math.abs(lon - h.lon)).toBeLessThan(2e-4);
      expect(Math.abs(lat - h.lat)).toBeLessThan(2e-4);
    }
  });

  it('every population cell lies inside its 100 m square', () => {
    const C = D.cells;
    for (let i = 0; i < C.lon.length; i += 7) {
      const sq = cellSquare(C.lon[i], C.lat[i]);
      expect(C.lon[i]).toBeGreaterThanOrEqual(sq[0][0]);
      expect(C.lon[i]).toBeLessThanOrEqual(sq[1][0]);
      expect(C.lat[i]).toBeGreaterThanOrEqual(sq[0][1]);
      expect(C.lat[i]).toBeLessThanOrEqual(sq[2][1]);
    }
  });

  it('rings are closed and the outside mask has the city as a hole', () => {
    const r = pathToRing(D, D.boundary);
    expect(r[0]).toEqual(r[r.length - 1]);
    const mask = outsideGeoJSON(D).features[0].geometry;
    expect(mask.type).toBe('Polygon');
    expect((mask.coordinates as unknown[]).length).toBe(2);
  });
});
