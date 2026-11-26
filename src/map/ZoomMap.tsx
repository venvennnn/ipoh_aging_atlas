import maplibregl, { type LayerSpecification, type Map as MlMap, type MapGeoJSONFeature } from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import type { FC, LngLat } from './geo';

/** Free OpenStreetMap basemap, no API key (https://openfreemap.org). */
export const BASEMAP_STYLE = 'https://tiles.openfreemap.org/styles/positron';
/** Data layers go under the basemap's labels so place names stay readable. */
export const BELOW_LABELS = 'waterway_line_label';

type Bounds = [number, number, number, number];

/**
 * A zoomable street map fitted to Ipoh. `onMap` receives the map once its style
 * has loaded; pages add their sources and layers with the helpers below.
 */
export function ZoomMap({
  bounds,
  label,
  cooperative = false,
  onMap,
  children,
  height,
  className,
}: {
  bounds: Bounds;
  label: string;
  /** Require Ctrl/⌘ + scroll (two fingers on touch) to zoom, so the page still scrolls. */
  cooperative?: boolean;
  onMap: (map: MlMap | null) => void;
  children?: ReactNode;
  height?: number | string;
  className?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const onMapRef = useRef(onMap);
  onMapRef.current = onMap;
  const [failed, setFailed] = useState(false);
  // Create the map only once it is near the screen: the overview has many maps,
  // and each one holds a WebGL context.
  const [near, setNear] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el || near) return;
    if (typeof IntersectionObserver === 'undefined') return setNear(true);
    const io = new IntersectionObserver((es) => es.some((e) => e.isIntersecting) && setNear(true), { rootMargin: '400px 0px' });
    io.observe(el);
    return () => io.disconnect();
  }, [near]);

  useEffect(() => {
    if (!ref.current || !near) return;
    const [lon0, lat0, lon1, lat1] = bounds;
    const padLon = (lon1 - lon0) * 0.6;
    const padLat = (lat1 - lat0) * 0.6;
    const map = new maplibregl.Map({
      container: ref.current,
      style: BASEMAP_STYLE,
      bounds: [lon0, lat0, lon1, lat1],
      fitBoundsOptions: { padding: 8 },
      maxBounds: [lon0 - padLon, lat0 - padLat, lon1 + padLon, lat1 + padLat],
      minZoom: 9,
      maxZoom: 17.5,
      dragRotate: false,
      pitchWithRotate: false,
      touchPitch: false,
      cooperativeGestures: cooperative,
      attributionControl: { compact: true },
    });
    map.touchZoomRotate.disableRotation();
    map.keyboard.disableRotation();
    map.addControl(new maplibregl.NavigationControl({ showCompass: false }), 'top-right');
    map.getCanvas().setAttribute('aria-label', label);
    let live = true;
    map.on('load', () => {
      if (!live) return;
      // Start with the (compact) credits collapsed so they don't cover the map on phones.
      ref.current?.querySelector('.maplibregl-ctrl-attrib')?.classList.remove('maplibregl-compact-show');
      ensureHatch(map);
      onMapRef.current(map);
    });
    map.on('error', (e) => {
      // A missing basemap tile is not fatal; a style that never loads is.
      if (!map.isStyleLoaded() && String(e.error?.message ?? '').match(/style|Failed to fetch/i)) setFailed(true);
    });
    return () => {
      live = false;
      onMapRef.current(null);
      map.remove();
    };
    // The map is created once per mount, when it first comes near the screen.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [near]);

  useEffect(() => {
    const c = ref.current?.querySelector('canvas');
    if (c) c.setAttribute('aria-label', label);
  }, [label]);

  return (
    <div className={`zoom-map${className ? ` ${className}` : ''}`} style={{ height }}>
      <div ref={ref} className="zoom-map-canvas" role="region" aria-label={label} />
      {failed && (
        <p className="map-overlay" role="alert">
          The street map could not load. Check your connection and reload the page.
        </p>
      )}
      {children}
    </div>
  );
}

/** Track the loaded map in React state. */
export function useMapState() {
  return useState<MlMap | null>(null);
}

// ------------------------------------------------------------------ helpers

export function upsertGeoJSON(map: MlMap, id: string, data: FC) {
  const src = map.getSource(id) as maplibregl.GeoJSONSource | undefined;
  if (src) src.setData(data as GeoJSON.FeatureCollection);
  else map.addSource(id, { type: 'geojson', data: data as GeoJSON.FeatureCollection });
}

export function upsertImage(map: MlMap, id: string, url: string, corners: [LngLat, LngLat, LngLat, LngLat]) {
  const src = map.getSource(id) as maplibregl.ImageSource | undefined;
  if (src) src.updateImage({ url, coordinates: corners });
  else map.addSource(id, { type: 'image', url, coordinates: corners });
}

/** Add a layer once (below the basemap labels unless `before` is given). */
export function ensureLayer(map: MlMap, spec: LayerSpecification, before: string | null = BELOW_LABELS) {
  if (map.getLayer(spec.id)) return;
  map.addLayer(spec, before && map.getLayer(before) ? before : undefined);
}

export function setVisible(map: MlMap, id: string, on: boolean) {
  if (map.getLayer(id)) map.setLayoutProperty(id, 'visibility', on ? 'visible' : 'none');
}

/** Call `cb` with the hovered feature of a layer (null on leave). Returns a cleanup. */
export function onHover(map: MlMap, layer: string, cb: (f: MapGeoJSONFeature | null) => void) {
  const move = (e: maplibregl.MapLayerMouseEvent) => {
    map.getCanvas().style.cursor = 'pointer';
    cb(e.features?.[0] ?? null);
  };
  const leave = () => {
    map.getCanvas().style.cursor = '';
    cb(null);
  };
  map.on('mousemove', layer, move);
  map.on('mouseleave', layer, leave);
  return () => {
    map.off('mousemove', layer, move);
    map.off('mouseleave', layer, leave);
  };
}

/** Orange diagonal hatching for "still out of reach". */
function ensureHatch(map: MlMap) {
  if (map.hasImage('hatch')) return;
  const s = 10;
  const data = new Uint8ClampedArray(s * s * 4);
  for (let y = 0; y < s; y++)
    for (let x = 0; x < s; x++) {
      const on = (x + y) % s < 4;
      const i = (y * s + x) * 4;
      data[i] = 0xe8;
      data[i + 1] = 0x9a;
      data[i + 2] = 0x1c;
      data[i + 3] = on ? 255 : 0;
    }
  map.addImage('hatch', { width: s, height: s, data }, { pixelRatio: 2 });
}

/** Numbered pin marker element. */
export function pinElement(n: number, color: string, label: string) {
  const el = document.createElement('div');
  el.className = 'map-pin';
  el.style.background = color;
  el.textContent = String(n);
  el.setAttribute('role', 'img');
  el.setAttribute('aria-label', label);
  return el;
}
