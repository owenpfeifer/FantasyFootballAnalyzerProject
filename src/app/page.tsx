// src/app/page.tsx
'use client';

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  Player,
  LineupAssignment,
  RosterSettings,
  DEFAULT_ROSTER_SETTINGS,
  buildLineupSlots,
  scalePlayerForScoring,
} from '@/lib/models';
import { INITIAL_PLAYER_POOL } from '@/lib/cacheStore';
import { fetchEspnPlayers } from '@/lib/espnClient';
import { solveBestRoster } from '@/lib/analysisEngine';
import Sidebar, { ActiveTab } from '@/components/Sidebar';
import DraftAssistant from '@/components/DraftAssistant';
import WeeklyLineup from '@/components/WeeklyLineup';
import TradeAnalyzer from '@/components/TradeAnalyzer';

const STORAGE_KEYS = {
  STARTERS: 'ffa_lineup_starters_v1',
  BENCH: 'ffa_lineup_bench_v1',
  DRAFT_SLOT: 'ffa_draft_slot_v1',
  ROSTER_SETTINGS: 'ffa_roster_settings_v1',
  REFRESH_HISTORY: 'ffa_refresh_timestamps_v1',
};

const MAX_REFRESHES_PER_HOUR = 3;
const REFRESH_WINDOW_MS = 60 * 60 * 1000;
const COOLDOWN_MS = 60 * 1000;

