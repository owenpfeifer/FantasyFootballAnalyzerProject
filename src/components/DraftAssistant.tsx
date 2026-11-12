// src/components/DraftAssistant.tsx
'use client';

import React, { useState, useMemo } from 'react';
import {
  ShieldCheck,
  Sparkles,
  Search,
  UserPlus,
  UserMinus,
  RotateCcw,
} from 'lucide-react';
import {
  Player,
  Position,
  RosterSettings,
  SCORING_LABELS,
  buildLineupSlots,
  scalePlayerForScoring,
} from '@/lib/models';
import { OptimalDraft } from '@/lib/analysisEngine';

const POS_BADGE_STYLES: Record<Position, string> = {
  QB: 'bg-purple-950/80 text-purple-300 border-purple-700/50',
  RB: 'bg-emerald-950/80 text-emerald-300 border-emerald-700/50',
  WR: 'bg-blue-950/80 text-blue-300 border-blue-700/50',
  TE: 'bg-amber-950/80 text-amber-300 border-amber-700/50',
  K: 'bg-cyan-950/80 text-cyan-300 border-cyan-700/50',
  'D/ST': 'bg-slate-800 text-slate-300 border-slate-600',
};

const formatPickLabel = (round: number, slot: number): string => {
  return `${round}.${String(slot).padStart(2, '0')}`;
};

interface DraftAssistantProps {
  allEspnPlayers: Player[];
  draftPickSlot: number;
  setDraftPickSlot: (slot: number) => void;
  rosterSettings: RosterSettings;
}

