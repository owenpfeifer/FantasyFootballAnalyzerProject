// src/components/WeeklyLineup.tsx
'use client';

import React, { useState, useMemo } from 'react';
import {
  Search,
  Zap,
  AlertCircle,
  Plus,
  Minus,
  X,
  Trash2,
  HardDrive,
  SlidersHorizontal,
  Calendar,
} from 'lucide-react';
import {
  Player,
  Position,
  LineupSlot,
  ScoringFormat,
  SCORING_LABELS,
  RosterSettings,
  DEFAULT_ROSTER_SETTINGS,
  buildLineupSlots,
  isPositionEligibleForSlot,
  isPlayerUnavailableForWeek,
  getPlayerUnavailabilityLabel,
  getEffectiveWeeklyPts,
  LineupAssignment,
} from '@/lib/models';
import { OptimalLineup, solveBestRoster } from '@/lib/analysisEngine';

const POS_BADGE_STYLES: Record<Position, string> = {
  QB: 'bg-purple-950/80 text-purple-300 border-purple-700/50',
  RB: 'bg-emerald-950/80 text-emerald-300 border-emerald-700/50',
  WR: 'bg-blue-950/80 text-blue-300 border-blue-700/50',
  TE: 'bg-amber-950/80 text-amber-300 border-amber-700/50',
  K: 'bg-cyan-950/80 text-cyan-300 border-cyan-700/50',
  'D/ST': 'bg-slate-800 text-slate-300 border-slate-600',
};

function renderStatusBadge(player: Player, currentWeek: number) {
  const label = getPlayerUnavailabilityLabel(player, currentWeek);
  if (!label) return null;

  const isSevere =
    player.byeWeek === currentWeek ||
    ['OUT', 'IR', 'SUSPENDED', 'DOUBTFUL'].includes(player.injuryStatus || '');

  return (
    <span
      className={`px-1.5 py-0.5 rounded text-[10px] font-bold uppercase tracking-wide border ${
        isSevere
          ? 'bg-rose-950/90 text-rose-300 border-rose-700/70'
          : 'bg-amber-950/90 text-amber-300 border-amber-700/70'
      }`}
    >
      {label}
    </span>
  );
}

interface WeeklyLineupProps {
  allEspnPlayers: Player[];
  starters: { slot: LineupAssignment['slot']; player: Player }[];
  setStarters: React.Dispatch<
    React.SetStateAction<{ slot: LineupAssignment['slot']; player: Player }[]>
  >;
  bench: Player[];
  setBench: React.Dispatch<React.SetStateAction<Player[]>>;
  rosterSettings: RosterSettings;
  onUpdateRosterSettings: (next: RosterSettings) => void;
  isHydrated: boolean;
  onClearRoster: () => void;
}

