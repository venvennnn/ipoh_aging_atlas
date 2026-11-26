import type { ReactNode } from 'react';
import type { Dun } from '../lib/types';

/** A notebook raster PNG drawn stretched over the full 740×800 frame, with the city boundary on top. */
export default function RasterMap({
  src,
  label,
  boundary,
  opacity = 0.92,
  duns,
  children,
}: {
  src: string;
  label: string;
  boundary: string;
  opacity?: number;
  duns?: Dun[];
  children?: ReactNode;
}) {
  return (
    <svg viewBox="0 0 740 800" role="img" aria-label={label} className="map-svg">
      <image href={src} x={0} y={0} width={740} height={800} preserveAspectRatio="none" opacity={opacity} />
      {duns?.map((d) => (
        <path key={d.code} d={d.d} fill="none" stroke="#15181D" strokeWidth={0.8} strokeOpacity={0.45} />
      ))}
      {boundary && <path d={boundary} fill="none" stroke="#15181D" strokeWidth={1.6} pointerEvents="none" />}
      {children}
    </svg>
  );
}
