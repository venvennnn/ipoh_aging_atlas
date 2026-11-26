import { useEffect, useMemo, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import IndexMap from '../components/IndexMap';
import AtlasMap, { type CellProps } from '../map/AtlasMap';
import { rampExpr } from '../map/expr';
import { BarRow, HoverCard, LoadError, RampLegend, ToggleGroup } from '../components/ui';
import { bestInk, fmt, ramp, signed } from '../lib/format';
import type { AtlasData, Dun, Stats } from '../lib/types';
import { useAtlas, useStats } from '../lib/useData';
import { AccessCurves, IncomeDumbbell } from './overview/charts';
import { robustRule } from './overview/derive';
import Chapters from './overview/Chapters';

const BLUES = ['#EEF4FC', '#CDE2FB', '#86B6EF', '#1C5CAB', '#0D366B'];
const ORANGES = ['#FFF4EC', '#FDE0CC', '#F8B48C', '#B9461A', '#6E2408'];

const TOC = [
  { label: 'Key findings', href: '#findings' },
  { label: 'People', href: '#people' },
  { label: 'Health', href: '#health' },
  { label: 'Money', href: '#money' },
  { label: 'Care, social, access', href: '#care' },
  { label: 'Index', href: '#index' },
  { label: 'Gaps', href: '#gaps' },
  { label: 'Simulators', href: '#simulate' },
];

export default function Overview() {
  const stats = useStats();
  const atlas = useAtlas();
  const { hash } = useLocation();
  const S = stats.data;

  // Jump to a section when arriving with a #hash from another page.
  useEffect(() => {
    if (!S || !hash) return;
    const el = document.getElementById(hash.slice(1));
    if (el) requestAnimationFrame(() => el.scrollIntoView());
  }, [S, hash]);

  return (
    <>
      {S && <Chapters stats={S} atlas={atlas.data} />}
      <main className="wrap">
        <nav aria-label="On this page" className="toc">
          {TOC.map((t) => (
            <a key={t.href} href={t.href}>
              {t.label}
            </a>
          ))}
        </nav>
        {stats.error && <LoadError error={stats.error} />}
        {atlas.error && <LoadError error={atlas.error} />}
        {S && (
          <>
            <Findings S={S} />
            <People S={S} D={atlas.data} />
            <Health S={S} D={atlas.data} />
            <Money S={S} D={atlas.data} />
            <Care S={S} D={atlas.data} />
            <IndexPart S={S} D={atlas.data} />
            <Gaps S={S} />
            <Simulate D={atlas.data} />
          </>
        )}
      </main>
      <footer className="site-footer">
        <div className="inner">
          <p style={{ margin: 0, maxWidth: 900 }}>
            Sources: DOSM Census 2020 (Kinta: Fakta dan Angka) · OpenDOSM population, HIES income and poverty · data.gov.my
            hospital beds · Meta 30 m population layer and Relative Wealth Index · OpenStreetMap contributors · Healthsites.io · KKM
            clinic list · BAS.MY GTFS · Ookla open data (CC BY-NC-SA 4.0) · MECo DUN boundaries. Travel-time surfaces are the
            notebook's own routed outputs.
          </p>
        </div>
      </footer>
    </>
  );
}

// ------------------------------------------------------------------ helpers

function PartHead({ kicker, title, intro }: { kicker: string; title: string; intro: string }) {
  return (
    <>
      <p className="part-kicker">{kicker}</p>
      <h2>{title}</h2>
      <p className="intro">{intro}</p>
    </>
  );
}

function incomeExtremes(S: Stats) {
  const inc = [...S.money.dun_income].sort((a, b) => a.median_2024 - b.median_2024);
  return { lo: inc[0], hi: inc[inc.length - 1], n: inc.length };
}

// ------------------------------------------------------------------ findings

function Findings({ S }: { S: Stats }) {
  const P = S.population;
  const bandarS = P.census_2020.find((c) => c.area === 'Bandar Ipoh (S)');
  const drive10 = Math.round(S.health.cumulative_curves_minutes_0_120['Public clinic (KKM) · driving'][10]);
  const { lo, hi } = incomeExtremes(S);
  const ranked = [...S.index.dun].sort((a, b) => b.index - a.index);
  const mostOld = Math.max(...S.index.dun.map((d) => d.aged65));
  const items = [
    {
      domain: 'People',
      num: fmt(P.aged65_2026),
      text: `residents aged 65+ in 2026, ${P.pct65.toFixed(1)}% of ${fmt(P.total_2026)}.${bandarS ? ` Central Ipoh is older: ${bandarS.pct65.toFixed(1)}% in Bandar Ipoh (S).` : ''}`,
    },
    {
      domain: 'Health',
      num: `${S.health.beyond_30min_walk_clinic_pct}%`,
      text: `of residents 65+ live more than a 30-minute walk from a public clinic. By car, ${drive10}% get there within 10 minutes.`,
    },
    {
      domain: 'Money',
      num: `RM${fmt(lo.median_2024)}`,
      text: `median household income in ${lo.dun}, ${lo.median_2024 * 2 < hi.median_2024 ? 'less than half of' : 'compared with'} ${hi.dun}’s RM${fmt(hi.median_2024)}.`,
    },
    {
      domain: 'Social',
      num: `${S.social.pct65_none}%`,
      text: 'of residents 65+ have no park, hall, kopitiam, market or place of worship within a 10-minute walk.',
    },
    {
      domain: 'Access',
      num: `${S.access.pct65_400m_2ph}%`,
      text: 'of residents 65+ live within 400 m of a bus stop with 2 or more buses an hour.',
    },
    {
      domain: 'Index',
      num: ranked[0].dun,
      text: `ranks most vulnerable (${ranked[0].index}/100), then ${ranked[1].dun}, home to ${fmt(ranked[1].aged65)} residents 65+${ranked[1].aged65 === mostOld ? ', the most of any DUN' : ''}.`,
    },
  ];
  return (
    <section id="findings" style={{ padding: '48px 0 16px', scrollMarginTop: 8 }}>
      <h2 style={{ margin: '0 0 24px', fontWeight: 800, fontSize: 30, letterSpacing: '-0.01em' }}>Key findings</h2>
      <div className="findings">
        {items.map((f) => (
          <div key={f.domain} className="finding">
            <p className="eyebrow">{f.domain}</p>
            <p className="num">{f.num}</p>
            <p className="txt">{f.text}</p>
          </div>
        ))}
      </div>
    </section>
  );
}

// ------------------------------------------------------------------ people

type PeopleKey = 'p65' | 'pop' | 'pct';

function People({ S, D }: { S: Stats; D: AtlasData | null }) {
  const P = S.population;
  const [layer, setLayer] = useState<PeopleKey>('p65');
  const [hover, setHover] = useState<CellProps | null>(null);
  // Colour scales run from 0 to the largest 100 m cell in the data.
  const max = useMemo(() => (D ? { p65: Math.max(...D.cells.p65), pop: Math.max(...D.cells.pop) } : null), [D]);
  const PL = {
    p65: { stops: ORANGES, unit: 'residents 65+ per 100 m cell', lo: '0', hi: max ? max.p65.toFixed(1) : '' },
    pop: { stops: BLUES, unit: 'residents per 100 m cell', lo: '0', hi: max ? fmt(max.pop) : '' },
    pct: { stops: ORANGES, unit: '% aged 65+ (Census 2020 shares)', lo: '8%', hi: '14%+' },
  } as const;
  const pl = PL[layer];
  const color = useMemo(() => {
    if (!max) return null;
    if (layer === 'pct') return rampExpr(ORANGES, ['get', 'pct'], 8, 14);
    return rampExpr(pl.stops as unknown as string[], ['sqrt', ['get', layer]], 0, Math.sqrt(max[layer]));
  }, [layer, max, pl]);
  const census = [...P.census_2020].sort((a, b) => b.pct65 - a.pct65);
  const censusTotal = P.census_2020.reduce((a, c) => a + c.pop, 0);
  const mukim = P.census_2020.find((c) => c.area === 'Mukim Hulu Kinta');
  const B = P.bandar_ipoh_estimated;

  return (
    <section id="people" className="part">
      <PartHead
        kicker="Part 1 · People"
        title="Where people aged 65+ live"
        intro={`Census 2020 shares aged 65+, applied to 2026 totals (Kinta grew ×${P.kinta_growth.factor}, OpenDOSM) and spread over hexagons with Meta's 30 m population layer.`}
      />
      <div className="row" style={{ gap: 24 }}>
        <div className="card map-card">
          <ToggleGroup
            label="Map layer"
            options={[
              { key: 'p65', label: 'Aged 65+' },
              { key: 'pop', label: 'All residents' },
              { key: 'pct', label: 'Share 65+' },
            ]}
            value={layer}
            onChange={setLayer}
          />
          <div className="map-wrap" style={{ marginTop: 12 }}>
            <AtlasMap
              D={D}
              label={`Zoomable street map of Ipoh shaded by ${pl.unit}`}
              cellColor={color}
              onCellHover={setHover}
            >
              <HoverCard
                title={hover ? `${hover.dun ? `${hover.dun} · ` : ''}${hover.area}` : 'Hover the map'}
                body={
                  hover
                    ? `This 100 m cell: ${hover.p65.toFixed(1)} aged 65+ of ${hover.pop.toFixed(0)} residents\nShare 65+ in this area: ${hover.pct.toFixed(1)}%`
                    : `${fmt(P.total_2026)} residents · ${fmt(P.aged65_2026)} aged 65+\nScroll with Ctrl/⌘ or use + − to zoom`
                }
              />
            </AtlasMap>
          </div>
          <RampLegend lo={pl.lo} hi={pl.hi} stops={pl.stops as unknown as string[]} unit={pl.unit} />
        </div>
        <div className="col side-col" style={{ flex: '1 1 360px' }}>
          <div className="card pad-22">
            <h3>Share aged 65+ by census area, 2020</h3>
            <p className="small" style={{ margin: '0 0 16px' }}>
              Line = Ipoh combined, {P.pct65}%. DOSM, Kinta: Fakta dan Angka, p. 8.
            </p>
            <div>
              {census.map((c) => (
                <BarRow
                  key={c.area}
                  cols="130px minmax(0, 1fr) 48px"
                  label={c.area}
                  value={`${c.pct65.toFixed(1)}%`}
                  widthPct={(c.pct65 / 20) * 100}
                  color={c.pct65 > P.pct65 ? '#B9461A' : '#A8A59B'}
                  height={16}
                  marker={(P.pct65 / 20) * 100}
                />
              ))}
            </div>
          </div>
          <div className="card dashed pad-22">
            <p className="eyebrow orange">Limit</p>
            <p style={{ margin: '10px 0 0', fontSize: 14, lineHeight: 1.6, color: '#2C2C29' }}>
              {mukim
                ? `Mukim Hulu Kinta holds about ${Math.round((mukim.pop / censusTotal) * 100)}% of Ipoh's people under one figure (${mukim.pct65.toFixed(1)}%), so the share map only varies where a Bandar area applies. `
                : ''}
              Bandar Ipoh's extent is estimated from the town centre ({B.hexagons} hexagons, {B.pct65.toFixed(1)}% aged 65+), not an official
              boundary.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}

// ------------------------------------------------------------------ health

const HEALTH_LAYERS = [
  { key: 'walk_clinic', label: 'Walk · clinic', pts: 'clinic' },
  { key: 'walk_hospital', label: 'Walk · hospital', pts: 'hospital' },
  { key: 'drive_clinic', label: 'Drive · clinic', pts: 'clinic' },
  { key: 'drive_hospital', label: 'Drive · hospital', pts: 'hospital' },
  { key: 'clinic_capacity', label: 'Clinic capacity', pts: 'clinic' },
] as const;
type HealthKey = (typeof HEALTH_LAYERS)[number]['key'];

function rasterHi(meta: { max: number; unit: string }) {
  return meta.unit === 'min' ? `${meta.max}+ min` : `${meta.max.toFixed(2)} ${meta.unit}`;
}

function Health({ S, D }: { S: Stats; D: AtlasData | null }) {
  const [k, setK] = useState<HealthKey>('walk_clinic');
  const [hover, setHover] = useState<string | null>(null);
  const cur = HEALTH_LAYERS.find((l) => l.key === k)!;
  const meta = S.rasters.layers[k];
  const isCap = meta.unit !== 'min';
  const ptsType = cur.pts;
  const ptFill = ptsType === 'clinic' ? '#1C5CAB' : '#15181D';
  const points = useMemo(() => (D ? { list: D.fac[ptsType], color: ptFill, radius: 7, strokeWidth: 2.5 } : null), [D, ptsType, ptFill]);
  const raster = useMemo(() => ({ url: `/img/${k}.png`, opacity: 0.85 }), [k]);
  const beds = S.health.beds_perak_2024;
  const walkMps = Math.round(((D?.calib.walk_speed_km_per_min ?? 0) * 1000) / 60 * 10) / 10;

  return (
    <section id="health" className="part">
      <PartHead
        kicker="Part 2 · Health"
        title="How quickly older residents reach a clinic or hospital"
        intro={`Travel time to the nearest of ${S.health.clinics} public clinics and ${S.health.hospitals} hospitals. Walking follows real streets${walkMps ? ` at ${walkMps} m/s` : ''}; driving follows real roads with one-way streets and no traffic.`}
      />
      <div className="row" style={{ gap: 24 }}>
        <div className="card map-card">
          <ToggleGroup
            label="Travel-time layer"
            options={HEALTH_LAYERS.map((l) => ({ key: l.key, label: l.label }))}
            value={k}
            onChange={(v) => {
              setK(v);
              setHover(null);
            }}
          />
          <div className="map-wrap" style={{ marginTop: 12 }}>
            <AtlasMap
              D={D}
              label={`Zoomable street map of ${cur.label} across Ipoh${isCap ? '' : ', travel time in minutes'}, with ${ptsType === 'clinic' ? 'public clinics' : 'hospitals'} marked`}
              raster={raster}
              points={points}
              onPointHover={setHover}
            >
            <HoverCard
              title={hover ?? cur.label}
              body={
                hover
                  ? ptsType === 'clinic'
                    ? 'Public clinic (KKM)'
                    : 'Hospital (public or private)'
                  : isCap
                    ? 'Hover a point for its name. Darker blue = more clinic capacity.'
                    : 'Hover a point for its name. Darker red = longer trip.'
              }
            />
            </AtlasMap>
          </div>
          <RampLegend
            lo={isCap ? `${meta.min}` : `${meta.min} min`}
            hi={rasterHi(meta)}
            stops={S.rasters.ramps[meta.ramp]}
            extra={
              <span style={{ marginLeft: 6, display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                <span
                  style={{ width: 10, height: 10, borderRadius: '50%', border: '2px solid #FFFFFF', boxShadow: '0 0 0 1px #C9C6BC', background: ptFill }}
                />
                {ptsType === 'clinic' ? `${S.health.clinics} public clinics` : `${S.health.hospitals} hospitals`}
              </span>
            }
          />
        </div>
        <div className="col side-col">
          <AccessCurves stats={S} />
          <div className="row">
            <div className="card" style={{ flex: '1 1 200px', padding: 20 }}>
              <p style={{ margin: 0, fontWeight: 800, fontSize: 34, color: '#B9461A' }}>{fmt(S.health.beyond_30min_walk_clinic)}</p>
              <p style={{ margin: '4px 0 0', fontSize: 14, lineHeight: 1.5, color: '#2C2C29' }}>
                residents 65+ ({S.health.beyond_30min_walk_clinic_pct}%) are more than a 30-minute walk from a public clinic.
              </p>
            </div>
            <div className="card" style={{ flex: '1 1 200px', padding: 20 }}>
              <p style={{ margin: 0, fontWeight: 800, fontSize: 34 }}>{beds.public_beds_per_10k}</p>
              <p style={{ margin: '4px 0 0', fontSize: 14, lineHeight: 1.5, color: '#2C2C29' }}>
                public hospital beds per 10,000 people in Perak, 2024. {beds.note}.
              </p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

// ------------------------------------------------------------------ money

function Money({ S, D }: { S: Stats; D: AtlasData | null }) {
  const [hoverName, setHoverName] = useState<string | null>(null);
  const { lo, hi, n } = incomeExtremes(S);
  const p65 = Object.fromEntries(S.index.dun.map((d) => [d.dun, d.aged65]));
  const { fill, ink } = useMemo(() => {
    const fill: Record<string, string> = {};
    const ink: Record<string, string> = {};
    D?.dun.forEach((d) => {
      const t = (d.income - lo.median_2024) / (hi.median_2024 - lo.median_2024);
      fill[d.name] = ramp(BLUES, 0.1 + t * 0.9);
      ink[d.name] = bestInk(fill[d.name]);
    });
    return D ? { fill, ink } : { fill: null, ink: null };
  }, [D, lo, hi]);
  const hover: Dun | null = (hoverName && D?.dun.find((d) => d.name === hoverName)) || null;
  const poverty = S.money.poverty_2024;
  const rwi = S.money.rwi_check;
  return (
    <section id="money" className="part">
      <PartHead
        kicker="Part 3 · Money"
        title="Who is better off, who is worse off"
        intro={`Official DOSM median household income for the ${n} state constituencies (DUN) covering Ipoh. House-price files (NAPIC) weren't loaded (${S.money.napic}), so there is no estimate inside each DUN.`}
      />
      <div className="row" style={{ gap: 24 }}>
        <div className="card map-card">
          <div className="map-wrap">
            <AtlasMap
              D={D}
              label="Zoomable street map of median household income by constituency in Ipoh"
              dunFill={fill}
              dunLabels={ink}
              onDunHover={setHoverName}
            >
            <HoverCard
              title={hover ? `${hover.code} ${hover.name}` : 'Hover a constituency'}
              body={
                hover
                  ? `Median RM${fmt(hover.income)} / month${p65[hover.name] != null ? `\n${fmt(p65[hover.name])} residents 65+ in Ipoh` : ''}`
                  : `${n} DUNs · DOSM HIES 2024`
              }
            />
            </AtlasMap>
          </div>
          <RampLegend lo={`RM${fmt(lo.median_2024)}`} hi={`RM${fmt(hi.median_2024)}`} stops={BLUES} unit="median per month, 2024" />
        </div>
        <div className="col side-col">
          <IncomeDumbbell stats={S} />
          <div className="row">
            <div className="card" style={{ flex: '1 1 220px', padding: 20 }}>
              <h3 style={{ margin: '0 0 10px', fontSize: 14, fontWeight: 700 }}>Household poverty, 2024</h3>
              {poverty.map((p) => (
                <BarRow
                  key={p.area}
                  cols="70px minmax(0, 1fr) 40px"
                  label={p.area}
                  value={`${p.absolute}%`}
                  widthPct={(p.absolute / 8) * 100}
                  color={p.area === 'Kinta' ? '#1C5CAB' : '#A8A59B'}
                  height={12}
                />
              ))}
              <p className="note" style={{ margin: '4px 0 0' }}>
                Absolute poverty. District is the finest level published.
              </p>
            </div>
            <div className="card dashed" style={{ flex: '1 1 220px', padding: 20 }}>
              <p className="eyebrow orange">Cross-check didn't agree</p>
              <p style={{ margin: '8px 0 0', fontSize: 13, lineHeight: 1.55, color: '#2C2C29' }}>
                Meta's Relative Wealth Index barely tracks DUN income: rank correlation {signed(rwi.spearman_hex)} across hexagons,{' '}
                {signed(rwi.spearman_dun)} across DUNs.
              </p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

// ------------------------------------------------------------------ care, social, access

function Care({ S, D }: { S: Stats; D: AtlasData | null }) {
  const [k, setK] = useState<'care' | 'bus'>('care');
  const meta = S.rasters.layers[k === 'care' ? 'walk_care' : 'walk_bus'];
  const [hover, setHover] = useState<string | null>(null);
  const points = useMemo(
    () => (D ? (k === 'care' ? { list: D.fac.care, color: '#6E2408', radius: 7, strokeWidth: 2.5 } : { list: D.fac.bus, color: '#15181D', radius: 3, strokeWidth: 1 }) : null),
    [D, k],
  );
  const raster = useMemo(() => ({ url: `/img/${k === 'care' ? 'walk_care' : 'walk_bus'}.png`, opacity: 0.85 }), [k]);
  const A = S.access;
  const bus: [string, number][] = [
    ['Within 500 m of a stop', A.pct65_within_500m],
    ['Within 400 m of a stop', A.pct65_within_400m],
    ['…stop with 1+ bus/hour', A.pct65_400m_1ph],
    ['…stop with 2+ buses/hour', A.pct65_400m_2ph],
    ['…stop with 4+ buses/hour', A.pct65_400m_4ph],
  ];
  const kinds = Object.entries(S.social.kinds);
  const kmax = Math.max(...kinds.map((x) => x[1]));
  const net = A.internet_2026Q3;
  return (
    <section id="care" className="part">
      <PartHead
        kicker="Parts 4–6 · Care, social life, getting around"
        title="Care homes, places to meet, buses and internet"
        intro={`Walking time along real streets to the nearest of ${S.care.care_homes_osm} care homes and ${fmt(A.bus_stops)} bus stops (OpenStreetMap). Care-home capacity is ${S.care.capacity}, and the senior activity centre list is missing: ${S.care.pawe}.`}
      />
      <div className="row" style={{ gap: 24 }}>
        <div className="card map-card">
          <ToggleGroup
            label="Layer"
            options={[
              { key: 'care', label: 'Walk · care home' },
              { key: 'bus', label: 'Walk · bus stop' },
            ]}
            value={k}
            onChange={setK}
          />
          <div className="map-wrap" style={{ marginTop: 12 }}>
            <AtlasMap
              D={D}
              label={
                k === 'care'
                  ? `Zoomable street map of walking time to the nearest care home, with the ${S.care.care_homes_osm} care homes marked`
                  : `Zoomable street map of walking time to the nearest bus stop, with ${fmt(A.bus_stops)} stops marked`
              }
              raster={raster}
              points={points}
              onPointHover={setHover}
            >
              <HoverCard
                title={hover ?? (k === 'care' ? 'Walk · care home' : 'Walk · bus stop')}
                body={hover ? (k === 'care' ? 'Care home (OpenStreetMap)' : 'Bus stop') : 'Hover a point for its name. Darker red = longer walk.'}
              />
            </AtlasMap>
          </div>
          <RampLegend
            lo={`${meta.min} min`}
            hi={rasterHi(meta)}
            stops={S.rasters.ramps[meta.ramp]}
            extra={
              <span style={{ marginLeft: 6, display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                <span style={{ width: 10, height: 10, borderRadius: '50%', background: k === 'care' ? '#6E2408' : '#15181D' }} />
                {k === 'care' ? `${S.care.care_homes_osm} care homes` : `${fmt(A.bus_stops)} bus stops`}
              </span>
            }
          />
        </div>
        <div className="col side-col">
          <div className="card pad-22">
            <h3>Bus access thins out fast</h3>
            <p className="small" style={{ margin: '0 0 14px' }}>
              Share of residents 65+, distance along streets. BAS.MY timetable: {fmt(A.weekday_trips)} weekday trips.
            </p>
            {bus.map(([label, v]) => (
              <BarRow
                key={label}
                cols="170px minmax(0, 1fr) 40px"
                label={label}
                value={`${v}%`}
                widthPct={(Math.max(v, 0.6) / 25) * 100}
                color={v < 5 ? '#B9461A' : '#1C5CAB'}
              />
            ))}
          </div>
          <div className="card pad-22">
            <h3>Places to meet within a 10-minute walk</h3>
            <p className="small" style={{ margin: '0 0 14px' }}>
              {S.social.pct65_none}% of residents 65+ have none of these {kinds.length} kinds nearby; {S.social.pct65_3plus}% have three or
              more. Bars: places mapped in OSM.
            </p>
            {kinds.map(([kind, n]) => (
              <BarRow key={kind} cols="170px minmax(0, 1fr) 40px" label={kind} value={fmt(n)} widthPct={(n / kmax) * 100} color="#1C5CAB" strong={false} />
            ))}
          </div>
          <div className="card pad-22" style={{ display: 'flex', flexWrap: 'wrap', gap: 24, alignItems: 'baseline' }}>
            <div>
              <p style={{ margin: 0, fontWeight: 800, fontSize: 32 }}>
                {net.fixed_median_mbps} <span style={{ fontSize: 15, fontWeight: 600 }}>Mbps</span>
              </p>
              <p className="small" style={{ margin: '2px 0 0' }}>
                median fixed internet
              </p>
            </div>
            <div>
              <p style={{ margin: 0, fontWeight: 800, fontSize: 32 }}>
                {net.mobile_median_mbps} <span style={{ fontSize: 15, fontWeight: 600 }}>Mbps</span>
              </p>
              <p className="small" style={{ margin: '2px 0 0' }}>
                median mobile
              </p>
            </div>
            <p className="note" style={{ margin: 0, flex: '1 1 100%' }}>
              Ookla open data, 2026 Q3 ({net.licence}).
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}

// ------------------------------------------------------------------ index

const DOMAIN_LABEL = { money: 'Money', health: 'Health', care: 'Care', social: 'Social', access: 'Access' } as const;

function IndexPart({ S, D }: { S: Stats; D: AtlasData | null }) {
  const bands = S.index.bands;
  const avgBand = bands.aged65.reduce((a, b) => a + b, 0) / bands.aged65.length;
  const rule = robustRule(S);
  const ranked = [...S.index.dun].sort((a, b) => b.index - a.index);
  return (
    <section id="index" className="part">
      <PartHead
        kicker="Part 7 · Index"
        title="The ageing-vulnerability index"
        intro={`12 metrics turned into 0–100 percentile scores (higher = worse for an older person), averaged into five domains and one index. A Monte Carlo test re-weighted the domains ${rule.runs} times.`}
      />
      <div className="row" style={{ gap: 24 }}>
        <div className="card map-card">
          <IndexMap atlas={D} stats={S} />
        </div>
        <div className="col side-col">
          <div className="card pad-22">
            <h3>The worst-off fifth scores far worse on every domain</h3>
            <p className="small" style={{ margin: '0 0 14px' }}>
              Average domain score by index band; each band holds about {fmt(Math.round(avgBand / 100) * 100)} residents 65+.
            </p>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, minmax(0, 1fr))', gap: 10 }}>
              {(Object.keys(DOMAIN_LABEL) as (keyof typeof DOMAIN_LABEL)[]).map((dom) => {
                const v = bands[dom];
                return (
                  <div key={dom}>
                    <p style={{ margin: '0 0 6px', fontSize: 12, fontWeight: 700, textAlign: 'center' }}>{DOMAIN_LABEL[dom]}</p>
                    <div
                      role="img"
                      aria-label={`${DOMAIN_LABEL[dom]} score by band: ${v.map((x, i) => `${bands.names[i]} ${x.toFixed(0)}`).join(', ')}`}
                      style={{ height: 120, display: 'flex', alignItems: 'flex-end', gap: 3, borderBottom: '1px solid #C9C6BC' }}
                    >
                      {v.map((x, i) => (
                        <div
                          key={i}
                          title={`Q${i + 1}: ${x.toFixed(0)}`}
                          style={{ flex: '1 1 0', height: `${x}%`, background: i === v.length - 1 ? '#B9461A' : '#86B6EF', borderRadius: '3px 3px 0 0' }}
                        />
                      ))}
                    </div>
                    <p style={{ margin: '4px 0 0', display: 'flex', justifyContent: 'space-between', fontSize: 10, color: '#5A5A55' }}>
                      <span>Q1</span>
                      <span>Q5</span>
                    </p>
                    <p style={{ margin: '2px 0 0', fontSize: 11, textAlign: 'center', color: '#44443F' }}>
                      {Math.round(v[0])} → {Math.round(v[v.length - 1])}
                    </p>
                  </div>
                );
              })}
            </div>
          </div>
          <div className="card pad-22">
            <h3 style={{ margin: '0 0 12px' }}>Index by constituency</h3>
            {ranked.map((r) => (
              <BarRow
                key={r.dun}
                cols="110px minmax(0, 1fr) 28px"
                label={r.dun}
                value={r.index}
                widthPct={(r.index / 60) * 100}
                color={r.index >= 45 ? '#B9461A' : '#86B6EF'}
                height={14}
              />
            ))}
            <p style={{ margin: '10px 0 0', fontSize: 13, color: '#44443F' }}>
              {S.index.robust.hexagons} hexagons stay in the worst {rule.worst}% under ≥{rule.share}% of random weightings (
              {fmt(S.index.robust.aged65)} residents 65+). <Link to="/index" style={{ fontWeight: 700 }}>Change the weights →</Link>
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}

// ------------------------------------------------------------------ gaps

function Gaps({ S }: { S: Stats }) {
  return (
    <section id="gaps" className="part">
      <PartHead
        kicker="Part 8 · Gaps"
        title="What public data can't tell us"
        intro="Distance to a place isn't the same as getting care. These need the survey or a data request."
      />
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 14 }}>
        {S.gaps.map(([domain, what, how]) => (
          <div key={what} style={{ border: '1px dashed #B3B0A5', borderRadius: 12, padding: '18px 20px' }}>
            <p className="eyebrow orange" style={{ letterSpacing: '0.06em' }}>
              {domain}
            </p>
            <p style={{ margin: '8px 0 0', fontSize: 15, fontWeight: 600, lineHeight: 1.4 }}>{what}</p>
            <p style={{ margin: '6px 0 0', fontSize: 14, color: '#5A5A55' }}>{how}</p>
          </div>
        ))}
      </div>
    </section>
  );
}

// ------------------------------------------------------------------ simulators panel

function Simulate({ D }: { D: AtlasData | null }) {
  const h = D?.calib.check.hospital;
  return (
    <section id="simulate" className="simulate on-dark">
      <h2>Test what would change it</h2>
      <p style={{ margin: '10px 0 28px', fontSize: 16, color: '#DCE9F9', maxWidth: 720 }}>
        Use the same hexagons and facilities to try out new clinics, care homes or bus stops.
      </p>
      <div className="sim-cards">
        <Link to="/place">
          <strong style={{ fontSize: 17 }}>Place a facility</strong>
          <span style={{ fontSize: 14, color: '#44443F' }}>Click a spot and see who gains access.</span>
        </Link>
        <Link to="/optimise">
          <strong style={{ fontSize: 17 }}>Find the best sites</strong>
          <span style={{ fontSize: 14, color: '#44443F' }}>Pick 1, 3 or 10 sites for the most coverage.</span>
        </Link>
        <Link to="/index">
          <strong style={{ fontSize: 17 }}>Re-weight the index</strong>
          <span style={{ fontSize: 14, color: '#44443F' }}>See how the constituency ranking shifts.</span>
        </Link>
      </div>
      <p style={{ margin: '20px 0 0', fontSize: 13, lineHeight: 1.6, color: '#DCE9F9', maxWidth: 900 }}>
        Known limits: the simulators use straight-line distance times a street-detour factor fitted to the notebook's routed results, not
        true street routes.
        {h?.drive && h.drive_routed
          ? ` The fit is poor for hospitals within a 5-minute drive (${h.drive[0].toFixed(1)}% model vs ${h.drive_routed[0].toFixed(1)}% routed).`
          : ''}{' '}
        Care homes have no routed curve, so they use an averaged fit.
      </p>
    </section>
  );
}
