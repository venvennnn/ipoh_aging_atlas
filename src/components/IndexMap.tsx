import { useMemo, useState } from 'react';
import AtlasMap from '../map/AtlasMap';
import type { AtlasData, Stats } from '../lib/types';
import { RampLegend, ToggleGroup } from './ui';

const LAYERS = [
  { key: 'index', label: 'Overall', img: 'index' },
  { key: 'money', label: 'Money', img: 'd_money' },
  { key: 'health', label: 'Health', img: 'd_health' },
  { key: 'care', label: 'Care', img: 'd_care' },
  { key: 'social', label: 'Social', img: 'd_social' },
  { key: 'access', label: 'Access', img: 'd_access' },
] as const;
type Key = (typeof LAYERS)[number]['key'];

/** Vulnerability index raster (overall or one domain) with DUN outlines, on a zoomable street map. */
export default function IndexMap({ atlas, stats }: { atlas: AtlasData | null; stats: Stats }) {
  const [k, setK] = useState<Key>('index');
  const cur = LAYERS.find((l) => l.key === k)!;
  const meta = stats.rasters.layers[cur.img];
  const stops = stats.rasters.ramps[meta.ramp];
  const raster = useMemo(() => ({ url: `/img/${cur.img}.png`, opacity: 0.85 }), [cur.img]);
  return (
    <>
      <ToggleGroup label="Index layer" options={LAYERS.map((l) => ({ key: l.key, label: l.label }))} value={k} onChange={setK} />
      <div className="map-wrap" style={{ marginTop: 12 }}>
        <AtlasMap
          D={atlas}
          raster={raster}
          dunOutlines
          label={`Zoomable street map of the ${k === 'index' ? 'overall index' : `${cur.label} domain`} score across Ipoh, 0 better to 100 worse, with constituency outlines`}
        />
      </div>
      <RampLegend lo={`${meta.min} better`} hi={`${meta.max} worse`} stops={stops} unit="thin lines = DUNs" />
    </>
  );
}
