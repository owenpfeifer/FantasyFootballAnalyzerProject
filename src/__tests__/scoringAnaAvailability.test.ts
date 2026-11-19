// src/__tests__/scoringAndAvailability.test.ts
import { describe, it, expect } from 'vitest';
import { scalePlayerForScoring, getEffectiveWeeklyPts, Player } from '@/lib/models';

const baseMockPlayer: Player = {
  id: 'wr-test',
  name: 'Justin Jefferson',
  position: 'WR',
  team: 'MIN',
  opponent: '@ GB',
  byeWeek: 6,
  injuryStatus: 'ACTIVE',
  adp: 1.5,
  tier: 1,
  seasonProjPts: 340.0,
  weeklyProjPts: 20.0,
  avgPts: 19.5,
};

describe('Unit 4: scalePlayerForScoring() & getEffectiveWeeklyPts()', () => {
  it('1. expected input: scales WR projections down in HALF_PPR and STANDARD while preserving PPR', () => {
    const pprPlayer = scalePlayerForScoring(baseMockPlayer, 'PPR');
    const halfPlayer = scalePlayerForScoring(baseMockPlayer, 'HALF_PPR');
    const stdPlayer = scalePlayerForScoring(baseMockPlayer, 'STANDARD');

    expect(pprPlayer.weeklyProjPts).toBe(20.0);
    expect(halfPlayer.weeklyProjPts).toBe(17.2); // 20.0 * 0.86
    expect(stdPlayer.weeklyProjPts).toBe(14.4);  // 20.0 * 0.72
  });

  it('2. edge case: repeated scoring format toggles do not drift from original base projections', () => {
    const once = scalePlayerForScoring(baseMockPlayer, 'STANDARD');
    const twice = scalePlayerForScoring(once, 'HALF_PPR');
    const restored = scalePlayerForScoring(twice, 'PPR');

    expect(restored.weeklyProjPts).toBe(20.0);
    expect(restored.seasonProjPts).toBe(340.0);
  });

  it('3. edge case: returns 0 effective weekly points on a bye week or when OUT/IR', () => {
    const byePlayer = { ...baseMockPlayer, byeWeek: 6, injuryStatus: 'ACTIVE' as const };
    const outPlayer = { ...baseMockPlayer, byeWeek: 10, injuryStatus: 'OUT' as const };
    const irPlayer = { ...baseMockPlayer, byeWeek: 10, injuryStatus: 'IR' as const };

    expect(getEffectiveWeeklyPts(byePlayer, 6)).toBe(0);
    expect(getEffectiveWeeklyPts(outPlayer, 10)).toBe(0);
    expect(getEffectiveWeeklyPts(irPlayer, 10)).toBe(0);
  });

  it('4. invalid/unusual input: clamps negative or zero projection values without producing NaN', () => {
    const zeroOrNegPlayer: Player = {
      ...baseMockPlayer,
      seasonProjPts: 0,
      weeklyProjPts: -5,
      avgPts: 0,
    };

    const scaled = scalePlayerForScoring(zeroOrNegPlayer, 'HALF_PPR');
    const effPts = getEffectiveWeeklyPts(scaled, 10);

    expect(Number.isNaN(scaled.weeklyProjPts)).toBe(false);
    expect(Number.isNaN(effPts)).toBe(false);
    expect(scaled.weeklyProjPts).toBe(-4.3);
  });
});