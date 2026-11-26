# Ipoh Ageing Atlas

Where Ipoh's residents aged 65+ live, and how far they are from care, income, company and transport. It includes simulators for placing new facilities. Static site: Vite + React + TypeScript.

| Route | Page |
| --- | --- |
| `/` | Overview: chapter hero, key findings, Parts 1–8 |
| `/place` | Place a facility: click the map, see who gains access |
| `/optimise` | Find the best sites: greedy covering / p-median / worst-off-first |
| `/index` | Vulnerability index explorer: re-weight the five domains |

## Data

Every number comes from `public/data/` and `public/img/`. These were produced from the notebook in `handoff/reference/Ipoh_Analysis.ipynb` by the scripts in `handoff/pipeline/`. Nothing is estimated in the app. Missing data is shown as missing, with the reason stored in the data.

- `public/data/ipoh_data_v2.json`: hexagons, DUNs, facilities, 19,954 population cells and the travel-time calibration (`calib`).
- `public/data/stats.json`: headline figures and chart series for the overview and index pages.
- `public/img/*.png`: the notebook's travel-time and index rasters, covering exactly `bounds`.

The data and image files are served with a one-year cache. If one changes, bump `DATA_VERSION` in `src/lib/data.ts`; image URLs are not versioned, so give a changed image a new file name.

## Maps

Interactive maps are zoomable street maps built with [MapLibre GL](https://maplibre.org/) on the free [OpenFreeMap](https://openfreemap.org/) "Positron" basemap (OpenStreetMap data, no API key; credits are shown on each map). Overlays come from the data files:

- Population and access status are drawn as the pipeline's real 100 m population cells (19,954), not hexagons. In the simulators each cell is shown as within reach today (blue), newly in reach (green) or still out of reach (orange hatching).
- Travel-time and index rasters are the notebook PNGs, placed exactly on `bounds`.
- DUN polygons and the city boundary are converted from the SVG paths in the data file.

Visitors' browsers must be able to reach `tiles.openfreemap.org`. The overview maps need Ctrl/⌘ + scroll (two fingers on touch) to zoom, so the page still scrolls. The simulator maps zoom with a plain scroll. In the Place a facility map, focus the map and press Enter to add a site at the centre.

## Simulation engine

`src/engine/core.ts` holds the engine; it runs in a Web Worker (`src/engine/worker.ts`). Travel time is straight-line distance from each 100 m cell to the nearest facility, converted with the calibration stored in the data:

- walk minutes = `d × k / 0.054`
- drive minutes = `2 + d / s`
- bus-stop street metres = `d × k × 1000`

**Known limits** (also stated on the site):

- These are not true street routes. `k` and `s` were fitted so the existing facilities reproduce the notebook's routed results.
- Hospital within a 5-minute drive fits poorly (17.9% model vs 7.2% routed).
- Care homes have no routed curve, so they use the mean of the clinic and hospital fits.

Next upgrade: given walk and drive networks, replace the detour factor with real shortest paths, precomputed in `pipeline/` as a hexagon-to-cell travel-time matrix.

## Develop

```bash
npm install
```

```bash
npm run dev
```

```bash
npm test
```

```bash
npm run build
```

The tests use the real data files. They check that baselines reproduce `calib.check`, run the optimiser acceptance case (clinic, walk, 30 min, N = 3: 27.2% → 34.6%, +5,478, picks in Simpang Pulai, Canning, Canning), and check that adding a site never lowers coverage.

## Deploy (Vercel)

On Vercel, choose Add New Project and import `venvennnn/ipoh_aging_atlas`. Set the framework to **Vite**, the build command to `npm run build` and the output directory to `dist`. `vercel.json` adds the SPA rewrite and the long cache headers.
