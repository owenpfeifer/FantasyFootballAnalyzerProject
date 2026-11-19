// src/__tests__/tradeGrader.test.ts
import { describe, it, expect } from 'vitest';
import { TradeGrader } from '@/lib/analysisEngine';
import { Player, DEFAULT_ROSTER_SETTINGS } from '@/lib/models';

const makePlayer = (overrides: Partial<Player>): Player => ({
  id: 'p-1',
  name: 'Trade Player',
  position: 'WR',
  team: 'MIN',
  opponent: '@ GB',
  byeWeek: 6,
  injuryStatus: 'ACTIVE',
  adp: 15.0,
  tier: 2,
  seasonProjPts: 260.0,
  weeklyProjPts: 15.0,
  avgPts: 14.8,
  ...overrides,
});

describe('Unit 3: TradeGrader()', () => {
  it('1. expected input: computes positive net differential and high grade when receiving higher weekly points', () => {
    const send = [makePlayer({ id: 's1', name: 'Bench WR', position: 'WR', weeklyProjPts: 10.0 })];
    const receive = [makePlayer({ id: 'r1', name: 'Star WR', position: 'WR', weeklyProjPts: 21.0 })];

    const grade = TradeGrader({ sendPlayers: send, receivePlayers: receive });

    expect(grade.netPointDifferential).toBe(11.0);
    expect(grade.letterGrade).toBe('A+');
    expect(grade.recommendation).toBe('ACCEPT');
  });

  it('2. edge case: evaluates trade with no carried-over team context (hasTeamContext = false)', () => {
    const send = [makePlayer({ id: 's1', name: 'Player A', weeklyProjPts: 16.0 })];
    const receive = [makePlayer({ id: 'r1', name: 'Player B', weeklyProjPts: 12.0 })];

    const grade = TradeGrader({ sendPlayers: send, receivePlayers: receive }, undefined);

    expect(grade.hasTeamContext).toBe(false);
    expect(grade.netPointDifferential).toBe(-4.0);
    expect(grade.recommendation).toBe('DECLINE');
  });

  it('3. unusual condition: warns when trading away the sole QB leaves the QB starting slot empty', () => {
    const soleQb = makePlayer({ id: 'qb-only', name: 'Only QB', position: 'QB', weeklyProjPts: 22.0 });
    const incomingWr = makePlayer({ id: 'wr-in', name: 'Incoming WR', position: 'WR', weeklyProjPts: 16.0 });

    const grade = TradeGrader(
      { sendPlayers: [soleQb], receivePlayers: [incomingWr] },
      { teamId: 't1', teamName: 'My Team', roster: [soleQb], draftPicks: [] },
      DEFAULT_ROSTER_SETTINGS
    );

    expect(grade.hasTeamContext).toBe(true);
    expect(grade.teamFitInsights.some((msg) => msg.includes('Positional Warning') && msg.includes('QB'))).toBe(true);
  });

  it('4. unusual condition: flags injury designation on an incoming trade target', () => {
    const send = [makePlayer({ id: 's1', name: 'Healthy RB', position: 'RB', weeklyProjPts: 14.0 })];
    const receive = [
      makePlayer({
        id: 'r1',
        name: 'Injured Star',
        position: 'WR',
        weeklyProjPts: 18.0,
        injuryStatus: 'QUESTIONABLE',
      }),
    ];

    const grade = TradeGrader({ sendPlayers: send, receivePlayers: receive });

    expect(grade.teamFitInsights.some((msg) => msg.includes('Injury Alert') && msg.includes('QUESTIONABLE'))).toBe(true);
  });
});