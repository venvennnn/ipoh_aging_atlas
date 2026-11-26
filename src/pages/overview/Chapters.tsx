import { useMemo, useState, type ReactNode } from 'react';
import { BorderSwatch, ColorKey, Dot, KeyItem, LineSwatch } from '../../components/ColorKey';
import { HoverCard } from '../../components/ui';
import { bestInk, fmt } from '../../lib/format';
import AtlasMap, { type CellProps } from '../../map/AtlasMap';
import { moneyScale, peopleScale, rasterKey } from './keys';
import type { AtlasData, Stats } from '../../lib/types';
import { robustRule } from './derive';

type Key = 'intro' | 'people' | 'health' | 'money' | 'access' | 'index';

interface Chapter {
  key: Key;
  kicker: string;
  h1: string;
  h2: string;
  body: string;
  facts: string[];
  cta: string;
  href: string;
}


function chaptersFrom(S: Stats): Chapter[] {
  const P = S.population;
  const bandarS = P.census_2020.find((c) => c.area === 'Bandar Ipoh (S)');
  const drive10 = S.health.cumulative_curves_minutes_0_120['Public clinic (KKM) · driving'][10];
  const inc = [...S.money.dun_income].sort((a, b) => a.median_2024 - b.median_2024);
  const lo = inc[0];
  const hi = inc[inc.length - 1];
  const ranked = [...S.index.dun].sort((a, b) => b.index - a.index);
  const rule = robustRule(S);
  return [
    {
      key: 'intro',
      kicker: 'LANDSCAPE STUDY · IPOH, PERAK',
      h1: `${fmt(P.aged65_2026)} older residents.`,
      h2: 'How far is care?',
      body: `Where people aged 65+ live in Ipoh, and how far they are from clinics, income, company and transport. Measured on ${fmt(P.hexagons)} hexagons of 400 m, from public data only.`,
      facts: [`${fmt(P.total_2026)} people`, `${fmt(P.hexagons)} hexagons`, 'Public data only'],
      cta: 'Read the analysis',
      href: '#findings',
    },
    {
      key: 'people',
      kicker: '01 / PEOPLE',
      h1: 'One in ten is 65+.',
      h2: 'More in the old town.',
      body: `${P.pct65.toFixed(1)}% of Ipoh is aged 65+.${bandarS ? ` In Bandar Ipoh (S) it is ${bandarS.pct65.toFixed(1)}%.` : ''} Each 100 m square is shaded by the number of older residents living in it.`,
      facts: [`${fmt(P.aged65_2026)} aged 65+`, 'Census 2020 shares', 'Meta 30 m layer'],
      cta: 'Where they live',
      href: '#people',
    },
    {
      key: 'health',
      kicker: '02 / HEALTH',
      h1: 'Close by car.',
      h2: 'Far on foot.',
      body: `${S.health.beyond_30min_walk_clinic_pct}% of residents 65+ live more than a 30-minute walk from a public clinic, yet ${Math.round(drive10)}% are within 10 minutes by car. Pale = close, dark red = far.`,
      facts: [`${S.health.clinics} public clinics`, 'Routed on real streets', `${fmt(S.health.beyond_30min_walk_clinic)} beyond 30 min`],
      cta: 'Travel times',
      href: '#health',
    },
    {
      key: 'money',
      kicker: '03 / MONEY',
      h1: 'Same city.',
      h2: 'Twice the income.',
      body: `Median household income runs from RM${fmt(lo.median_2024)} a month in ${lo.dun} to RM${fmt(hi.median_2024)} in ${hi.dun}, across the ${inc.length} constituencies that cover Ipoh.`,
      facts: [`${inc.length} DUNs`, 'DOSM HIES 2024', 'Official medians'],
      cta: 'Income by area',
      href: '#money',
    },
    {
      key: 'access',
      kicker: '04 / GETTING AROUND',
      h1: 'A stop nearby.',
      h2: 'A bus, rarely.',
      body: `${S.access.pct65_within_400m}% of residents 65+ live within 400 m of a bus stop. Only ${S.access.pct65_400m_2ph}% live near a stop served by two or more buses an hour.`,
      facts: [`${fmt(S.access.bus_stops)} bus stops`, 'BAS.MY timetable', `${fmt(S.access.weekday_trips)} weekday trips`],
      cta: 'Care, social, access',
      href: '#care',
    },
    {
      key: 'index',
      kicker: '05 / VULNERABILITY INDEX',
      h1: 'Where it all',
      h2: 'adds up.',
      body: `Five domains in one 0–100 score. ${ranked[0].dun} ranks most vulnerable at ${ranked[0].index}; ${ranked[1].dun} follows, home to ${fmt(ranked[1].aged65)} residents 65+.`,
      facts: ['12 metrics', '5 domains', `${rule.runs} re-weightings`],
      cta: 'Explore the index',
      href: '#index',
    },
  ];
}

