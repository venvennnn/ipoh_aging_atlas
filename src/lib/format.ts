export const fmt = (n: number) => Math.round(n).toLocaleString('en-US');
export const pct1 = (v: number) => `${v.toFixed(1)}%`;

const hex2 = (h: string) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));

/** Linear interpolation across colour stops; t in [0, 1]. Same as the designs' ramp(). */
export function ramp(stops: string[], t: number): string {
  const x = Math.max(0, Math.min(1, t));
  const m = stops.length - 1;
  const i = Math.min(m - 1, Math.floor(x * m));
  const f = x * m - i;
  const a = hex2(stops[i]);
  const b = hex2(stops[i + 1]);
  return `rgb(${[0, 1, 2].map((k) => Math.round(a[k] + (b[k] - a[k]) * f)).join(',')})`;
}

export const gradient = (stops: string[]) => `linear-gradient(90deg, ${stops.join(', ')})`;

export const inFrame = (p: { x: number; y: number }) => p.x >= 0 && p.x <= 740 && p.y >= 0 && p.y <= 800;

/** SVG viewBox point → lon/lat, as specified for the 740×800 frame. */
export const svgToLonLat = (x: number, y: number) => ({
  lon: 101.0 + (x / 740) * 0.26,
  lat: 4.79 - (y / 800) * 0.28,
});

const lum = (rgb: number[]) => {
  const c = rgb.map((v) => {
    const s = v / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
};
const parse = (c: string) => (c.startsWith('#') ? hex2(c) : (c.match(/\d+/g) ?? ['0', '0', '0']).slice(0, 3).map(Number));
export const contrast = (a: string, b: string) => {
  const [x, y] = [lum(parse(a)), lum(parse(b))].sort((p, q) => q - p);
  return (x + 0.05) / (y + 0.05);
};
/** Pick whichever label colour reads better on a fill. */
export const bestInk = (fill: string, dark = '#15181D', light = '#FFFFFF') =>
  contrast(fill, dark) >= contrast(fill, light) ? dark : light;

/** Signed number with a true minus sign, e.g. −0.07. */
export const signed = (v: number, digits = 2) => (v < 0 ? '−' : '') + Math.abs(v).toFixed(digits);
