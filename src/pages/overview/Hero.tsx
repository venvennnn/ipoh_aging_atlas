import { useMemo, useRef, useState, type KeyboardEvent } from 'react';
import { bestInk, fmt, inFrame, ramp } from '../../lib/format';
import type { AtlasData, Stats } from '../../lib/types';
import { robustRule } from './derive';

interface Chapter {
  key: 'intro' | 'people' | 'health' | 'money' | 'access' | 'index';
  tab: string;
  kicker: string;
  h1: string;
  h2: string;
  body: string;
  facts: string[];
  cta: string;
  href: string;
}

const DARKO = ['#14212D', '#5A3524', '#B9461A', '#F8B48C', '#FFF4EC'];
const DARKM = ['#1B3550', '#2E5C8A', '#86B6EF', '#DCE9F9'];

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
      tab: 'Ageing in Ipoh',
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
      tab: 'People',
      kicker: '01 / PEOPLE',
      h1: 'One in ten is 65+.',
      h2: 'More in the old town.',
      body: `${P.pct65.toFixed(1)}% of Ipoh is aged 65+.${bandarS ? ` In Bandar Ipoh (S) it is ${bandarS.pct65.toFixed(1)}%.` : ''} Each hexagon here glows with the number of older residents living in it.`,
      facts: [`${fmt(P.aged65_2026)} aged 65+`, 'Census 2020 shares', 'Meta 30 m layer'],
      cta: 'Where they live',
      href: '#people',
    },
    {
      key: 'health',
      tab: 'Health',
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
      tab: 'Money',
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
      tab: 'Getting around',
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
      tab: 'Index',
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

export default function Hero({ stats, atlas }: { stats: Stats; atlas: AtlasData | null }) {
  const chapters = useMemo(() => chaptersFrom(stats), [stats]);
  const [chap, setChap] = useState(0);
  const [cycle, setCycle] = useState(0); // restarts the progress bar
  const [hovered, setHovered] = useState(false);
  const [focused, setFocused] = useState(false);
  const paused = hovered || focused;
  const tabRefs = useRef<(HTMLButtonElement | null)[]>([]);

  const go = (i: number) => {
    setChap(i);
    setCycle((c) => c + 1);
  };
  const onTabKey = (e: KeyboardEvent, i: number) => {
    let j = -1;
    if (e.key === 'ArrowRight') j = (i + 1) % chapters.length;
    else if (e.key === 'ArrowLeft') j = (i + chapters.length - 1) % chapters.length;
    else if (e.key === 'Home') j = 0;
    else if (e.key === 'End') j = chapters.length - 1;
    if (j >= 0) {
      e.preventDefault();
      go(j);
      tabRefs.current[j]?.focus();
    }
  };

  const art = useMemo(() => {
    if (!atlas) return null;
    const inc = atlas.dun.map((d) => d.income);
    const lo = Math.min(...inc);
    const hi = Math.max(...inc);
    return {
      hex65: atlas.hex.map((h) => ({ d: h.d, fill: ramp(DARKO, Math.sqrt(h.p65 / 320)) })),
      dun: atlas.dun.map((d) => {
        const fill = ramp(DARKM, (d.income - lo) / (hi - lo));
        return { ...d, fill, ink: bestInk(fill, '#0A1622', '#FFFFFF') };
      }),
      clinics: atlas.fac.clinic.filter(inFrame),
      bus: atlas.fac.bus.filter(inFrame),
    };
  }, [atlas]);

  const layer = (key: Chapter['key']) => `hero-layer${chapters[chap].key === key ? ' on' : ''}`;
  const B = atlas?.boundary ?? '';

  return (
    <section
      className="hero on-dark"
      aria-label="Introduction"
      aria-roledescription="carousel"
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onFocus={(e) => {
        // Pause for keyboard focus only; a mouse click on a tab should restart the timer.
        if ((e.target as HTMLElement).matches(':focus-visible')) setFocused(true);
      }}
      onBlur={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget as Node)) setFocused(false);
      }}
    >
      <div className={layer('intro')} aria-hidden="true">
        <img src="/img/ipoh_hero.jpg" alt="" />
      </div>
      {art && (
        <>
          <div className={layer('people')} aria-hidden="true">
            <svg viewBox="0 0 740 800" className="hero-map">
              {art.hex65.map((h, i) => (
                <path key={i} d={h.d} fill={h.fill} />
              ))}
              <path d={B} fill="none" stroke="#DCE9F9" strokeOpacity={0.5} strokeWidth={1.4} />
            </svg>
          </div>
          <div className={layer('health')} aria-hidden="true">
            <svg viewBox="0 0 740 800" className="hero-map">
              <image href="/img/walk_clinic.png" x={0} y={0} width={740} height={800} preserveAspectRatio="none" />
              <path d={B} fill="none" stroke="#DCE9F9" strokeOpacity={0.6} strokeWidth={1.4} />
              {art.clinics.map((p, i) => (
                <circle key={i} cx={p.x} cy={p.y} r={8} fill="#86B6EF" stroke="#0A1622" strokeWidth={3} />
              ))}
            </svg>
          </div>
          <div className={layer('money')} aria-hidden="true">
            <svg viewBox="0 0 740 800" className="hero-map">
              {art.dun.map((d) => (
                <path key={d.code} d={d.d} fill={d.fill} stroke="#0A1622" strokeWidth={2.5} />
              ))}
              <path d={B} fill="none" stroke="#DCE9F9" strokeOpacity={0.6} strokeWidth={1.4} />
              {art.dun.map((d) => (
                <text key={d.code} x={d.x} y={d.y} textAnchor="middle" fontSize={12} fontWeight={700} fill={d.ink}>
                  RM{fmt(d.income)}
                </text>
              ))}
            </svg>
          </div>
          <div className={layer('access')} aria-hidden="true">
            <svg viewBox="0 0 740 800" className="hero-map">
              <image href="/img/walk_bus.png" x={0} y={0} width={740} height={800} preserveAspectRatio="none" />
              <path d={B} fill="none" stroke="#DCE9F9" strokeOpacity={0.6} strokeWidth={1.4} />
              {art.bus.map((p, i) => (
                <circle key={i} cx={p.x} cy={p.y} r={2.4} fill="#FFFFFF" />
              ))}
            </svg>
          </div>
          <div className={layer('index')} aria-hidden="true">
            <svg viewBox="0 0 740 800" className="hero-map">
              <image href="/img/index.png" x={0} y={0} width={740} height={800} preserveAspectRatio="none" />
              {art.dun.map((d) => (
                <path key={d.code} d={d.d} fill="none" stroke="#DCE9F9" strokeOpacity={0.35} strokeWidth={1} />
              ))}
              <path d={B} fill="none" stroke="#DCE9F9" strokeOpacity={0.6} strokeWidth={1.4} />
            </svg>
          </div>
        </>
      )}

      <div className="hero-shade" aria-hidden="true" />

      <div className="hero-top">
        <div className="hero-inner">
          <span style={{ letterSpacing: '0.02em' }}>Ipoh ageing study · five lenses on one city</span>
          <span className="hero-counter" aria-hidden="true">
            {chap === 0 ? '00' : `0${chap}`} / 05
          </span>
        </div>
      </div>

      <div className="hero-stage">
        <div className="hero-inner">
          {chapters.map((c, i) => {
            const on = i === chap;
            return (
              <article
                key={c.key}
                id={`chapter-${c.key}`}
                role="tabpanel"
                aria-labelledby={`chapter-tab-${c.key}`}
                aria-hidden={!on}
                className={`chapter${on ? ' on' : i < chap ? ' past' : ''}`}
              >
                <p className="kicker">
                  <span className="dot dc-pulse" aria-hidden="true" />
                  {c.kicker}
                </p>
                <h2>
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
                <a href={c.href} tabIndex={on ? 0 : -1} className="hero-cta">
                  {c.cta}
                  <span aria-hidden="true" style={{ fontSize: 18 }}>
                    ↘
                  </span>
                </a>
              </article>
            );
          })}
        </div>
      </div>

      <div className="hero-tabs-bar">
        <div className="hero-inner">
          <div role="tablist" aria-label="Chapters" className="hero-tabs">
            {chapters.map((c, i) => {
              const on = i === chap;
              return (
                <button
                  key={c.key}
                  ref={(el) => {
                    tabRefs.current[i] = el;
                  }}
                  id={`chapter-tab-${c.key}`}
                  type="button"
                  role="tab"
                  aria-selected={on}
                  aria-controls={`chapter-${c.key}`}
                  tabIndex={on ? 0 : -1}
                  className="hero-tab"
                  onClick={() => go(i)}
                  onKeyDown={(e) => onTabKey(e, i)}
                >
                  <span className="rail" aria-hidden="true" />
                  {on && (
                    <span
                      key={cycle}
                      className="prog dc-prog"
                      aria-hidden="true"
                      style={{ animationPlayState: paused ? 'paused' : 'running' }}
                      onAnimationEnd={() => go((chap + 1) % chapters.length)}
                    />
                  )}
                  <span className="num" aria-hidden="true">
                    0{i}
                  </span>
                  {c.tab}
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </section>
  );
}