/** A chapter's zoomable map with its hover card and colour key. */
function ChapterMap({ k, S, D }: { k: Exclude<Key, 'intro'>; S: Stats; D: AtlasData | null }) {
  const [hover, setHover] = useState<string | null>(null);
  const [cell, setCell] = useState<CellProps | null>(null);
  const inc = S.money.dun_income.map((d) => d.median_2024);
  const lo = Math.min(...inc);
  const hi = Math.max(...inc);
  const money = useMemo(() => moneyScale(lo, hi), [lo, hi]);
  const p65 = useMemo(() => (D ? peopleScale('p65', { p65: Math.max(...D.cells.p65), pop: Math.max(...D.cells.pop) }) : null), [D]);
  const dunFill = useMemo(() => {
    if (!D || k !== 'money') return null;
    return Object.fromEntries(D.dun.map((d) => [d.name, money.color(d.income)]));
  }, [D, k, money]);
  const dunInk = useMemo(() => (dunFill ? Object.fromEntries(Object.entries(dunFill).map(([n, c]) => [n, bestInk(c)])) : null), [dunFill]);
  const raster = useMemo(
    () => (k === 'health' ? { url: '/img/walk_clinic.png' } : k === 'access' ? { url: '/img/walk_bus.png' } : k === 'index' ? { url: '/img/index.png' } : null),
    [k],
  );
  const points = useMemo(
    () =>
      !D
        ? null
        : k === 'health'
          ? { list: D.fac.clinic, color: '#1C5CAB', radius: 7, strokeWidth: 2.5 }
          : k === 'access'
            ? { list: D.fac.bus, color: '#15181D', radius: 3, strokeWidth: 1 }
            : null,
    [D, k],
  );
  const p = S.money.dun_income;
  const dunRow = hover ? p.find((d) => d.dun === hover) : null;

  let label = '';
  let key: { title: string; stops: string[]; ticks: string[] } | null = null;
  let extra: ReactNode = <KeyItem swatch={<LineSwatch />}>Ipoh city boundary</KeyItem>;
  let card = { title: 'Hover the map', body: 'Ctrl/⌘ + scroll or + − to zoom; drag to pan.' };
  switch (k) {
    case 'people':
      label = 'Zoomable street map of residents aged 65+ in each 100 m square across Ipoh';
      key = p65?.key ?? null;
      if (cell) card = { title: `${cell.dun ? `${cell.dun} · ` : ''}${cell.area}`, body: `This 100 m square: ${cell.p65.toFixed(1)} aged 65+ of ${cell.pop.toFixed(0)} residents` };
      break;
    case 'health':
      label = `Zoomable street map of walking time to the nearest public clinic, with the ${S.health.clinics} clinics marked`;
      key = rasterKey(S, 'walk_clinic', 'Walking time to the nearest public clinic');
      extra = <KeyItem swatch={<Dot color="#1C5CAB" />}>Public clinic ({S.health.clinics})</KeyItem>;
      if (hover) card = { title: hover, body: 'Public clinic (KKM)' };
      break;
    case 'money':
      label = 'Zoomable street map of median household income by constituency, 2024';
      key = money.key;
      extra = <KeyItem swatch={<BorderSwatch />}>Constituency (DUN) border</KeyItem>;
      if (dunRow) card = { title: dunRow.dun, body: `Median RM${fmt(dunRow.median_2024)} / month (RM${fmt(dunRow.median_2019)} in 2019)` };
      break;
    case 'access':
      label = `Zoomable street map of walking time to the nearest bus stop, with the ${fmt(S.access.bus_stops)} stops marked`;
      key = rasterKey(S, 'walk_bus', 'Walking time to the nearest bus stop');
      extra = <KeyItem swatch={<Dot color="#15181D" size={6} ring={false} />}>Bus stop ({fmt(S.access.bus_stops)})</KeyItem>;
      if (hover) card = { title: hover, body: 'Bus stop' };
      break;
    case 'index':
      label = 'Zoomable street map of the ageing-vulnerability index across Ipoh, with constituency outlines';
      key = rasterKey(S, 'index', 'Ageing-vulnerability index');
      extra = (
        <>
          <KeyItem swatch={<LineSwatch width={1} opacity={0.5} />}>Constituency (DUN) border</KeyItem>
          <KeyItem swatch={<LineSwatch />}>Ipoh city boundary</KeyItem>
        </>
      );
      card = { title: 'Ageing-vulnerability index', body: 'Darker red = more vulnerable. Ctrl/⌘ + scroll or + − to zoom.' };
      break;
  }

  return (
    <figure className="chapter-visual">
      <AtlasMap
        D={D}
        label={label}
        raster={raster}
        cellColor={k === 'people' ? (p65?.expr ?? null) : null}
        points={points}
        dunFill={dunFill}
        dunLabels={dunInk}
        dunOutlines={k === 'index'}
        onCellHover={k === 'people' ? setCell : undefined}
        onPointHover={setHover}
        onDunHover={k === 'money' ? setHover : undefined}
      >
        <HoverCard title={card.title} body={card.body} />
      </AtlasMap>
      {key && <ColorKey {...key} extra={extra} />}
    </figure>
  );
}

/** The six opening chapters, stacked top to bottom on white. No animation. */
export default function Chapters({ stats, atlas }: { stats: Stats; atlas: AtlasData | null }) {
  const chapters = useMemo(() => chaptersFrom(stats), [stats]);
  const visual = (key: Key): ReactNode =>
    key === 'intro' ? (
      <figure className="chapter-visual">
        <img src="/img/ipoh_hero.jpg" alt="Ipoh" />
      </figure>
    ) : (
      <ChapterMap k={key} S={stats} D={atlas} />
    );

  return (
    <div className="chapters">
      {chapters.map((c) => (
        <section key={c.key} className="chapter" aria-labelledby={`chapter-${c.key}`}>
          <div>
            <p className="kicker">
              <span className="dot" aria-hidden="true" />
              {c.kicker}
            </p>
            <h2 id={`chapter-${c.key}`}>
              {c.h1}
              <br />
              <span className="l2">{c.h2}</span>
            </h2>
            <p className="body">{c.body}</p>
            <div className="chips">
              {c.facts.map((f) => (
                <span key={f}>{f}</span>
              ))}
            </div>
            <a href={c.href} className="chapter-cta">
              {c.cta}
              <span aria-hidden="true">↘</span>
            </a>
          </div>
          {visual(c.key)}
        </section>
      ))}
    </div>
  );
}