export default function FFAAnalyzerApp() {
  const [activeTab, setActiveTab] = useState<ActiveTab>('lineup');

  const [rawEspnPlayers, setRawEspnPlayers] = useState<Player[]>(INITIAL_PLAYER_POOL);
  const [apiSource, setApiSource] = useState<string>('Loading...');
  const [isLoadingApi, setIsLoadingApi] = useState<boolean>(true);

  const [rosterSettings, setRosterSettings] = useState<RosterSettings>(DEFAULT_ROSTER_SETTINGS);
  const [draftPickSlot, setDraftPickSlot] = useState<number>(1);
  const [starters, setStarters] = useState<{ slot: LineupAssignment['slot']; player: Player }[]>([]);
  const [bench, setBench] = useState<Player[]>([]);
  const [isHydrated, setIsHydrated] = useState<boolean>(false);

  const loadEspnData = useCallback(async (forceRefresh = false) => {
    setIsLoadingApi(true);
    const { players, source, currentWeek } = await fetchEspnPlayers(2026, forceRefresh);
    setRawEspnPlayers(players);
    setApiSource(`${source} (${players.length})`);
    setIsLoadingApi(false);

    // Sync corrected byeWeek, team, opponent, and injuryStatus onto saved starters & bench
    const playerById = new Map<string, Player>(players.map((p) => [p.id, p]));
    const playerByName = new Map<string, Player>(
      players.map((p) => [p.name.toLowerCase(), p])
    );

    setStarters((prev) =>
      prev.map((s) => {
        const fresh =
          playerById.get(s.player.id) || playerByName.get(s.player.name.toLowerCase());
        return fresh
          ? {
              ...s,
              player: {
                ...s.player,
                team: fresh.team,
                injuryStatus: fresh.injuryStatus,
                byeWeek: fresh.byeWeek,
                opponent: fresh.opponent,
              },
            }
          : s;
      })
    );

    setBench((prev) =>
      prev.map((p) => {
        const fresh = playerById.get(p.id) || playerByName.get(p.name.toLowerCase());
        return fresh
          ? {
              ...p,
              team: fresh.team,
              injuryStatus: fresh.injuryStatus,
              byeWeek: fresh.byeWeek,
              opponent: fresh.opponent,
            }
          : p;
      })
    );

    if (currentWeek) {
      setRosterSettings((prev) => ({ ...prev, currentWeek }));
    }
  }, []);

  // Silent background rate-limiter for live ESPN refreshes
  const handleSilentRefreshEspn = useCallback(() => {
    const now = Date.now();
    let allowLivePull = true;

    try {
      const rawHistory = window.localStorage.getItem(STORAGE_KEYS.REFRESH_HISTORY);
      const parsed: number[] = rawHistory ? JSON.parse(rawHistory) : [];
      const validRecent = Array.isArray(parsed)
        ? parsed.filter((ts) => now - ts < REFRESH_WINDOW_MS)
        : [];
      const lastTs = validRecent[validRecent.length - 1] || 0;

      if (validRecent.length >= MAX_REFRESHES_PER_HOUR || now - lastTs < COOLDOWN_MS) {
        allowLivePull = false;
      } else {
        window.localStorage.setItem(
          STORAGE_KEYS.REFRESH_HISTORY,
          JSON.stringify([...validRecent, now])
        );
      }
    } catch {
      allowLivePull = false;
    }

    loadEspnData(allowLivePull);
  }, [loadEspnData]);

  useEffect(() => {
    loadEspnData(false);
  }, [loadEspnData]);

  const allEspnPlayers = useMemo(() => {
    return rawEspnPlayers.map((p) => scalePlayerForScoring(p, rosterSettings.scoringFormat));
  }, [rawEspnPlayers, rosterSettings.scoringFormat]);

  useEffect(() => {
    try {
      const savedStarters = window.localStorage.getItem(STORAGE_KEYS.STARTERS);
      const savedBench = window.localStorage.getItem(STORAGE_KEYS.BENCH);
      const savedDraftSlot = window.localStorage.getItem(STORAGE_KEYS.DRAFT_SLOT);
      const savedSettings = window.localStorage.getItem(STORAGE_KEYS.ROSTER_SETTINGS);

      let activeFormat = DEFAULT_ROSTER_SETTINGS.scoringFormat;
      if (savedSettings) {
        const parsedSettings = JSON.parse(savedSettings);
        const merged = { ...DEFAULT_ROSTER_SETTINGS, ...parsedSettings };
        activeFormat = merged.scoringFormat;
        setRosterSettings(merged);
      }
      if (savedStarters) {
        const parsedStarters = JSON.parse(savedStarters);
        if (Array.isArray(parsedStarters)) {
          setStarters(
            parsedStarters.map((s) => ({
              ...s,
              player: scalePlayerForScoring(s.player, activeFormat),
            }))
          );
        }
      }
      if (savedBench) {
        const parsedBench = JSON.parse(savedBench);
        if (Array.isArray(parsedBench)) {
          setBench(parsedBench.map((p) => scalePlayerForScoring(p, activeFormat)));
        }
      }
      if (savedDraftSlot) {
        const slotNum = Number(savedDraftSlot);
        if (slotNum >= 1 && slotNum <= 20) setDraftPickSlot(slotNum);
      }
    } catch (err) {
      console.error('Failed to load state from localStorage:', err);
    } finally {
      setIsHydrated(true);
    }
  }, []);

  useEffect(() => {
    if (!isHydrated) return;
    try {
      window.localStorage.setItem(STORAGE_KEYS.STARTERS, JSON.stringify(starters));
      window.localStorage.setItem(STORAGE_KEYS.BENCH, JSON.stringify(bench));
      window.localStorage.setItem(STORAGE_KEYS.DRAFT_SLOT, String(draftPickSlot));
      window.localStorage.setItem(STORAGE_KEYS.ROSTER_SETTINGS, JSON.stringify(rosterSettings));
    } catch (err) {
      console.error('Failed to save state to localStorage:', err);
    }
  }, [starters, bench, draftPickSlot, rosterSettings, isHydrated]);

  const currentUserTeamPlayers = useMemo(() => {
    return [...starters.map((s) => s.player), ...bench];
  }, [starters, bench]);

  const handleUpdateRosterSettings = (nextSettings: RosterSettings) => {
    const formatChanged = nextSettings.scoringFormat !== rosterSettings.scoringFormat;
    setRosterSettings(nextSettings);

    if (draftPickSlot > nextSettings.numTeams) {
      setDraftPickSlot(nextSettings.numTeams);
    }

    const validSlotSet = new Set(buildLineupSlots(nextSettings));
    const keptStarters: { slot: LineupAssignment['slot']; player: Player }[] = [];
    const displacedToBench: Player[] = [];

    starters.forEach((s) => {
      const scaledPlayer = formatChanged
        ? scalePlayerForScoring(s.player, nextSettings.scoringFormat)
        : s.player;

      if (validSlotSet.has(s.slot)) {
        keptStarters.push({ slot: s.slot, player: scaledPlayer });
      } else {
        displacedToBench.push(scaledPlayer);
      }
    });

    setStarters(keptStarters);
    setBench((prev) => {
      const scaledBench = formatChanged
        ? prev.map((p) => scalePlayerForScoring(p, nextSettings.scoringFormat))
        : prev;
      return [...scaledBench, ...displacedToBench];
    });
  };

  const handleClearRoster = () => {
    setStarters([]);
    setBench([]);
    try {
      window.localStorage.removeItem(STORAGE_KEYS.STARTERS);
      window.localStorage.removeItem(STORAGE_KEYS.BENCH);
    } catch {
      // Ignore storage errors
    }
  };

  const handleApplyTradeToRoster = (sendPlayers: Player[], receivePlayers: Player[]) => {
    const sendIds = new Set(sendPlayers.map((p) => p.id));
    const remainingRoster = currentUserTeamPlayers.filter((p) => !sendIds.has(p.id));
    const updatedRoster = [...remainingRoster, ...receivePlayers];
    const solved = solveBestRoster(updatedRoster, rosterSettings);
    setStarters(solved.starters);
    setBench(solved.bench);
  };

  return (
    <div className="min-h-screen bg-[#070b14] text-slate-100 flex font-sans">
      <Sidebar
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        rosterCount={currentUserTeamPlayers.length}
        isHydrated={isHydrated}
        isLoadingApi={isLoadingApi}
        apiSource={apiSource}
        onRefreshEspn={handleSilentRefreshEspn}
      />

      <main className="flex-1 p-8 overflow-y-auto">
        {activeTab === 'draft' && (
          <DraftAssistant
            allEspnPlayers={allEspnPlayers}
            draftPickSlot={draftPickSlot}
            setDraftPickSlot={setDraftPickSlot}
            rosterSettings={rosterSettings}
          />
        )}

        {activeTab === 'lineup' && (
          <WeeklyLineup
            allEspnPlayers={allEspnPlayers}
            starters={starters}
            setStarters={setStarters}
            bench={bench}
            setBench={setBench}
            rosterSettings={rosterSettings}
            onUpdateRosterSettings={handleUpdateRosterSettings}
            isHydrated={isHydrated}
            onClearRoster={handleClearRoster}
          />
        )}

        {activeTab === 'trade' && (
          <TradeAnalyzer
            allEspnPlayers={allEspnPlayers}
            currentUserTeamPlayers={currentUserTeamPlayers}
            rosterSettings={rosterSettings}
            onApplyTradeToRoster={handleApplyTradeToRoster}
            onGoToLineup={() => setActiveTab('lineup')}
          />
        )}
      </main>
    </div>
  );
}