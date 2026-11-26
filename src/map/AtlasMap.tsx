import maplibregl, { type ExpressionSpecification, type Map as MlMap } from 'maplibre-gl';
import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { CELL_NEW, CELL_OUT, CELL_TODAY } from '../engine/core';
import type { AtlasData, Facility } from '../lib/types';
import { boundaryGeoJSON, cellsGeoJSON, outsideGeoJSON, dunGeoJSON, dunLabelGeoJSON, pointsGeoJSON, rasterCorners, type FC } from './geo';
import { ZoomMap, ensureLayer, onHover, pinElement, setVisible, upsertGeoJSON, upsertImage } from './ZoomMap';

export const STATUS_COLORS = { today: '#86B6EF', gain: '#1FA98A', out: '#E89A1C' };

export interface CellProps {
  p65: number;
  pop: number;
  pct: number;
  hex: number;
  dun?: string | null;
  area: string;
  /** Cell index (feature id). */
  id: number;
}

export interface Pin {
  lon: number;
  lat: number;
  n: number;
  color: string;
  label: string;
}

// Cell polygons are built once per data file and shared by every map.
const cellCache = new WeakMap<AtlasData, FC>();
function cellsFor(D: AtlasData) {
  let fc = cellCache.get(D);
  if (!fc) {
    fc = cellsGeoJSON(D.cells, D.hex);
    cellCache.set(D, fc);
  }
  return fc;
}

/**
 * Zoomable map of Ipoh on an OpenStreetMap basemap. Every overlay is optional:
 * a notebook raster, population cells (coloured by value or by access status),
 * DUN polygons, facility points and numbered pins.
 */
