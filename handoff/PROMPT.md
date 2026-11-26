# Prompt for Claude Code: build and deploy the Ipoh Ageing Atlas

Paste everything below the line into Claude Code, run from inside a clone of `https://github.com/venvennnn/ipoh_aging_atlas`, after unzipping `ipoh_atlas_handoff.zip` into the repo root as a folder named `handoff/`.

---

You are building **Ipoh Ageing Atlas**, a public website about where Ipoh's 74,207 residents aged 65+ live and how far they are from care, income, company and transport. It has interactive simulators for placing new facilities. It must deploy to **Vercel** from this repo (`venvennnn/ipoh_aging_atlas`).

## Non-negotiable rule: real data only
- Every number, map and chart must come from the files in `handoff/public/data/` or `handoff/public/img/`. Those files were produced from the notebook `handoff/reference/Ipoh_Analysis.ipynb`. The method write-up is `handoff/reference/Ipoh_Elderly_Analysis.pdf`.
- Never invent, estimate, interpolate, "mock" or use placeholder numbers. Never add sample data, lorem ipsum or seeded random data, even temporarily, and not in tests.
- Where data is missing, show it as missing with the reason given in the data. Examples: care-home capacity is "not public"; the PAWE list "failed to download"; Kinta's bed rows "did not load". Never fill the gap.
- If you need a number that isn't in the data files, stop and tell me. Don't guess.

## What's in `handoff/`
- `design/*.dc.html`: the approved page designs (4 pages). **They are the visual spec.** Match their layout, copy, colours, type and interactions. They are written in a custom component format (`<x-dc>`, `<sc-for>`, `<sc-if>`, `{{ holes }}`, a `Component` class with `renderVals()`). Read them as a spec and port them to React; don't try to run them. Asset URLs inside them look like `/_blob/<id>`. Map them like this:
  - `/_blob/63c56affcfd33efe8989c0336fd7d90d` and `/_blob/ce493bda7a7bc665f0e755030a0b0250` → `/data/ipoh_data_v2.json`
  - `/_blob/310d672b025fbda8b29fb382927214ce` → `/img/ipoh_hero.jpg`
  - `/_blob/1bbce11b9456cb832316d509746f580f` → `/img/walk_clinic.png`
  - `/_blob/31fbebea4c3b351878b2a2eb17894265` → `/img/walk_hospital.png`
  - `/_blob/e97269336c597e325728abecf6f65cf1` → `/img/drive_clinic.png`
  - `/_blob/ffa703b0e94be24d0b7f2a6d6838aff9` → `/img/drive_hospital.png`
  - `/_blob/8d852648a794d085f2ae5e02cad8a398` → `/img/walk_care.png`
  - `/_blob/90915baefe967f9568f439bd4a8271a2` → `/img/walk_bus.png`
  - `/_blob/514a293e6419967f9e81f3ad2ab1d4c6` → `/img/index.png`
  - `/_blob/919753a5b052df5827c95bcac0c8ac9c` → `/img/clinic_capacity.png`
  - `/_blob/a0408dd146c8f4cf03ddfd17c4508445` → `/img/d_money.png`
  - `/_blob/d1447b4ce4a1dcc38f760cb0e5b465f3` → `/img/d_health.png`
  - `/_blob/4588510aa543de3374d6ac7a48ab5180` → `/img/d_care.png`
  - `/_blob/dfc6503218096da0ed4157cd52d4fc5b` → `/img/d_social.png`
  - `/_blob/513e226f0d0dbf469fca1dbd775cbed5` → `/img/d_access.png`