export default function DraftAssistant({
  allEspnPlayers,
  draftPickSlot,
  setDraftPickSlot,
  rosterSettings,
}: DraftAssistantProps) {
  const [draftedIds, setDraftedIds] = useState<Set<string>>(new Set());
  const [draftSearchQuery, setDraftSearchQuery] = useState('');
  const [posFilter, setPosFilter] = useState<'ALL' | Position>('ALL');
  const [userDraftPicks, setUserDraftPicks] = useState<Player[]>([]);

  const totalRosterPicks = useMemo(
    () => buildLineupSlots(rosterSettings).length + rosterSettings.bench,
    [rosterSettings]
  );

  const scaledUserDraftPicks = useMemo(
    () => userDraftPicks.map((p) => scalePlayerForScoring(p, rosterSettings.scoringFormat)),
    [userDraftPicks, rosterSettings.scoringFormat]
  );

  const currentRound = scaledUserDraftPicks.length + 1;
  const currentPickFormatted = formatPickLabel(currentRound, draftPickSlot);

  const draftPoolWithStatus = useMemo(() => {
    const userPickedNames = new Set(scaledUserDraftPicks.map((p) => p.name.toLowerCase()));
    return allEspnPlayers.map((p) => ({
      ...p,
      drafted: draftedIds.has(p.id) || userPickedNames.has(p.name.toLowerCase()),
    }));
  }, [allEspnPlayers, draftedIds, scaledUserDraftPicks]);

  const draftAnalysis = useMemo(() => {
    return OptimalDraft(draftPoolWithStatus, scaledUserDraftPicks, rosterSettings);
  }, [draftPoolWithStatus, scaledUserDraftPicks, rosterSettings]);

  const filteredDraftPool = useMemo(() => {
    return draftAnalysis.rankedPool
      .filter((p) => {
        const matchesPos = posFilter === 'ALL' || p.position === posFilter;
        const q = draftSearchQuery.toLowerCase().trim();
        const matchesSearch =
          !q ||
          p.name.toLowerCase().includes(q) ||
          p.team.toLowerCase().includes(q) ||
          p.position.toLowerCase().includes(q);
        return matchesPos && matchesSearch;
      })
      .slice(0, 60);
  }, [draftAnalysis.rankedPool, posFilter, draftSearchQuery]);

  const handleDraftPlayer = (player: Player, byUser: boolean) => {
    setDraftedIds((prev) => new Set(prev).add(player.id));
    if (byUser) {
      setUserDraftPicks((prev) => [...prev, player]);
    }
  };

  const handleResetDraft = () => {
    setDraftedIds(new Set());
    setUserDraftPicks([]);
  };

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-800/80 pb-5">
        <div>
          <div className="flex items-center gap-3">
            <h2 className="text-2xl font-bold text-white">Live Draft Assistant</h2>
            <span className="px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-wider bg-rose-950/80 text-rose-400 border border-rose-800/60 rounded-md">
              ON THE CLOCK
            </span>
          </div>
          <p className="text-sm text-slate-400 mt-1">
            <strong className="text-emerald-400">{SCORING_LABELS[rosterSettings.scoringFormat]}</strong> •{' '}
            {rosterSettings.numTeams}-Team League • Round {currentRound}, Pick {draftPickSlot} ({currentPickFormatted}) • Need:{' '}
            {draftAnalysis.missingNeeds.join(', ') || 'Best Player Available'}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2.5 px-3.5 py-2 rounded-xl bg-[#0b101e] border border-slate-700/80">
            <label
              htmlFor="draft-pick-select"
              className="text-xs font-semibold uppercase tracking-wider text-slate-400"
            >
              Your Pick # (1–{rosterSettings.numTeams}):
            </label>
            <select
              id="draft-pick-select"
              value={draftPickSlot}
              onChange={(e) => setDraftPickSlot(Number(e.target.value))}
              className="bg-slate-900 border border-slate-700 text-white font-bold text-sm rounded-lg px-2.5 py-1 focus:outline-none focus:border-blue-500 cursor-pointer"
            >
              {Array.from({ length: rosterSettings.numTeams }, (_, i) => i + 1).map((num) => (
                <option key={num} value={num}>
                  Pick #{num} ({formatPickLabel(currentRound, num)})
                </option>
              ))}
            </select>
          </div>

          {(scaledUserDraftPicks.length > 0 || draftedIds.size > 0) && (
            <button
              onClick={handleResetDraft}
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-slate-900 hover:bg-rose-950/80 text-slate-300 hover:text-rose-300 border border-slate-800 text-xs font-semibold transition"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              Reset Draft
            </button>
          )}

          <div className="flex items-center gap-2 px-4 py-2 rounded-xl bg-slate-900/90 border border-slate-700/70 text-sm text-slate-200">
            <ShieldCheck className="w-4 h-4 text-blue-400" />
            <span>Analysis Complete</span>
          </div>
        </div>
      </div>

      {/* Optimal Picks Card */}
      <div className="p-6 rounded-2xl bg-gradient-to-r from-indigo-950/40 via-[#0d1428] to-[#0b101e] border border-indigo-500/30 space-y-4">
        <div className="flex items-center gap-2 text-indigo-300 font-semibold text-base">
          <Sparkles className="w-5 h-5 text-indigo-400" />
          Optimal Picks for Pick {currentPickFormatted}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {draftAnalysis.recommendations.map((rec, idx) => (
            <div
              key={rec.player.id}
              className="flex items-center justify-between p-4 rounded-xl bg-[#0b101e]/90 border border-slate-800"
            >
              <div className="flex items-center gap-4">
                <span
                  className={`w-11 h-11 rounded-xl flex items-center justify-center font-bold text-xs border ${
                    POS_BADGE_STYLES[rec.player.position]
                  }`}
                >
                  {rec.player.position}
                </span>
                <div>
                  <h3 className="font-bold text-white text-base">{rec.player.name}</h3>
                  <p className="text-xs text-blue-400 mt-0.5">{rec.headline}</p>
                </div>
              </div>
              <button
                onClick={() => handleDraftPlayer(rec.player, true)}
                className={`px-4 py-2 rounded-lg text-xs font-semibold transition ${
                  idx === 0
                    ? 'bg-indigo-600 hover:bg-indigo-500 text-white'
                    : 'bg-slate-800 hover:bg-slate-700 text-slate-200'
                }`}
              >
                Draft
              </button>
            </div>
          ))}
        </div>
      </div>

      {/* Available Player Pool + Your Draft Class */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h3 className="font-bold text-lg text-white">
              Available ESPN Player Pool ({draftAnalysis.rankedPool.length})
            </h3>

            <div className="flex items-center gap-3">
              <div className="relative">
                <Search className="w-4 h-4 text-slate-500 absolute left-3 top-2.5" />
                <input
                  type="text"
                  value={draftSearchQuery}
                  onChange={(e) => setDraftSearchQuery(e.target.value)}
                  placeholder="Search ESPN players..."
                  className="pl-9 pr-3 py-1.5 rounded-lg bg-[#0b101e] border border-slate-800 text-xs text-slate-200 focus:outline-none focus:border-blue-500"
                />
              </div>

              <div className="flex rounded-lg bg-[#0b101e] border border-slate-800 p-0.5 text-xs">
                {(['ALL', 'QB', 'RB', 'WR', 'TE'] as const).map((tab) => (
                  <button
                    key={tab}
                    onClick={() => setPosFilter(tab)}
                    className={`px-2.5 py-1 rounded-md font-medium transition ${
                      posFilter === tab
                        ? 'bg-slate-800 text-white'
                        : 'text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    {tab}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="rounded-2xl bg-[#0b101e] border border-slate-800/90 overflow-hidden">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-800 text-[11px] uppercase text-slate-400">
                  <th className="py-3.5 px-4">Player</th>
                  <th className="py-3.5 px-3 text-center">Bye</th>
                  <th className="py-3.5 px-3 text-center">ADP</th>
                  <th className="py-3.5 px-3 text-right">Proj Pts</th>
                  <th className="py-3.5 px-4 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 text-sm">
                {filteredDraftPool.map((p) => (
                  <tr key={p.id} className="hover:bg-slate-900/40 transition">
                    <td className="py-3.5 px-4 flex items-center gap-3">
                      <span
                        className={`w-8 h-8 rounded-lg flex items-center justify-center font-bold text-xs border ${
                          POS_BADGE_STYLES[p.position]
                        }`}
                      >
                        {p.position}
                      </span>
                      <div>
                        <div className="font-semibold text-white">{p.name}</div>
                        <div className="text-xs text-slate-500">
                          {p.team} • Tier {p.tier}
                        </div>
                      </div>
                    </td>
                    <td className="py-3.5 px-3 text-center text-slate-400">{p.byeWeek}</td>
                    <td className="py-3.5 px-3 text-center text-slate-400">{p.adp}</td>
                    <td className="py-3.5 px-3 text-right font-bold text-white">
                      {p.seasonProjPts.toFixed(1)}
                    </td>
                    <td className="py-3.5 px-4 text-right">
                      <div className="inline-flex items-center gap-1.5">
                        <button
                          title="Draft to Your Team"
                          onClick={() => handleDraftPlayer(p, true)}
                          className="p-1.5 rounded-lg bg-slate-800/80 hover:bg-blue-600 text-slate-300 hover:text-white transition"
                        >
                          <UserPlus className="w-4 h-4" />
                        </button>
                        <button
                          title="Mark Taken by Another Team"
                          onClick={() => handleDraftPlayer(p, false)}
                          className="p-1.5 rounded-lg bg-slate-800/80 hover:bg-rose-600 text-slate-300 hover:text-white transition"
                        >
                          <UserMinus className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Your Draft Class */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-bold text-lg text-white flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-blue-500" />
              Your Draft Class
            </h3>
            <span className="text-xs text-slate-400">
              {scaledUserDraftPicks.length} / {totalRosterPicks} Picks
            </span>
          </div>

          <div className="p-4 rounded-2xl bg-[#0b101e] border border-slate-800/90 space-y-3">
            {scaledUserDraftPicks.map((player, index) => {
              const pickBadge = formatPickLabel(index + 1, draftPickSlot);
              return (
                <div
                  key={`${player.id}-${index}`}
                  className="flex items-center gap-3 p-3 rounded-xl bg-[#070b14] border border-slate-800"
                >
                  <div className="px-2.5 py-1.5 rounded-lg bg-slate-900 border border-slate-800 text-center">
                    <div className="text-[10px] uppercase text-slate-500">Pick</div>
                    <div className="text-xs font-bold text-slate-200">{pickBadge}</div>
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-blue-950 text-blue-400">
                        {player.position}
                      </span>
                      <span className="font-semibold text-sm text-white">{player.name}</span>
                    </div>
                    <div className="text-xs text-slate-500 mt-0.5">
                      {player.team} • {player.seasonProjPts.toFixed(1)} Pts
                    </div>
                  </div>
                </div>
              );
            })}

            <div className="flex items-center gap-3 p-3 rounded-xl border border-dashed border-slate-800 text-slate-500">
              <div className="px-2.5 py-1.5 rounded-lg bg-slate-900/50 text-center">
                <div className="text-[10px] uppercase">Pick</div>
                <div className="text-xs font-bold">{currentPickFormatted}</div>
              </div>
              <span className="text-xs italic">On the clock...</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}