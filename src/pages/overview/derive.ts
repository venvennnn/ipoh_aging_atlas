import type { Stats } from '../../lib/types';

/** Numbers inside stats.index.robust.rule, e.g. "worst 10% under >=80% of 3,000 random weightings". */
export function robustRule(S: Stats) {
  const m = S.index.robust.rule.match(/worst\s+(\d+)%.*?(\d+)%\s+of\s+([\d,]+)/);
  return { worst: m?.[1] ?? '', share: m?.[2] ?? '', runs: m?.[3] ?? '' };
}

export const CURVE_STYLE: Record<string, { label: string; color: string; dash: string }> = {
  'Public clinic (KKM) · walking': { label: 'Clinic · walk', color: '#1C5CAB', dash: '' },
  'Public clinic (KKM) · driving': { label: 'Clinic · drive', color: '#1C5CAB', dash: '5 4' },
  'Hospital · walking': { label: 'Hospital · walk', color: '#B9461A', dash: '' },
  'Hospital · driving': { label: 'Hospital · drive', color: '#B9461A', dash: '5 4' },
};
