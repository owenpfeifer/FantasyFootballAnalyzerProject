// src/__tests__/WeeklyLineup.test.tsx
import React, { useState } from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import WeeklyLineup from '@/components/WeeklyLineup';
import { Player, DEFAULT_ROSTER_SETTINGS, LineupAssignment } from '@/lib/models';

const MOCK_PLAYERS: Player[] = [
  {
    id: '1',
    name: 'Josh Allen',
    position: 'QB',
    team: 'BUF',
    opponent: 'vs MIA',
    byeWeek: 12,
    injuryStatus: 'ACTIVE',
    adp: 18.5,
    tier: 1,
    seasonProjPts: 390.1,
    weeklyProjPts: 22.9,
    avgPts: 22.0,
  },
  {
    id: '2',
    name: 'Backup QB',
    position: 'QB',
    team: 'NYJ',
    opponent: '@ BUF',
    byeWeek: 12,
    injuryStatus: 'ACTIVE',
    adp: 110.0,
    tier: 4,
    seasonProjPts: 240.0,
    weeklyProjPts: 14.1,
    avgPts: 13.8,
  },
  {
    id: '3',
    name: 'Injured Star WR',
    position: 'WR',
    team: 'SF',
    opponent: '@ SEA',
    byeWeek: 9,
    injuryStatus: 'OUT',
    adp: 5.0,
    tier: 1,
    seasonProjPts: 310.0,
    weeklyProjPts: 18.2,
    avgPts: 18.0,
  },
];

function LineupTestHarness({ initialStarters = [], initialBench = [] }: {
  initialStarters?: { slot: string; player: Player }[];
  initialBench?: Player[];
}) {
  const [starters, setStarters] = useState<{ slot: LineupAssignment['slot']; player: Player }[]>(initialStarters);
  const [bench, setBench] = useState<Player[]>(initialBench);

  return (
    <WeeklyLineup
      allEspnPlayers={MOCK_PLAYERS}
      starters={starters}
      setStarters={setStarters}
      bench={bench}
      setBench={setBench}
      rosterSettings={{ ...DEFAULT_ROSTER_SETTINGS, currentWeek: 10 }}
      onUpdateRosterSettings={vi.fn()}
      isHydrated={true}
      onClearRoster={vi.fn()}
    />
  );
}

describe('Component 1: WeeklyLineup.tsx', () => {
  it('1. success scenario: searches player, adds to starter slot, and updates projected total', () => {
    render(<LineupTestHarness />);

    const searchInput = screen.getByPlaceholderText(/Search any NFL player or D\/ST/i);
    fireEvent.change(searchInput, { target: { value: 'Josh Allen' } });

    const addStarterBtn = screen.getByRole('button', { name: /Add Starter/i });
    fireEvent.click(addStarterBtn);

    expect(screen.getByText('Josh Allen')).toBeInTheDocument();
    expect(screen.getByText('22.90')).toBeInTheDocument();
  });

  it('2. failure/unusual scenario: prevents OUT player from showing Add Starter button and routes to Bench', () => {
    render(<LineupTestHarness />);

    const searchInput = screen.getByPlaceholderText(/Search any NFL player or D\/ST/i);
    fireEvent.change(searchInput, { target: { value: 'Injured Star WR' } });

    expect(screen.queryByRole('button', { name: /Add Starter/i })).not.toBeInTheDocument();

    const addBenchBtn = screen.getByRole('button', { name: /Add Bench/i });
    fireEvent.click(addBenchBtn);

    expect(screen.getByText('Injured Star WR')).toBeInTheDocument();
    expect(screen.getByText('0.00')).toBeInTheDocument();
  });

  it('3. failure/unusual scenario: clicking Optimize Lineup swaps a higher-scoring bench QB into QB slot', () => {
    render(
      <LineupTestHarness
        initialStarters={[{ slot: 'QB', player: MOCK_PLAYERS[1] }]}
        initialBench={[MOCK_PLAYERS[0]]}
      />
    );

    expect(screen.getByText('14.10')).toBeInTheDocument();

    const optimizeBtn = screen.getByRole('button', { name: /Optimize Lineup/i });
    fireEvent.click(optimizeBtn);

    expect(screen.getByText('22.90')).toBeInTheDocument();
  });
});