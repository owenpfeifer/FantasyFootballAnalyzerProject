// src/__tests__/espnClient.test.tsx
import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import FFAAnalyzerApp from '@/app/page';
import { cacheStore } from '@/lib/cacheStore';
import { Player } from '@/lib/models';

const MOCK_API_PLAYERS: Player[] = [
  {
    id: 'espn-api-901',
    name: 'Joe Burrow',
    position: 'QB',
    team: 'CIN',
    opponent: 'vs BAL',
    byeWeek: 12,
    injuryStatus: 'ACTIVE',
    adp: 24.0,
    tier: 1,
    seasonProjPts: 368.0,
    weeklyProjPts: 21.6,
    avgPts: 21.2,
  },
];

describe('Component API Integration Test: FFAAnalyzerApp with ESPN API (espnClient.test.tsx)', () => {
  beforeEach(() => {
    window.localStorage.clear();
    // Bypass in-memory cacheStore between tests so each test exercises its own fetch mock
    vi.spyOn(cacheStore, 'get').mockReturnValue(null);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('1. success scenario: renders API player data into the lineup search when /api/espn succeeds', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        source: 'ESPN Live API',
        currentWeek: 10,
        players: MOCK_API_PLAYERS,
      }),
    });
    vi.stubGlobal('fetch', fetchMock);

    render(<FFAAnalyzerApp />);

    expect(await screen.findByText(/ESPN Live API \(1\)/i)).toBeInTheDocument();

    const searchInput = screen.getByPlaceholderText(/Search any NFL player or D\/ST/i);
    fireEvent.change(searchInput, { target: { value: 'Joe Burrow' } });

    expect(await screen.findByText('Joe Burrow')).toBeInTheDocument();
  });

  it('2. error scenario: handles an HTTP 500 API error gracefully and keeps Weekly Lineup usable', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: false,
      status: 500,
      json: async () => ({ error: 'Internal Server Error' }),
    });
    vi.stubGlobal('fetch', fetchMock);

    render(<FFAAnalyzerApp />);

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledTimes(1);
    });

    expect(screen.queryByText(/ESPN Live API/i)).not.toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /Weekly Lineup Optimizer/i })).toBeInTheDocument();
  });

  it('3. interaction scenario: switches tabs in FFAAnalyzerApp and keeps API-loaded data accessible', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        source: 'ESPN Live API',
        currentWeek: 10,
        players: MOCK_API_PLAYERS,
      }),
    });
    vi.stubGlobal('fetch', fetchMock);

    render(<FFAAnalyzerApp />);

    // Wait for API response to settle in Sidebar
    expect(await screen.findByText(/ESPN Live API \(1\)/i)).toBeInTheDocument();

    // Switch to Draft Assistance tab and back to Weekly Lineup tab
    const draftTabBtn = screen.getByRole('button', { name: /Draft Assistance/i });
    fireEvent.click(draftTabBtn);

    const lineupTabBtn = screen.getByRole('button', { name: /Weekly Lineup/i });
    fireEvent.click(lineupTabBtn);

    // Search for the API-loaded player after returning to Weekly Lineup
    const searchInput = screen.getByPlaceholderText(/Search any NFL player or D\/ST/i);
    fireEvent.change(searchInput, { target: { value: 'Joe Burrow' } });

    expect(await screen.findByText('Joe Burrow')).toBeInTheDocument();
  });
});