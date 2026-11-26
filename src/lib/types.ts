// Shapes of the files in public/data/. Field names follow the files exactly.

export type FacType = 'clinic' | 'hospital' | 'care' | 'bus';
export const FAC_TYPES: FacType[] = ['clinic', 'hospital', 'care', 'bus'];

export interface Hex {
  id: string;
  d: string;
  x: number;
  y: number;
  lat: number;
  lon: number;
  pop: number;
  p65: number;
  pct: number;
  area: string;
  dun: string | null;
}

export interface Dun {
  name: string;
  code: string;
  income: number;
  d: string;
  x: number;
  y: number;
}

export interface Facility {
  n: string;
  lat: number;
  lon: number;
  x: number;
  y: number;
}

export interface Cells {
  lon: number[];
  lat: number[];
  p65: number[];
  pop: number[];
  hex: number[];
}

export interface CalibType {
  k: number;
  s: number | null;
}

export interface CalibCheck {
  walk?: number[];
  drive?: number[];
  walk_routed?: number[];
  drive_routed?: number[];
}

export interface Calib {
  walk_speed_km_per_min: number;
  drive_access_min: number;
  types: Record<FacType, CalibType>;
  check: Record<FacType, CalibCheck>;
  method: string;
}

export interface AtlasData {
  W: number;
  H: number;
  bounds: [number, number, number, number];
  boundary: string;
  hex: Hex[];
  dun: Dun[];
  fac: Record<FacType, Facility[]>;
  cells: Cells;
  calib: Calib;
  sources: Record<string, string>;
}

export interface DunIndex {
  dun: string;
  aged65: number;
  money: number;
  health: number;
  care: number;
  social: number;
  access: number;
  index: number;
}

export type Domain = 'money' | 'health' | 'care' | 'social' | 'access';
export const DOMAINS: Domain[] = ['money', 'health', 'care', 'social', 'access'];

export interface Stats {
  note: string;
  population: {
    total_2026: number;
    aged65_2026: number;
    pct65: number;
    hexagons: number;
    kinta_growth: { '2020': number; '2026': number; factor: number };
    census_2020: { area: string; pop: number; pct65: number }[];
    bandar_ipoh_estimated: { hexagons: number; people: number; pct65: number };
  };
  health: {
    clinics: number;
    hospitals: number;
    beyond_30min_walk_clinic: number;
    beyond_30min_walk_clinic_pct: number;
    walk_bands_pct: { clinic: number[]; hospital: number[]; bands: string[] };
    drive_bands_pct: { clinic: number[]; hospital: number[]; bands: string[] };
    cumulative_curves_minutes_0_120: Record<string, number[]>;
    beds_perak_2024: {
      public_beds_per_10k: number;
      general_beds_per_10k: number;
      beds_per_1k_aged65: number;
      note: string;
    };
  };
  money: {
    dun_income: { dun: string; code: string; median_2019: number; median_2024: number }[];
    poverty_2024: { area: string; absolute: number; relative: number }[];
    rwi_check: { spearman_hex: number; spearman_dun: number; n_hex: number };
    napic: string;
  };
  care: { care_homes_osm: number; pawe: string; capacity: string };
  social: { kinds: Record<string, number>; pct65_none: number; pct65_3plus: number };
  access: {
    bus_stops: number;
    weekday_trips: number;
    pct65_within_400m: number;
    pct65_within_500m: number;
    pct65_400m_1ph: number;
    pct65_400m_2ph: number;
    pct65_400m_4ph: number;
    internet_2026Q3: {
      fixed_median_mbps: number;
      mobile_median_mbps: number;
      fixed_hex_coverage: number;
      mobile_hex_coverage: number;
      licence: string;
    };
  };
  index: {
    dun: DunIndex[];
    bands: { names: string[]; aged65: number[] } & Record<Domain, number[]>;
    robust: { hexagons: number; aged65: number; rule: string };
  };
  gaps: [string, string, string][];
  rasters: {
    bounds_lonlat: [number, number, number, number];
    svg_viewbox: [number, number];
    layers: Record<string, { min: number; max: number; unit: string; ramp: string }>;
    ramps: Record<string, string[]>;
  };
}
