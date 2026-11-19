// src/__tests__/optimalDraft.test.ts
import { describe, it, expect } from 'vitest';
import { OptimalDraft } from '@/lib/analysisEngine';
import { Player, DEFAULT_ROSTER_SETTINGS, RosterSettings } from '@/lib/models';

const makePlayer = (overrides: Partial<Player>): Player => ({
  id: 'p-1',
  name: 'Test Player',
  position: 'WR',
  team: 'BUF',
  opponent: 'vs MIA',
  byeWeek: 12,
  injuryStatus: 'ACTIVE',
  adp: 20.0,
  tier: 2,
  seasonProjPts: 250.0,
  weeklyProjPts: 14.7,
  avgPts: 14.5,
  drafted: false,
  ...overrides,
});

describe('Unit 1: OptimalDraft()', () => {
  it('1. expected input: ranks undrafted high-VORP players at the top and excludes drafted players', () => {
    const pool: Player[] = [
      makePlayer({ id: '1', name: 'Drafted Star WR', position: 'WR', seasonProjPts: 340, drafted: true }),
      makePlayer({ id: '2', name: 'Elite WR Pick', position: 'WR', seasonProjPts: 310, adp: 10 }),
      makePlayer({ id: '3', name: 'Depth WR', position: 'WR', seasonProjPts: 192, adp: 65 }),
      makePlayer({ id: '4', name: 'Solid RB Pick', position: 'RB', seasonProjPts: 265, adp: 18 }),
    ];

    const result = OptimalDraft(pool, [], DEFAULT_ROSTER_SETTINGS);

    expect(result.rankedPool.some((p) => p.name === 'Drafted Star WR')).toBe(false);
    expect(result.recommendations.length).toBe(2);
    expect(result.recommendations[0].player.name).toBe('Elite WR Pick');
    expect(result.recommendations[0].vorp).toBe(120); // 310 - 190 WR baseline
  });

  it('2. edge case: returns empty recommendations and empty pool when given an empty player array', () => {
    const result = OptimalDraft([], [], DEFAULT_ROSTER_SETTINGS);

    expect(result.recommendations).toEqual([]);
    expect(result.rankedPool).toEqual([]);
    expect(result.missingNeeds).toEqual(['WR', 'RB', 'QB', 'TE']);
  });

  it('3. edge case: returns no recommendations when every player in the pool is already drafted', () => {
    const allDrafted: Player[] = [
      makePlayer({ id: '1', name: 'Player A', drafted: true }),
      makePlayer({ id: '2', name: 'Player B', drafted: true }),
    ];

    const result = OptimalDraft(allDrafted, [allDrafted[0]], DEFAULT_ROSTER_SETTINGS);

    expect(result.recommendations).toEqual([]);
    expect(result.rankedPool).toEqual([]);
  });

  it('4. unusual/boundary input: penalizes IR/SUSPENDED players and boosts QB in Superflex settings', () => {
    const superflexSettings: RosterSettings = {
      ...DEFAULT_ROSTER_SETTINGS,
      qb: 1,
      superflex: 1,
    };
    const pool: Player[] = [
      makePlayer({
        id: 'ir-1',
        name: 'Injured IR WR',
        position: 'WR',
        seasonProjPts: 215,
        injuryStatus: 'IR',
      }),
      makePlayer({
        id: 'qb-1',
        name: 'Top Superflex QB',
        position: 'QB',
        seasonProjPts: 350,
        injuryStatus: 'ACTIVE',
      }),
    ];

    const result = OptimalDraft(pool, [], superflexSettings);

    expect(result.recommendations[0].player.name).toBe('Top Superflex QB');
  });
});