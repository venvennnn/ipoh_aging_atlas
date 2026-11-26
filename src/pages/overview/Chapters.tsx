import { useMemo, type ReactNode } from 'react';
import { bestInk, fmt, inFrame, ramp } from '../../lib/format';
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

const ORANGES = ['#FFF4EC', '#FDE0CC', '#F8B48C', '#B9461A', '#6E2408'];
const BLUES = ['#EEF4FC', '#CDE2FB', '#86B6EF', '#1C5CAB', '#0D366B'];

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
      body: `${P.pct65.toFixed(1)}% of Ipoh is aged 65+.${bandarS ? ` In Bandar Ipoh (S) it is ${bandarS.pct65.toFixed(1)}%.` : ''} Each hexagon is shaded by the number of older residents living in it.`,
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

function MapFigure({ label, caption, children }: { label: string; caption: string; children: ReactNode }) {
  return (
    <figure className="chapter-visual">
      <svg viewBox="0 0 740 800" role="img" aria-label={label}>
        {children}
      </svg>
      <figcaption>{caption}</figcaption>
    </figure>
  );
}

/** The six opening chapters, stacked top to bottom on white. No animation. */
export default function Chapters({ stats, atlas }: { stats: Stats; atlas: AtlasData | null }) {
  const chapters = useMemo(() => chaptersFrom(stats), [stats]);
  const art = useMemo(() => {
    if (!atlas) return null;
    const inc = atlas.dun.map((d) => d.income);
    const lo = Math.min(...inc);
    const hi = Math.max(...inc);
    return {
      hex65: atlas.hex.map((h) => ({ d: h.d, fill: ramp(ORANGES, Math.sqrt(h.p65 / 320)) })),
      dun: atlas.dun.map((d) => {
        const fill = ramp(BLUES, 0.1 + ((d.income - lo) / (hi - lo)) * 0.9);
        return { ...d, fill, ink: bestInk(fill) };
      }),
      clinics: atlas.fac.clinic.filter(inFrame),
      bus: atlas.fac.bus.filter(inFrame),
    };
  }, [atlas]);

  const B = atlas ? <path d={atlas.boundary} fill="none" stroke="#15181D" strokeWidth={1.6} /> : null;

  const visual = (key: Key): ReactNode => {
    if (key === 'intro') {
      return (
        <figure className="chapter-visual">
          <img src="/img/ipoh_hero.jpg" alt="Ipoh" />
        </figure>
      );
    }
    if (!art) return <div className="chapter-visual" aria-hidden="true" />;
    switch (key) {
      case 'people':
        return (
          <MapFigure label="Hexagon map of residents aged 65+ across Ipoh" caption="Residents 65+ per hexagon">
            {art.hex65.map((h, i) => (
              <path key={i} d={h.d} fill={h.fill} stroke="#FFFFFF" strokeWidth={0.6} />
            ))}
            {B}
          </MapFigure>
        );
      case 'health':
        return (
          <MapFigure label="Walking time to the nearest public clinic, with clinics marked" caption={`Walking time to a public clinic · ${stats.health.clinics} clinics`}>
            <image href="/img/walk_clinic.png" x={0} y={0} width={740} height={800} preserveAspectRatio="none" opacity={0.92} />
            {B}
            {art.clinics.map((p, i) => (
              <circle key={i} cx={p.x} cy={p.y} r={8} fill="#1C5CAB" stroke="#FFFFFF" strokeWidth={2.5} />
            ))}
          </MapFigure>
        );
      case 'money':
        return (
          <MapFigure label="Median household income by constituency in Ipoh, 2024" caption="Median household income per month, 2024">
            <defs>
              <clipPath id="chapter-city">
                <path d={atlas!.boundary} />
              </clipPath>
            </defs>
            <g clipPath="url(#chapter-city)">
              {art.dun.map((d) => (
                <path key={d.code} d={d.d} fill={d.fill} stroke="#FFFFFF" strokeWidth={2} />
              ))}
            </g>
            {B}
            {art.dun.map((d) => (
              <text key={d.code} x={d.x} y={d.y} textAnchor="middle" fontSize={12} fontWeight={700} fill={d.ink}>
                RM{fmt(d.income)}
              </text>
            ))}
          </MapFigure>
        );
      case 'access':
        return (
          <MapFigure label="Walking time to the nearest bus stop, with stops marked" caption={`Walking time to a bus stop · ${fmt(stats.access.bus_stops)} stops`}>
            <image href="/img/walk_bus.png" x={0} y={0} width={740} height={800} preserveAspectRatio="none" opacity={0.92} />
            {B}
            {art.bus.map((p, i) => (
              <circle key={i} cx={p.x} cy={p.y} r={2.4} fill="#15181D" />
            ))}
          </MapFigure>
        );
      case 'index':
        return (
          <MapFigure label="Ageing-vulnerability index across Ipoh, with constituency outlines" caption="Vulnerability index, 0 better to 100 worse">
            <image href="/img/index.png" x={0} y={0} width={740} height={800} preserveAspectRatio="none" />
            {art.dun.map((d) => (
              <path key={d.code} d={d.d} fill="none" stroke="#15181D" strokeWidth={0.8} strokeOpacity={0.45} />
            ))}
            {B}
          </MapFigure>
        );
    }
  };

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
