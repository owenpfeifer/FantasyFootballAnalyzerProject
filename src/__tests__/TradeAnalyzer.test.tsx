// src/__tests__/TradeAnalyzer.test.tsx
import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import TradeAnalyzer from '@/components/TradeAnalyzer';
import { Player, DEFAULT_ROSTER_SETTINGS } from '@/lib/models';

const CARRIED_OVER_TEAM: Player[] = [
  {
    id: 'team-1',
    name: 'Carried Over RB',
    position: 'RB',
    team: 'DET',
    opponent: '@ CHI',
    byeWeek: 5,
    injuryStatus: 'ACTIVE',
    adp: 12.0,
    tier: 1,
    seasonProjPts: 280.0,
    weeklyProjPts: 16.5,
    avgPts: 16.2,
  },
];

const ESPN_POOL: Player[] = [
  ...CARRIED_OVER_TEAM,
  {
    id: 'espn-99',
    name: 'Target Elite WR',
    position: 'WR',
    team: 'CIN',
    opponent: 'vs BAL',
    byeWeek: 12,
    injuryStatus: 'ACTIVE',
    adp: 4.0,
    tier: 1,
    seasonProjPts: 325.0,
    weeklyProjPts: 21.0,
    avgPts: 20.1,
  },
];

describe('Component 2: TradeAnalyzer.tsx', () => {
  it('1. success scenario: selects carried-over team player, searches incoming player, and grades trade', () => {
    render(
      <TradeAnalyzer
        allEspnPlayers={ESPN_POOL}
        currentUserTeamPlayers={CARRIED_OVER_TEAM}
        rosterSettings={DEFAULT_ROSTER_SETTINGS}
        onApplyTradeToRoster={vi.fn()}
        onGoToLineup={vi.fn()}
      />
    );

    // Click carried-over team chip to send
    const teamChip = screen.getByRole('button', { name: /Carried Over RB/i });
    fireEvent.click(teamChip);

    // Search and add incoming player
    const receiveInput = screen.getByPlaceholderText(/Search ESPN player to receive/i);
    fireEvent.change(receiveInput, { target: { value: 'Target Elite WR' } });

    const addButtons = screen.getAllByRole('button', { name: /Add/i });
    fireEvent.click(addButtons[addButtons.length - 1]);

    // Analyze trade
    const analyzeBtn = screen.getByRole('button', { name: /Analyze Trade for My Team/i });
    fireEvent.click(analyzeBtn);

    // --- FIX GOES HERE ---
    const matchingDeltas = screen.getAllByText(/\+4\.5 Pts\/Wk/i);
    expect(matchingDeltas.length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText(/How This Trade Impacts Your Custom/i)).toBeInTheDocument();
  });

  it('2. failure/unusual scenario: keeps Analyze button disabled when one side of the trade is empty', () => {
    render(
      <TradeAnalyzer
        allEspnPlayers={ESPN_POOL}
        currentUserTeamPlayers={CARRIED_OVER_TEAM}
        rosterSettings={DEFAULT_ROSTER_SETTINGS}
        onApplyTradeToRoster={vi.fn()}
        onGoToLineup={vi.fn()}
      />
    );

    const teamChip = screen.getByRole('button', { name: /Carried Over RB/i });
    fireEvent.click(teamChip);

    const analyzeBtn = screen.getByRole('button', { name: /Analyze Trade for My Team/i });
    expect(analyzeBtn).toBeDisabled();
  });

  it('3. unusual scenario: prompts user to build team in Weekly Lineup when no team is carried over', () => {
    const onGoToLineup = vi.fn();

    render(
      <TradeAnalyzer
        allEspnPlayers={ESPN_POOL}
        currentUserTeamPlayers={[]}
        rosterSettings={DEFAULT_ROSTER_SETTINGS}
        onApplyTradeToRoster={vi.fn()}
        onGoToLineup={onGoToLineup}
      />
    );

    const promptBtn = screen.getByRole('button', { name: /No Team Entered/i });
    fireEvent.click(promptBtn);

    expect(onGoToLineup).toHaveBeenCalledTimes(1);
  });
});