- `public/data/ipoh_data_v2.json` (about 850 KB): the simulation data store.
  - `W`, `H` (740×800 SVG viewBox), `bounds` `[lon0, lat0, lon1, lat1]` = `[101.0, 4.51, 101.26, 4.79]`, and `boundary` (an SVG path of the Majlis Bandaraya Ipoh boundary).
  - `hex[]` (841): `id`, `d` (SVG path), `x`, `y` (SVG centre), `lat`, `lon`, `pop`, `p65`, `pct` (% aged 65+), `area` (census area), `dun` (constituency name or null).
  - `dun[]` (13): `name`, `code`, `income` (2024 median RM), `d` (SVG path), `x`, `y` (label point).
  - `fac.{clinic, hospital, care, bus}[]`: `n` (name), `lat`, `lon`, `x`, `y`. Some points fall outside the 740×800 frame; keep them in the calculations, but don't draw them.
  - `cells` (19,954 cells of 100 m from Meta's 30 m layer), in columnar form: `lon[]`, `lat[]`, `p65[]`, `pop[]`, `hex[]` (index into `hex`).
  - `calib`: `walk_speed_km_per_min` (0.054), `drive_access_min` (2), `types.{clinic, hospital, care, bus}.{k, s}`, `check` (model vs notebook-routed shares), `method` (plain-English text).
  - `sources`.
- `public/data/stats.json`: every headline figure, chart series and table used on the overview page (curves, income 2019→2024, poverty, bus, social, internet, index by DUN and band, gaps, raster legend ranges and colour ramps). **Use it; don't retype numbers.**
- `public/data/ipoh_v2_manifest.json`: a description of the dataset and its sources.
- `public/img/`: 13 travel-time and index raster PNGs. Each covers exactly `bounds` and is drawn stretched to the full 740×800 viewBox. There is also `ipoh_hero.jpg`.
- `pipeline/*.py`: the scripts that produced the data. Order: `extract.py <notebook>` → `build.py` → `meta.py` (needs `mys_general_2020_csv.zip` from HDX, not included because it's 53 MB) → `cells.py` → `calib.py` → `pack.py`. The bus detour `k = 1.98` was fitted to the notebook's 16% (400 m) and 23% (500 m).

## Tech stack
- **Vite + React + TypeScript**, a static site (no server needed), with React Router and 4 routes: `/` (overview), `/place` (place a facility), `/optimise` (find best sites), `/index` (vulnerability index explorer).
- Copy `handoff/public/*` into the app's `public/`. Load data with `fetch('/data/…')`.
- Maps are **SVG** drawn from the paths in the data file, exactly as in the designs. No tile basemap and no map API keys.
- Charts are hand-built SVG as in the designs. Don't add a chart library unless a design can't be matched without one.
- Run the simulation engines in a **Web Worker** (`src/engine/worker.ts`) so the UI never freezes. Post progress for each site added.
- Font: **Plus Jakarta Sans** (weights 400–800) via Google Fonts or `@fontsource`. **No italic, no serif accent font.** Background: white. **No logo mark in the header**, only the text "Ipoh Ageing Atlas".
- Add `vercel.json` with an SPA rewrite (`{"rewrites":[{"source":"/(.*)","destination":"/index.html"}]}`). Set long cache headers for `/data/*` and `/img/*`.

## Pages (match `design/` exactly)

### 1. Overview (`design/Main.dc.html`)
- **Hero:** a 760 px tall dark (`#0A1622`) auto-advancing chapter slider with 6 chapters: intro, People, Health, Money, Getting around, Index.
  - Each chapter has its own full-bleed background, which crossfades with a slow scale/drift:
    - intro: `ipoh_hero.jpg`, `object-fit: cover`, position `70% 40%`
    - People: 65+ hexagons on a dark orange ramp
    - Health: `walk_clinic.png` with the clinic points
    - Money: DUN polygons with income labels
    - Getting around: `walk_bus.png` with the bus stops
    - Index: `index.png` with DUN outlines
  - A left-to-right dark shade keeps the text readable.
  - Each chapter's text: a small monospace kicker with a pulsing dot, a two-line headline (line 1 white, line 2 `#F8B48C`, **same font, not italic**), a paragraph, fact chips and a pill CTA that jumps to its section.
  - Counter "0N / 05" at the top right. Six tabs along the bottom, with an animated progress line on the active one.
  - Advances every 6.5 s and pauses on hover. Clicking a tab jumps to it and restarts the timer. Respect `prefers-reduced-motion`: no auto-advance and no animation.
- **Below the hero:**
  - a row of jump links
  - Key findings (6 cards)
  - Parts 1–8: People, Health, Money, Care/Social/Access, Index, Gaps
  - a dark "Test what would change it" panel linking the simulators
  - footer with the sources
- **Maps:**
  - People: switch between 65+, all residents and share 65+; hover shows that hexagon's details.
  - Health: 5 raster layers plus facility points, with hover names.
  - Money: DUN choropleth with labels.
  - Care/bus: 2 raster layers.
  - Index: overall plus the 5 domain rasters, with DUN outlines.
  - Every map has a legend.
- **Charts:**
  - Cumulative access curves: 4 lines from `stats.health.cumulative_curves_minutes_0_120`, 0–90 min, a dashed 30-min line, and a hover crosshair with a tooltip.
  - Income 2019 → 2024 dumbbell chart.
  - Census 65+ share bars with a dashed Ipoh-average line.
  - Poverty bars, bus access bars, social "kinds" bars.
  - Five small bar charts for the domain bands.
  - Index-by-DUN bars.

### 2. Place a facility (`design/PlaceFacility.dc.html`)
- Facility type: clinic, hospital, care home or bus stop. Walking or driving (bus stops are walking only). Threshold: walk 15/30/45 min, drive 5/10/15 min, bus 400/500 m.
- Click **anywhere** on the map to add a site. Convert the click to lon/lat with `lon = 101.0 + x/740*0.26` and `lat = 4.79 - y/800*0.28`. Sites are numbered, and each can be removed.
- Engine:
  - For each of the 19,954 cells, take the straight-line km to the nearest existing facility of that type (precompute this once per type) and to the nearest new site. Use `dx = Δlon*110.95`, `dy = Δlat*110.574`.
  - Convert distance with `calib`:
    - walk minutes = `d*k/0.054`
    - drive minutes = `2 + d/s`
    - bus street metres = `d*k*1000`
  - Results:
    - share and count of residents 65+ within the threshold, today and with the plan
    - people gained, in total and per site
    - 65+-weighted average time before and after
    - gains by DUN (cell → hex → dun)
  - Colour hexagons by 65+ count (orange ramp). Hexagons with newly reached residents switch to a blue ramp.
- Show the "Model check against the notebook" card from `calib.check`. If no routed value exists (care homes), say so and call the care-home results indicative.

### 3. Find the best sites (`design/Optimizer.dc.html`)
- Inputs: type, mode, threshold, N from 1 to 20 (stepper plus presets 1/2/3/5/10), goal, and an optional "only build inside DUN".
- Goals:
  - "Reach the most people" (maximal covering)
  - "Shortest average trip" (p-median on 65+-weighted time)
  - "Worst-off first" (covering, with each cell weighted by its DUN's index divided by 38, from `stats.index.dun`)
- Candidates: all 841 hexagon centres (or only those in the chosen DUN). Greedy: each step adds the best candidate and keeps every existing facility.
- Outputs:
  - numbered pins on the map
  - coverage bars per step
  - a build-order table: DUN, nearest existing facility and its distance, residents 65+ added, coverage after, average after, lat/lon
  - a summary line and the model-check line
- Run it automatically once on load with the defaults (clinic, walk, 30 min, N = 3, cover).
- **Acceptance check:** with those defaults the result must be baseline 27.2% → 34.6%, +5,478 residents 65+, picks in Simpang Pulai, Canning, Canning. Write this as a test.

### 4. Vulnerability index explorer (`design/IndexExplorer.dc.html`)
- Five weight sliders (0–5), presets, and the DUN ranking recalculated live as a weighted average of the DUN domain scores in `stats.index.dun`, with each DUN's move against equal weights.
- Domain heatmap table, bands table, and the robust-hexagons card.
- Also add the `index.png` map with a domain switcher, like the overview.

## Quality bar
- Accessible: real buttons, links and labels; `aria-pressed` on toggles; `role="img"` plus a label on maps; visible focus; text contrast ≥ 4.5:1; touch targets ≥ 44 px.
- Responsive: on a phone, side panels stack above and below the map.
- Fast: lazy-load the 850 KB data file only on the simulator pages; on the overview, load it once. The whole optimiser must finish in under 4 s for N = 20 on a laptop.
- Tests (Vitest) on the engine, using the real data file:
  - Baseline shares reproduce `calib.check` for clinic walk 15/30/45, clinic drive, hospital, and bus 400/500 m (within 0.1 pt of the stored model values).
  - The optimiser acceptance check above.
  - Adding a site never lowers coverage.
- `npm run build` must pass with no TypeScript errors.

## Workflow
1. Look at the repo first. If it has existing code, tell me what's there before replacing anything.
2. Work on a branch `feat/atlas-site`. Commit in logical steps: scaffold, data and engine with tests, overview, simulators, index explorer, deploy config.
3. When done:
   - run the tests and the build
   - push the branch and open a PR to `main`
   - tell me how to deploy: Vercel → Add New Project → import `venvennnn/ipoh_aging_atlas`, framework Vite, build `npm run build`, output `dist`
   - list anything from the designs you couldn't match exactly, and why

## Known limits (state them on the site; don't hide them)
- Travel times in the simulators are straight-line distance times a street-detour factor fitted to the notebook's routed results. They are not true street routes. Hospital "within 5 min drive" fits poorly (17.9% model vs 7.2% routed). Care homes have no routed curve, so they use an averaged fit.
- Next upgrade, if I provide `osm_ipoh_walk_network.json` and a drive network later: replace the detour factor with real shortest paths, precomputed as a hexagon-to-cell travel-time matrix in `pipeline/`. Don't build this now.