export default function AtlasMap({
  D,
  label,
  cooperative = true,
  height,
  raster,
  cellColor,
  cellState,
  dunFill,
  dunOutlines,
  dunLabels,
  points,
  pins,
  onCellHover,
  onPointHover,
  onDunHover,
  onPick,
  pickHint,
  children,
}: {
  D: AtlasData | null;
  label: string;
  cooperative?: boolean;
  height?: number | string;
  raster?: { url: string; opacity?: number } | null;
  /** Value colouring for cells (a MapLibre expression on the cell's properties). */
  cellColor?: ExpressionSpecification | null;
  /** Access status per cell (CELL_TODAY / CELL_NEW / CELL_OUT). */
  cellState?: Uint8Array | null;
  /** DUN name → fill colour. */
  dunFill?: Record<string, string> | null;
  dunOutlines?: boolean;
  /** DUN name → label colour; shows name and income. */
  dunLabels?: Record<string, string> | null;
  points?: { list: Facility[]; color: string; radius: number; strokeWidth: number } | null;
  pins?: Pin[];
  onCellHover?: (c: CellProps | null) => void;
  onPointHover?: (name: string | null) => void;
  onDunHover?: (name: string | null) => void;
  /** Click (or Enter at the centre cross-hair) adds a point here. */
  onPick?: (lon: number, lat: number) => void;
  pickHint?: string;
  children?: ReactNode;
}) {
  const [map, setMap] = useState<MlMap | null>(null);
  const markers = useRef<maplibregl.Marker[]>([]);
  const prevState = useRef<Uint8Array | null>(null);
  const cb = useRef({ onCellHover, onPointHover, onDunHover, onPick });
  cb.current = { onCellHover, onPointHover, onDunHover, onPick };

  // Static layers, added once the style has loaded and the data is here.
  useEffect(() => {
    if (!map || !D) return;
    upsertGeoJSON(map, 'cells', cellsFor(D));
    upsertGeoJSON(map, 'duns', dunGeoJSON(D));
    upsertGeoJSON(map, 'dun-labels', dunLabelGeoJSON(D));
    upsertGeoJSON(map, 'city', boundaryGeoJSON(D));
    upsertGeoJSON(map, 'outside', outsideGeoJSON(D));
    upsertGeoJSON(map, 'points', { type: 'FeatureCollection', features: [] });

    ensureLayer(map, { id: 'dun-fill', type: 'fill', source: 'duns', paint: { 'fill-color': '#CDE2FB', 'fill-opacity': 0.72 } });
    ensureLayer(map, { id: 'cells-value', type: 'fill', source: 'cells', paint: { 'fill-color': '#F8B48C', 'fill-opacity': 0.78, 'fill-antialias': false } });
    ensureLayer(map, {
      id: 'cells-status',
      type: 'fill',
      source: 'cells',
      paint: {
        'fill-antialias': false,
        'fill-color': [
          'match',
          ['coalesce', ['feature-state', 's'], -1],
          CELL_NEW,
          STATUS_COLORS.gain,
          CELL_TODAY,
          STATUS_COLORS.today,
          'rgba(0,0,0,0)',
        ],
        'fill-opacity': ['match', ['coalesce', ['feature-state', 's'], -1], CELL_NEW, 0.72, CELL_TODAY, 0.3, 0],
      },
    });
    ensureLayer(map, {
      id: 'cells-out',
      type: 'fill',
      source: 'cells',
      paint: { 'fill-antialias': false, 'fill-pattern': 'hatch', 'fill-opacity': ['case', ['==', ['coalesce', ['feature-state', 's'], -1], CELL_OUT], 0.75, 0] },
    });
    ensureLayer(map, { id: 'dun-line', type: 'line', source: 'duns', paint: { 'line-color': '#15181D', 'line-width': 0.9, 'line-opacity': 0.5 } });
    ensureLayer(map, { id: 'outside', type: 'fill', source: 'outside', paint: { 'fill-color': '#FFFFFF', 'fill-opacity': 0.55 } });
    ensureLayer(map, { id: 'city-line', type: 'line', source: 'city', paint: { 'line-color': '#15181D', 'line-width': 1.8 } });
    ensureLayer(
      map,
      {
        id: 'points',
        type: 'circle',
        source: 'points',
        paint: { 'circle-color': '#15181D', 'circle-radius': 6, 'circle-stroke-color': '#FFFFFF', 'circle-stroke-width': 2 },
      },
      null,
    );
    ensureLayer(
      map,
      {
        id: 'dun-label',
        type: 'symbol',
        source: 'dun-labels',
        layout: {
          'text-field': ['get', 'label'],
          'text-font': ['Noto Sans Bold'],
          'text-size': ['interpolate', ['linear'], ['zoom'], 10, 10, 13, 13],
          'text-allow-overlap': false,
        },
        paint: { 'text-color': '#15181D', 'text-halo-color': 'rgba(255,255,255,0.6)', 'text-halo-width': 1 },
      },
      null,
    );

    const off = [
      onHover(map, 'cells-value', (f) => cb.current.onCellHover?.(f ? ({ ...f.properties, id: Number(f.id) } as CellProps) : null)),
      onHover(map, 'cells-status', (f) => cb.current.onCellHover?.(f ? ({ ...f.properties, id: Number(f.id) } as CellProps) : null)),
      onHover(map, 'points', (f) => cb.current.onPointHover?.(f ? String(f.properties.name || 'Unnamed') : null)),
      onHover(map, 'dun-fill', (f) => cb.current.onDunHover?.(f ? String(f.properties.name) : null)),
    ];
    const click = (e: maplibregl.MapMouseEvent) => cb.current.onPick?.(e.lngLat.lng, e.lngLat.lat);
    const key = (e: KeyboardEvent) => {
      if (e.key === 'Enter' && cb.current.onPick) {
        e.preventDefault();
        const c = map.getCenter();
        cb.current.onPick(c.lng, c.lat);
      }
    };
    map.on('click', click);
    map.getCanvas().addEventListener('keydown', key);
    return () => {
      off.forEach((f) => f());
      map.off('click', click);
      map.getCanvas().removeEventListener('keydown', key);
    };
  }, [map, D]);

  // Raster overlay
  useEffect(() => {
    if (!map || !D) return;
    if (raster) {
      upsertImage(map, 'raster-src', raster.url, rasterCorners(D.bounds));
      if (!map.getLayer('raster')) {
        // Created on first use, under the DUN and cell layers.
        ensureLayer(map, { id: 'raster', type: 'raster', source: 'raster-src', paint: { 'raster-opacity': 0.85, 'raster-fade-duration': 0 } }, 'dun-fill');
      }
      map.setPaintProperty('raster', 'raster-opacity', raster.opacity ?? 0.85);
    }
    setVisible(map, 'raster', !!raster);
  }, [map, D, raster?.url, raster?.opacity]); // eslint-disable-line react-hooks/exhaustive-deps

  // Value-coloured cells
  useEffect(() => {
    if (!map || !D) return;
    if (cellColor) map.setPaintProperty('cells-value', 'fill-color', cellColor);
    setVisible(map, 'cells-value', !!cellColor);
  }, [map, D, cellColor]);

  // Status-coloured cells (feature-state; only changed cells are touched)
  useEffect(() => {
    if (!map || !D) return;
    const on = !!cellState;
    setVisible(map, 'cells-status', on);
    setVisible(map, 'cells-out', on);
    if (!cellState) return;
    const prev = prevState.current;
    for (let i = 0; i < cellState.length; i++) {
      if (!prev || prev[i] !== cellState[i]) map.setFeatureState({ source: 'cells', id: i }, { s: cellState[i] });
    }
    prevState.current = cellState;
  }, [map, D, cellState]);

  // DUN fill, outlines, labels
  const fillExpr = useMemo<ExpressionSpecification | null>(() => {
    if (!dunFill) return null;
    const m: unknown[] = ['match', ['get', 'name']];
    Object.entries(dunFill).forEach(([k, v]) => m.push(k, v));
    m.push('#CDE2FB');
    return m as ExpressionSpecification;
  }, [dunFill]);
  const inkExpr = useMemo<ExpressionSpecification | null>(() => {
    if (!dunLabels) return null;
    const m: unknown[] = ['match', ['get', 'name']];
    Object.entries(dunLabels).forEach(([k, v]) => m.push(k, v));
    m.push('#15181D');
    return m as ExpressionSpecification;
  }, [dunLabels]);
  const haloExpr = useMemo<ExpressionSpecification | null>(() => {
    if (!dunLabels) return null;
    const m: unknown[] = ['match', ['get', 'name']];
    Object.entries(dunLabels).forEach(([k, v]) => m.push(k, v === '#FFFFFF' ? 'rgba(13,54,107,0.55)' : 'rgba(255,255,255,0.6)'));
    m.push('rgba(255,255,255,0.6)');
    return m as ExpressionSpecification;
  }, [dunLabels]);
  useEffect(() => {
    if (!map || !D) return;
    if (fillExpr) map.setPaintProperty('dun-fill', 'fill-color', fillExpr);
    setVisible(map, 'dun-fill', !!fillExpr);
    setVisible(map, 'dun-line', !!dunOutlines || !!fillExpr);
    map.setPaintProperty('dun-line', 'line-color', fillExpr ? '#FFFFFF' : '#15181D');
    map.setPaintProperty('dun-line', 'line-width', fillExpr ? 2 : 0.9);
    map.setPaintProperty('dun-line', 'line-opacity', fillExpr ? 1 : 0.5);
    if (inkExpr && haloExpr) {
      map.setPaintProperty('dun-label', 'text-color', inkExpr);
      map.setPaintProperty('dun-label', 'text-halo-color', haloExpr);
    }
    setVisible(map, 'dun-label', !!inkExpr);
  }, [map, D, fillExpr, dunOutlines, inkExpr, haloExpr]);

  // Facility points
  useEffect(() => {
    if (!map) return;
    upsertGeoJSON(map, 'points', points ? pointsGeoJSON(points.list) : { type: 'FeatureCollection', features: [] });
    if (points) {
      map.setPaintProperty('points', 'circle-color', points.color);
      map.setPaintProperty('points', 'circle-radius', ['interpolate', ['linear'], ['zoom'], 10, points.radius * 0.75, 14, points.radius * 1.4]);
      map.setPaintProperty('points', 'circle-stroke-width', points.strokeWidth);
    }
  }, [map, points]);

  // Numbered pins
  useEffect(() => {
    if (!map) return;
    markers.current.forEach((m) => m.remove());
    markers.current = (pins ?? []).map((p) => new maplibregl.Marker({ element: pinElement(p.n, p.color, p.label) }).setLngLat([p.lon, p.lat]).addTo(map));
  }, [map, pins]);

  return (
    <ZoomMap bounds={D?.bounds ?? [101.0, 4.51, 101.26, 4.79]} label={label} cooperative={cooperative} onMap={setMap} height={height} className={onPick ? 'pick' : undefined}>
      {onPick && (
        <>
          <span className="map-crosshair" aria-hidden="true" />
          {pickHint && <span className="sr-only">{pickHint}</span>}
        </>
      )}
      {children}
    </ZoomMap>
  );
}
