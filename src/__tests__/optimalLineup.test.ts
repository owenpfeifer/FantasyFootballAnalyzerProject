// src/__tests__/optimalLineup.test.ts
import { describe, it, expect } from 'vitest';
import { OptimalLineup, solveBestRoster } from '@/lib/analysisEngine';
import { Player, DEFAULT_ROSTER_SETTINGS, RosterSettings } from '@/lib/models';

const makePlayer = (overrides: Partial<Player>): Player => ({
  id: 'p-1',
  name: 'Test Player',
  position: 'WR',
  team: 'DAL',
  opponent: 'vs PHI',
  byeWeek: 7,
  injuryStatus: 'ACTIVE',
  adp: 25.0,
  tier: 2,
  seasonProjPts: 220.0,
  weeklyProjPts: 13.0,
  avgPts: 13.0,
  ...overrides,
});

describe('Unit 2: OptimalLineup() & solveBestRoster()', () => {
  it('1. expected input: flags a suboptimal starter when a healthy bench player has higher weekly points', () => {
    const settings: RosterSettings = { ...DEFAULT_ROSTER_SETTINGS, currentWeek: 10 };
    const starterWr = makePlayer({ id: 'w1', name: 'Low Starter WR', position: 'WR', weeklyProjPts: 8.5 });
    const benchWr = makePlayer({ id: 'w2', name: 'High Bench WR', position: 'WR', weeklyProjPts: 17.4 });

    const evalResult = OptimalLineup([{ slot: 'WR1', player: starterWr }], [benchWr], settings);

    expect(evalResult.suboptimalCount).toBe(1);
    expect(evalResult.starters[0].isSuboptimal).toBe(true);
    expect(evalResult.starters[0].suggestedReplacement?.name).toBe('High Bench WR');
    expect(evalResult.starters[0].pointGain).toBe(8.9);
  });

  it('2. edge case: handles an empty roster cleanly with 0 projected points and no starters', () => {
    const evalResult = OptimalLineup([], [], DEFAULT_ROSTER_SETTINGS);
    const solvedEmpty = solveBestRoster([], DEFAULT_ROSTER_SETTINGS);

    expect(evalResult.projectedTotal).toBe(0);
    expect(evalResult.suboptimalCount).toBe(0);
    expect(solvedEmpty.starters).toEqual([]);
    expect(solvedEmpty.bench).toEqual([]);
  });

  it('3. unusual/error condition: excludes BYE-week and OUT/IR players from starting lineup recommendations', () => {
    const settings: RosterSettings = { ...DEFAULT_ROSTER_SETTINGS, currentWeek: 10 };
    const byeQb = makePlayer({ id: 'q-bye', name: 'Bye Week QB', position: 'QB', byeWeek: 10, weeklyProjPts: 25.0 });
    const outQb = makePlayer({ id: 'q-out', name: 'Injured Out QB', position: 'QB', byeWeek: 7, injuryStatus: 'OUT', weeklyProjPts: 24.0 });
    const healthyQb = makePlayer({ id: 'q-ok', name: 'Healthy Starter QB', position: 'QB', byeWeek: 7, injuryStatus: 'ACTIVE', weeklyProjPts: 18.2 });

    const solved = solveBestRoster([byeQb, outQb, healthyQb], settings);
    const qbSlot = solved.starters.find((s) => s.slot === 'QB');

    expect(qbSlot?.player.name).toBe('Healthy Starter QB');
    expect(solved.bench.some((p) => p.name === 'Bye Week QB')).toBe(true);
    expect(solved.bench.some((p) => p.name === 'Injured Out QB')).toBe(true);
  });

  it('4. expected input: fills multiple FLEX slots with highest-scoring eligible non-starters', () => {
    const settings: RosterSettings = {
      ...DEFAULT_ROSTER_SETTINGS,
      currentWeek: 10,
      rb: 1,
      wr: 1,
      te: 0,
      flex: 2,
      k: 0,
    };
    const players: Player[] = [
      makePlayer({ id: 'rb1', name: 'RB One', position: 'RB', weeklyProjPts: 19.0 }),
      makePlayer({ id: 'rb2', name: 'RB Two', position: 'RB', weeklyProjPts: 16.5 }),
      makePlayer({ id: 'wr1', name: 'WR One', position: 'WR', weeklyProjPts: 18.0 }),
      makePlayer({ id: 'wr2', name: 'WR Two', position: 'WR', weeklyProjPts: 15.0 }),
    ];

    const solved = solveBestRoster(players, settings);
    const flex1 = solved.starters.find((s) => s.slot === 'FLEX1');
    const flex2 = solved.starters.find((s) => s.slot === 'FLEX2');

    expect(flex1?.player.name).toBe('RB Two');
    expect(flex2?.player.name).toBe('WR Two');
    expect(solved.bench.length).toBe(0);
  });
});