export default function WeeklyLineup({
  allEspnPlayers,
  starters,
  setStarters,
  bench,
  setBench,
  rosterSettings,
  onUpdateRosterSettings,
  isHydrated,
  onClearRoster,
}: WeeklyLineupProps) {
  const [addPlayerSearchQuery, setAddPlayerSearchQuery] = useState('');
  const [rosterFilterQuery, setRosterFilterQuery] = useState('');
  const [showSettingsPanel, setShowSettingsPanel] = useState(false);

  const currentWeek = rosterSettings.currentWeek;

  const activeSlots = useMemo(
    () => buildLineupSlots(rosterSettings),
    [rosterSettings]
  );

  const currentUserTeamPlayers = useMemo(() => {
    return [...starters.map((s) => s.player), ...bench];
  }, [starters, bench]);

  const lineupEvaluation = useMemo(
    () => OptimalLineup(starters, bench, rosterSettings),
    [starters, bench, rosterSettings]
  );

  const espnAddToTeamResults = useMemo(() => {
    const q = addPlayerSearchQuery.toLowerCase().trim();
    if (!q) return [];
    const existingIds = new Set(currentUserTeamPlayers.map((p) => p.id));
    return allEspnPlayers
      .filter(
        (p) =>
          !existingIds.has(p.id) &&
          (p.name.toLowerCase().includes(q) ||
            p.team.toLowerCase().includes(q) ||
            p.position.toLowerCase().includes(q))
      )
      .slice(0, 10);
  }, [addPlayerSearchQuery, allEspnPlayers, currentUserTeamPlayers]);

  const findOpenSlotForPosition = (pos: Position): LineupSlot | null => {
    const filledSlots = new Set(starters.map((s) => s.slot));
    const dedicatedSlot = activeSlots.find(
      (slot) =>
        !filledSlots.has(slot) &&
        !slot.startsWith('FLEX') &&
        !slot.startsWith('SFLX') &&
        isPositionEligibleForSlot(pos, slot)
    );
    if (dedicatedSlot) return dedicatedSlot;

    const flexSlot = activeSlots.find(
      (slot) => !filledSlots.has(slot) && isPositionEligibleForSlot(pos, slot)
    );
    return flexSlot || null;
  };

  const handleAddPlayerToRoster = (
    player: Player,
    destination: 'AUTO_STARTER' | 'BENCH'
  ) => {
    // If player is on Bye or Out/IR/Doubtful, send to Bench automatically when clicking Add
    const unavailable = isPlayerUnavailableForWeek(player, currentWeek);
    if (destination === 'BENCH' || unavailable) {
      setBench((prev) => [...prev, player]);
    } else {
      const targetSlot = findOpenSlotForPosition(player.position);
      if (targetSlot) {
        setStarters((prev) => [...prev, { slot: targetSlot, player }]);
      } else {
        setBench((prev) => [...prev, player]);
      }
    }
    setAddPlayerSearchQuery('');
  };

  const handleRemoveStarter = (slot: LineupSlot) => {
    setStarters((prev) => prev.filter((s) => s.slot !== slot));
  };

  const handleRemoveFromBench = (playerId: string) => {
    setBench((prev) => prev.filter((p) => p.id !== playerId));
  };

  const handleOptimizeLineup = () => {
    if (currentUserTeamPlayers.length === 0) return;
    const solved = solveBestRoster(currentUserTeamPlayers, rosterSettings);
    setStarters(solved.starters);
    setBench(solved.bench);
  };

  const adjustSetting = (
    key: Exclude<keyof RosterSettings, 'scoringFormat'>,
    delta: number,
    min: number,
    max: number
  ) => {
    const nextVal = Math.max(min, Math.min(max, rosterSettings[key] + delta));
    onUpdateRosterSettings({
      ...rosterSettings,
      [key]: nextVal,
    });
  };

  const handleScoringFormatChange = (format: ScoringFormat) => {
    onUpdateRosterSettings({
      ...rosterSettings,
      scoringFormat: format,
    });
  };

  const settingControls: {
    key: Exclude<keyof RosterSettings, 'scoringFormat' | 'currentWeek'>;
    label: string;
    sub: string;
    min: number;
    max: number;
  }[] = [
    { key: 'numTeams', label: 'League Teams', sub: '4–20 Teams', min: 4, max: 20 },
    { key: 'qb', label: 'QB Slots', sub: 'Quarterback', min: 0, max: 3 },
    { key: 'rb', label: 'RB Slots', sub: 'Running Back', min: 0, max: 4 },
    { key: 'wr', label: 'WR Slots', sub: 'Wide Receiver', min: 0, max: 5 },
    { key: 'te', label: 'TE Slots', sub: 'Tight End', min: 0, max: 3 },
    { key: 'flex', label: 'FLEX Slots', sub: 'RB / WR / TE', min: 0, max: 4 },
    { key: 'superflex', label: 'Superflex', sub: 'QB / RB / WR / TE', min: 0, max: 2 },
    { key: 'k', label: 'Kicker (K)', sub: 'Placekicker', min: 0, max: 2 },
    { key: 'dst', label: 'Team D/ST', sub: 'Defense', min: 0, max: 2 },
    { key: 'bench', label: 'Bench Spots', sub: 'Reserve Slots', min: 0, max: 15 },
  ];

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-800/80 pb-5">
        <div>
          <div className="flex items-center gap-3">
            <h2 className="text-2xl font-bold text-white">Weekly Lineup Optimizer</h2>
            {isHydrated && (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-md text-[11px] font-medium bg-slate-900 text-slate-400 border border-slate-800">
                <HardDrive className="w-3 h-3 text-emerald-400" />
                Saved to localStorage
              </span>
            )}
          </div>
          <p className="text-sm text-slate-400 mt-1">
            <strong className="text-emerald-400">{SCORING_LABELS[rosterSettings.scoringFormat]}</strong> •{' '}
            Week {currentWeek} • {activeSlots.length} Starters ({rosterSettings.flex} FLEX
            {rosterSettings.superflex > 0 ? `, ${rosterSettings.superflex} SFLX` : ''})
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {/* Active NFL Week Selector for Bye Week Detection */}
          <div className="flex items-center gap-2 px-3 py-2.5 rounded-xl bg-[#0b101e] border border-slate-700/80">
            <Calendar className="w-4 h-4 text-emerald-400" />
            <label htmlFor="week-select" className="text-xs font-semibold text-slate-300">
              NFL Week:
            </label>
            <select
              id="week-select"
              value={currentWeek}
              onChange={(e) =>
                onUpdateRosterSettings({
                  ...rosterSettings,
                  currentWeek: Number(e.target.value),
                })
              }
              className="bg-slate-900 border border-slate-700 text-white font-bold text-xs rounded-lg px-2 py-1 focus:outline-none focus:border-emerald-500 cursor-pointer"
            >
              {Array.from({ length: 18 }, (_, i) => i + 1).map((wk) => (
                <option key={wk} value={wk}>
                  Week {wk}
                </option>
              ))}
            </select>
          </div>

          <div className="text-right mx-2">
            <div className="text-[11px] uppercase tracking-wider text-slate-400">
              Projected Total
            </div>
            <div className="text-3xl font-extrabold text-white">
              {lineupEvaluation.projectedTotal.toFixed(2)}
            </div>
          </div>

          <button
            onClick={() => setShowSettingsPanel((prev) => !prev)}
            className={`flex items-center gap-2 px-4 py-3 rounded-xl text-xs font-bold border transition ${
              showSettingsPanel
                ? 'bg-blue-600 text-white border-blue-500'
                : 'bg-[#0b101e] hover:bg-slate-800 text-slate-200 border-slate-700'
            }`}
          >
            <SlidersHorizontal className="w-4 h-4" />
            League Settings
          </button>

          {currentUserTeamPlayers.length > 0 && (
            <button
              onClick={onClearRoster}
              className="flex items-center gap-1.5 px-3.5 py-3 rounded-xl bg-slate-900 hover:bg-rose-950/80 text-slate-300 hover:text-rose-300 border border-slate-800 text-xs font-semibold transition"
            >
              <Trash2 className="w-4 h-4" />
              Clear
            </button>
          )}

          <button
            onClick={handleOptimizeLineup}
            disabled={currentUserTeamPlayers.length === 0}
            className="flex items-center gap-2 px-5 py-3 rounded-xl bg-emerald-500 hover:bg-emerald-400 disabled:opacity-40 text-slate-950 font-bold text-sm transition shadow-lg shadow-emerald-500/10"
          >
            <Zap className="w-4 h-4 fill-current" />
            Optimize Lineup
          </button>
        </div>
      </div>

      {/* Collapsible League, Scoring & Roster Settings Configuration Panel */}
      {showSettingsPanel && (
        <div className="p-5 rounded-2xl bg-[#0b101e] border border-blue-500/40 space-y-5">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-800 pb-4">
            <div>
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <SlidersHorizontal className="w-4 h-4 text-blue-400" />
                Customize Scoring Format, League Size &amp; Starting Slots
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">
                Adjusting scoring or slots dynamically updates Draft Assistance, Weekly Lineup, and Trade Analyzer.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <button
                onClick={() =>
                  onUpdateRosterSettings({
                    ...DEFAULT_ROSTER_SETTINGS,
                    scoringFormat: rosterSettings.scoringFormat,
                    currentWeek: rosterSettings.currentWeek,
                  })
                }
                className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs text-slate-200 font-medium transition"
              >
                Standard (1 FLEX)
              </button>
              <button
                onClick={() =>
                  onUpdateRosterSettings({
                    ...DEFAULT_ROSTER_SETTINGS,
                    scoringFormat: rosterSettings.scoringFormat,
                    currentWeek: rosterSettings.currentWeek,
                    flex: 2,
                  })
                }
                className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs text-slate-200 font-medium transition"
              >
                Double FLEX (2 FLEX)
              </button>
              <button
                onClick={() =>
                  onUpdateRosterSettings({
                    ...DEFAULT_ROSTER_SETTINGS,
                    scoringFormat: rosterSettings.scoringFormat,
                    currentWeek: rosterSettings.currentWeek,
                    wr: 3,
                    flex: 2,
                  })
                }
                className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs text-slate-200 font-medium transition"
              >
                Deep (3 WR + 2 FLEX)
              </button>
              <button
                onClick={() =>
                  onUpdateRosterSettings({
                    ...DEFAULT_ROSTER_SETTINGS,
                    scoringFormat: rosterSettings.scoringFormat,
                    currentWeek: rosterSettings.currentWeek,
                    superflex: 1,
                  })
                }
                className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs text-slate-200 font-medium transition"
              >
                Superflex (2 QB Eligible)
              </button>
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-4 p-3.5 rounded-xl bg-[#070b14] border border-slate-800">
            <div>
              <div className="text-xs font-bold uppercase tracking-wider text-emerald-400">
                Reception Scoring Format
              </div>
              <div className="text-xs text-slate-400 mt-0.5">
                Automatically scales RB, WR, and TE weekly and season projections across the entire app.
              </div>
            </div>

            <div className="inline-flex rounded-xl bg-[#0b101e] border border-slate-800 p-1 gap-1">
              {(['STANDARD', 'HALF_PPR', 'PPR'] as ScoringFormat[]).map((fmt) => {
                const isSelected = rosterSettings.scoringFormat === fmt;
                const buttonLabel =
                  fmt === 'STANDARD'
                    ? 'Standard (Non-PPR)'
                    : fmt === 'HALF_PPR'
                    ? 'Half-PPR (0.5)'
                    : 'Full PPR (1.0)';
                return (
                  <button
                    key={fmt}
                    onClick={() => handleScoringFormatChange(fmt)}
                    className={`px-3.5 py-2 rounded-lg text-xs font-bold transition ${
                      isSelected
                        ? 'bg-emerald-500 text-slate-950 shadow'
                        : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
                    }`}
                  >
                    {buttonLabel}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3">
            {settingControls.map((ctrl) => (
              <div
                key={ctrl.key}
                className="p-3 rounded-xl bg-[#070b14] border border-slate-800 flex flex-col justify-between gap-2"
              >
                <div>
                  <div className="text-xs font-bold text-white">{ctrl.label}</div>
                  <div className="text-[10px] text-slate-500">{ctrl.sub}</div>
                </div>

                <div className="flex items-center justify-between pt-1">
                  <button
                    onClick={() => adjustSetting(ctrl.key, -1, ctrl.min, ctrl.max)}
                    disabled={rosterSettings[ctrl.key] <= ctrl.min}
                    className="w-7 h-7 rounded-lg bg-slate-800 hover:bg-slate-700 disabled:opacity-30 flex items-center justify-center text-slate-200 transition"
                  >
                    <Minus className="w-3.5 h-3.5" />
                  </button>
                  <span className="font-mono font-bold text-base text-emerald-400">
                    {rosterSettings[ctrl.key]}
                  </span>
                  <button
                    onClick={() => adjustSetting(ctrl.key, 1, ctrl.min, ctrl.max)}
                    disabled={rosterSettings[ctrl.key] >= ctrl.max}
                    className="w-7 h-7 rounded-lg bg-slate-800 hover:bg-slate-700 disabled:opacity-30 flex items-center justify-center text-slate-200 transition"
                  >
                    <Plus className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Search & Add Players Bar */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 p-5 rounded-2xl bg-[#0b101e] border border-slate-800">
        <div className="md:col-span-2 relative">
          <label className="block text-xs font-semibold uppercase tracking-wider text-emerald-400 mb-1.5">
            1. Search All {allEspnPlayers.length} ESPN Players &amp; Click to Add to Your Team
          </label>
          <div className="relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
            <input
              type="text"
              value={addPlayerSearchQuery}
              onChange={(e) => setAddPlayerSearchQuery(e.target.value)}
              placeholder="Search any NFL player or D/ST (e.g., Patrick Mahomes, Jahmyr Gibbs, CeeDee Lamb)..."
              className="w-full pl-10 pr-9 py-2.5 rounded-xl bg-[#070b14] border border-slate-700 text-sm text-white focus:outline-none focus:border-emerald-500"
            />
            {addPlayerSearchQuery && (
              <button
                onClick={() => setAddPlayerSearchQuery('')}
                className="absolute right-3 top-3 text-slate-500 hover:text-slate-300"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>

          {espnAddToTeamResults.length > 0 && (
            <div className="absolute z-30 mt-1.5 w-full rounded-xl bg-[#0f172a] border border-slate-700 shadow-2xl divide-y divide-slate-800 max-h-80 overflow-y-auto">
              {espnAddToTeamResults.map((p) => {
                const unavailable = isPlayerUnavailableForWeek(p, currentWeek);
                const effPts = getEffectiveWeeklyPts(p, currentWeek);
                return (
                  <div
                    key={p.id}
                    className="flex items-center justify-between px-4 py-3 hover:bg-slate-800/80 transition"
                  >
                    <div className="flex items-center gap-3">
                      <span
                        className={`px-2 py-0.5 rounded text-[10px] font-bold border ${
                          POS_BADGE_STYLES[p.position]
                        }`}
                      >
                        {p.position}
                      </span>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-bold text-white">{p.name}</span>
                          {renderStatusBadge(p, currentWeek)}
                        </div>
                        <div className="text-xs text-slate-400">
                          {p.team} • Bye Wk {p.byeWeek} •{' '}
                          <strong className={unavailable ? 'text-rose-400' : 'text-slate-200'}>
                            {effPts.toFixed(1)} Proj Pts (Wk {currentWeek})
                          </strong>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      {!unavailable && (
                        <button
                          onClick={() => handleAddPlayerToRoster(p, 'AUTO_STARTER')}
                          className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold transition"
                        >
                          <Plus className="w-3.5 h-3.5" /> Add Starter
                        </button>
                      )}
                      <button
                        onClick={() => handleAddPlayerToRoster(p, 'BENCH')}
                        className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold transition"
                      >
                        <Plus className="w-3.5 h-3.5" /> Add Bench
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <div>
          <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1.5">
            2. Filter Your Added Players
          </label>
          <div className="relative">
            <Search className="w-4 h-4 text-slate-500 absolute left-3.5 top-3" />
            <input
              type="text"
              value={rosterFilterQuery}
              onChange={(e) => setRosterFilterQuery(e.target.value)}
              placeholder="Filter added roster..."
              className="w-full pl-10 pr-8 py-2.5 rounded-xl bg-[#070b14] border border-slate-800 text-sm text-white focus:outline-none focus:border-blue-500"
            />
            {rosterFilterQuery && (
              <button
                onClick={() => setRosterFilterQuery('')}
                className="absolute right-3 top-3 text-slate-500 hover:text-slate-300"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Starting Lineup */}
        <div className="lg:col-span-2 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-bold text-base text-white flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-blue-500" />
              Starting Lineup ({starters.length} / {activeSlots.length} Filled)
            </h3>

            {lineupEvaluation.suboptimalCount > 0 && (
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-md text-xs font-medium bg-amber-950/70 text-amber-400 border border-amber-700/50">
                <AlertCircle className="w-3.5 h-3.5" />
                {lineupEvaluation.suboptimalCount} Bye / Injury / Suboptimal Alert(s)
              </span>
            )}
          </div>

          <div className="p-4 rounded-2xl bg-[#0b101e] border border-slate-800/90 space-y-2.5">
            {activeSlots.map((slot) => {
              const assigned = lineupEvaluation.starters.find((s) => s.slot === slot);
              const q = rosterFilterQuery.toLowerCase().trim();

              if (
                q &&
                assigned &&
                !assigned.player.name.toLowerCase().includes(q) &&
                !assigned.player.team.toLowerCase().includes(q) &&
                !slot.toLowerCase().includes(q)
              ) {
                return null;
              }

              if (!assigned) {
                return (
                  <div
                    key={slot}
                    className="flex items-center justify-between p-3.5 rounded-xl bg-[#070b14]/50 border border-dashed border-slate-800 text-slate-500"
                  >
                    <div className="flex items-center gap-4">
                      <span className="w-14 py-1.5 rounded-lg text-center font-bold text-xs bg-slate-900 border border-slate-800 text-slate-400">
                        {slot}
                      </span>
                      <span className="text-xs italic">
                        Empty {slot} slot — search above and click &quot;Add Starter&quot;
                      </span>
                    </div>
                    <span className="text-xs font-mono text-slate-600">0.0 PTS</span>
                  </div>
                );
              }

              const effPts = getEffectiveWeeklyPts(assigned.player, currentWeek);
              const isUnavailable = isPlayerUnavailableForWeek(assigned.player, currentWeek);

              return (
                <div
                  key={slot}
                  className={`flex items-center justify-between p-3.5 rounded-xl bg-[#070b14] border ${
                    isUnavailable
                      ? 'border-rose-700/70 bg-rose-950/10'
                      : assigned.isSuboptimal
                      ? 'border-amber-700/60'
                      : 'border-slate-800/90'
                  }`}
                >
                  <div className="flex items-center gap-4">
                    <span
                      className={`w-14 py-1.5 rounded-lg text-center font-bold text-xs border ${
                        POS_BADGE_STYLES[assigned.player.position]
                      }`}
                    >
                      {slot}
                    </span>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-white text-sm">
                          {assigned.player.name}
                        </span>
                        {renderStatusBadge(assigned.player, currentWeek)}
                        {assigned.isSuboptimal && (
                          <span
                            title={assigned.warningReason || 'Suboptimal start'}
                            className="text-amber-400 flex items-center gap-1 text-xs"
                          >
                            <AlertCircle className="w-4 h-4" />
                          </span>
                        )}
                      </div>
                      <div className="text-xs text-slate-500 mt-0.5">
                        {assigned.player.position} - {assigned.player.team} • Bye Wk{' '}
                        {assigned.player.byeWeek}
                        {assigned.warningReason && (
                          <span className="text-amber-400 ml-2 font-medium">
                            • {assigned.warningReason}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-3">
                    <div className="text-right">
                      <div
                        className={`font-bold text-base ${
                          isUnavailable ? 'text-rose-400 line-through' : 'text-white'
                        }`}
                      >
                        {effPts.toFixed(1)}
                      </div>
                      <div className="text-[10px] uppercase text-slate-500">Proj Pts</div>
                    </div>
                    <button
                      title="Remove from Starting Lineup"
                      onClick={() => handleRemoveStarter(slot)}
                      className="p-1.5 rounded-lg hover:bg-slate-800 text-slate-500 hover:text-rose-400 transition"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Bench */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-bold text-base text-white flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-slate-500" />
              Bench
            </h3>
            <span className="text-xs text-slate-400">
              {bench.length} / {rosterSettings.bench} Spots
            </span>
          </div>

          <div className="p-4 rounded-2xl bg-[#0b101e] border border-slate-800/90 space-y-2.5">
            {bench.length === 0 ? (
              <div className="p-8 rounded-xl border border-dashed border-slate-800 text-center space-y-2">
                <p className="text-xs font-medium text-slate-400">No bench players added</p>
                <p className="text-[11px] text-slate-500">
                  Players on a Bye week or listed as Out/IR are automatically placed on your bench.
                </p>
              </div>
            ) : (
              bench
                .filter((p) => {
                  const q = rosterFilterQuery.toLowerCase().trim();
                  return (
                    !q ||
                    p.name.toLowerCase().includes(q) ||
                    p.team.toLowerCase().includes(q) ||
                    p.position.toLowerCase().includes(q)
                  );
                })
                .map((player) => {
                  const effPts = getEffectiveWeeklyPts(player, currentWeek);
                  const unavailable = isPlayerUnavailableForWeek(player, currentWeek);
                  return (
                    <div
                      key={player.id}
                      className="flex items-center justify-between p-3.5 rounded-xl bg-[#070b14] border border-slate-800/90"
                    >
                      <div className="flex items-center gap-3">
                        <span className="px-2.5 py-1.5 rounded-lg bg-slate-900 border border-slate-800 text-slate-400 font-semibold text-xs">
                          Bench
                        </span>
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-white text-sm">{player.name}</span>
                            {renderStatusBadge(player, currentWeek)}
                          </div>
                          <div className="text-xs text-slate-500 mt-0.5">
                            {player.position} - {player.team} • Bye Wk {player.byeWeek}
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-3">
                        <div className="text-right">
                          <div
                            className={`font-bold text-base ${
                              unavailable ? 'text-rose-400' : 'text-white'
                            }`}
                          >
                            {effPts.toFixed(1)}
                          </div>
                          <div className="text-[10px] uppercase text-slate-500">Proj Pts</div>
                        </div>
                        <button
                          title="Remove from Bench"
                          onClick={() => handleRemoveFromBench(player.id)}
                          className="p-1 text-slate-500 hover:text-rose-400 transition"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  );
                })
            )}
          </div>
        </div>
      </div>
    </div>
  );
}