// src/components/TradeAnalyzer.tsx
'use client';

import React, { useState, useMemo } from 'react';
import {
  ArrowLeftRight,
  ShieldCheck,
  Search,
  Zap,
  CheckCircle2,
  XCircle,
  Plus,
  X,
  Users,
  TrendingUp,
} from 'lucide-react';
import {
  Player,
  Position,
  RosterSettings,
  SCORING_LABELS,
  buildLineupSlots,
  scalePlayerForScoring,
  Trade_Grade,
} from '@/lib/models';
import { TradeGrader } from '@/lib/analysisEngine';

const POS_BADGE_STYLES: Record<Position, string> = {
  QB: 'bg-purple-950/80 text-purple-300 border-purple-700/50',
  RB: 'bg-emerald-950/80 text-emerald-300 border-emerald-700/50',
  WR: 'bg-blue-950/80 text-blue-300 border-blue-700/50',
  TE: 'bg-amber-950/80 text-amber-300 border-amber-700/50',
  K: 'bg-cyan-950/80 text-cyan-300 border-cyan-700/50',
  'D/ST': 'bg-slate-800 text-slate-300 border-slate-600',
};

interface TradeAnalyzerProps {
  allEspnPlayers: Player[];
  currentUserTeamPlayers: Player[];
  rosterSettings: RosterSettings;
  onApplyTradeToRoster: (sendPlayers: Player[], receivePlayers: Player[]) => void;
  onGoToLineup: () => void;
}

export default function TradeAnalyzer({
  allEspnPlayers,
  currentUserTeamPlayers,
  rosterSettings,
  onApplyTradeToRoster,
  onGoToLineup,
}: TradeAnalyzerProps) {
  const [sendPlayers, setSendPlayers] = useState<Player[]>([]);
  const [receivePlayers, setReceivePlayers] = useState<Player[]>([]);
  const [sendSearchQuery, setSendSearchQuery] = useState('');
  const [receiveSearchQuery, setReceiveSearchQuery] = useState('');
  const [onlyMyTeamInSendSearch, setOnlyMyTeamInSendSearch] = useState(false);
  const [tradeResult, setTradeResult] = useState<Trade_Grade | null>(null);
  const [tradeStatus, setTradeStatus] = useState<'IDLE' | 'ACCEPTED' | 'DECLINED'>('IDLE');

  const starterSlotCount = useMemo(
    () => buildLineupSlots(rosterSettings).length,
    [rosterSettings]
  );

  // Ensure selected trade players always reflect the active ScoringFormat
  const scaledSendPlayers = useMemo(
    () => sendPlayers.map((p) => scalePlayerForScoring(p, rosterSettings.scoringFormat)),
    [sendPlayers, rosterSettings.scoringFormat]
  );

  const scaledReceivePlayers = useMemo(
    () => receivePlayers.map((p) => scalePlayerForScoring(p, rosterSettings.scoringFormat)),
    [receivePlayers, rosterSettings.scoringFormat]
  );

  const userRosterIds = useMemo(
    () => new Set(currentUserTeamPlayers.map((p) => p.id)),
    [currentUserTeamPlayers]
  );

  const alreadyInTradeIds = useMemo(
    () => new Set([...scaledSendPlayers, ...scaledReceivePlayers].map((p) => p.id)),
    [scaledSendPlayers, scaledReceivePlayers]
  );

  const availableTeamRosterChips = useMemo(() => {
    return currentUserTeamPlayers.filter((p) => !alreadyInTradeIds.has(p.id));
  }, [currentUserTeamPlayers, alreadyInTradeIds]);

  const sendSearchResults = useMemo(() => {
    const q = sendSearchQuery.toLowerCase().trim();
    if (!q) return [];

    const sourcePool = onlyMyTeamInSendSearch
      ? currentUserTeamPlayers
      : [
          ...currentUserTeamPlayers,
          ...allEspnPlayers.filter((p) => !userRosterIds.has(p.id)),
        ];

    return sourcePool
      .filter(
        (p) =>
          !alreadyInTradeIds.has(p.id) &&
          (p.name.toLowerCase().includes(q) ||
            p.team.toLowerCase().includes(q) ||
            p.position.toLowerCase().includes(q))
      )
      .slice(0, 8);
  }, [
    sendSearchQuery,
    onlyMyTeamInSendSearch,
    currentUserTeamPlayers,
    allEspnPlayers,
    userRosterIds,
    alreadyInTradeIds,
  ]);

  const receiveSearchResults = useMemo(() => {
    const q = receiveSearchQuery.toLowerCase().trim();
    if (!q) return [];

    return allEspnPlayers
      .filter(
        (p) =>
          !alreadyInTradeIds.has(p.id) &&
          (p.name.toLowerCase().includes(q) ||
            p.team.toLowerCase().includes(q) ||
            p.position.toLowerCase().includes(q))
      )
      .slice(0, 8);
  }, [receiveSearchQuery, allEspnPlayers, alreadyInTradeIds]);

  const handleAddSendPlayer = (player: Player) => {
    setSendPlayers((prev) => [...prev, player]);
    setSendSearchQuery('');
    setTradeResult(null);
  };

  const handleRemoveSendPlayer = (id: string) => {
    setSendPlayers((prev) => prev.filter((p) => p.id !== id));
    setTradeResult(null);
  };

  const handleAddReceivePlayer = (player: Player) => {
    setReceivePlayers((prev) => [...prev, player]);
    setReceiveSearchQuery('');
    setTradeResult(null);
  };

  const handleRemoveReceivePlayer = (id: string) => {
    setReceivePlayers((prev) => prev.filter((p) => p.id !== id));
    setTradeResult(null);
  };

  const handleAnalyzeTrade = () => {
    if (scaledSendPlayers.length === 0 || scaledReceivePlayers.length === 0) return;
    const grade = TradeGrader(
      { sendPlayers: scaledSendPlayers, receivePlayers: scaledReceivePlayers },
      {
        teamId: 'user-1',
        teamName: 'My Team',
        roster: currentUserTeamPlayers,
        draftPicks: [],
      },
      rosterSettings
    );
    setTradeResult(grade);
    setTradeStatus('IDLE');
  };

  const handleAcceptAndApplyTrade = () => {
    onApplyTradeToRoster(scaledSendPlayers, scaledReceivePlayers);
    setTradeStatus('ACCEPTED');
  };

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-800/80 pb-5">
        <div>
          <h2 className="text-2xl font-bold text-white">Trade Analyzer</h2>
          <p className="text-sm text-slate-400 mt-1">
            Evaluates raw point differentials and exact impact on your custom {starterSlotCount}-starter lineup ({rosterSettings.flex} FLEX).
          </p>
        </div>

        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 px-3.5 py-2 rounded-full bg-[#0b101e] border border-slate-800 text-xs">
            <Users className="w-3.5 h-3.5 text-blue-400" />
            {currentUserTeamPlayers.length > 0 ? (
              <span className="text-slate-200">
                Team Linked: <strong className="text-emerald-400">{currentUserTeamPlayers.length} Players</strong>
              </span>
            ) : (
              <button
                onClick={onGoToLineup}
                className="text-amber-400 hover:underline font-medium"
              >
                No Team Entered — Click to Build Team in Weekly Lineup
              </button>
            )}
          </div>

          <div className="flex items-center gap-2 px-4 py-2 rounded-full bg-slate-900 border border-slate-800 text-xs text-slate-300">
            <ShieldCheck className="w-4 h-4 text-emerald-400" />
            {SCORING_LABELS[rosterSettings.scoringFormat]}
          </div>
        </div>
      </div>

      {/* Trade Comparison Cards */}
      <div className="relative grid grid-cols-1 md:grid-cols-2 gap-8 items-stretch">
        {/* Left Card: Your Team Sends */}
        <div className="p-6 rounded-2xl bg-[#0b101e] border border-slate-800/90 space-y-5">
          <div className="flex items-center justify-between border-b border-slate-800/80 pb-4">
            <div className="flex items-center gap-2.5 font-bold text-white text-base">
              <span className="w-2.5 h-2.5 rounded-full bg-rose-500" />
              Your Team Sends
            </div>
            <div className="text-right">
              <div className="text-2xl font-extrabold text-white">
                {scaledSendPlayers.reduce((s, p) => s + p.weeklyProjPts, 0).toFixed(1)}
              </div>
              <div className="text-[11px] text-slate-400">Total Proj</div>
            </div>
          </div>

          {currentUserTeamPlayers.length > 0 && (
            <div className="space-y-2 p-3 rounded-xl bg-[#070b14] border border-slate-800/90">
              <div className="flex items-center justify-between text-[11px] text-slate-400">
                <span className="font-semibold uppercase tracking-wider text-blue-400">
                  Your Carried-Over Team (Click to Send)
                </span>
                <span>{availableTeamRosterChips.length} available</span>
              </div>

              {availableTeamRosterChips.length === 0 ? (
                <p className="text-xs text-slate-500 italic">
                  All players from your roster are currently added to the trade.
                </p>
              ) : (
                <div className="flex flex-wrap gap-1.5 max-h-28 overflow-y-auto pt-1">
                  {availableTeamRosterChips.map((p) => (
                    <button
                      key={p.id}
                      onClick={() => handleAddSendPlayer(p)}
                      className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-[#0f1629] hover:bg-rose-950/60 border border-slate-700/80 hover:border-rose-700/60 text-xs text-slate-200 transition"
                    >
                      <span className="text-[10px] font-bold text-blue-400">{p.position}</span>
                      <span className="font-medium">{p.name}</span>
                      <span className="text-[10px] text-slate-400">({p.weeklyProjPts.toFixed(1)})</span>
                      <Plus className="w-3 h-3 text-rose-400" />
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          <div className="relative space-y-2">
            <div className="flex items-center justify-between text-xs text-slate-400">
              <span>Or search player to send:</span>
              <label className="flex items-center gap-1.5 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={onlyMyTeamInSendSearch}
                  onChange={(e) => setOnlyMyTeamInSendSearch(e.target.checked)}
                  className="rounded border-slate-700 bg-slate-900 text-blue-500"
                />
                <span>Only search my team ({currentUserTeamPlayers.length})</span>
              </label>
            </div>

            <div className="relative">
              <Search className="w-4 h-4 text-slate-500 absolute left-3 top-2.5" />
              <input
                type="text"
                value={sendSearchQuery}
                onChange={(e) => setSendSearchQuery(e.target.value)}
                placeholder="Search ESPN player to send..."
                className="w-full pl-9 pr-8 py-2 rounded-xl bg-[#070b14] border border-slate-800 text-xs text-white focus:outline-none focus:border-rose-500"
              />
              {sendSearchQuery && (
                <button
                  onClick={() => setSendSearchQuery('')}
                  className="absolute right-2.5 top-2.5 text-slate-500 hover:text-slate-300"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            {sendSearchResults.length > 0 && (
              <div className="absolute z-20 mt-1 w-full rounded-xl bg-[#0f172a] border border-slate-700 shadow-2xl divide-y divide-slate-800 max-h-60 overflow-y-auto">
                {sendSearchResults.map((p) => {
                  const isOnMyRoster = userRosterIds.has(p.id);
                  return (
                    <button
                      key={p.id}
                      onClick={() => handleAddSendPlayer(p)}
                      className="w-full flex items-center justify-between px-3.5 py-2.5 hover:bg-slate-800/80 text-left transition"
                    >
                      <div className="flex items-center gap-2.5">
                        <span
                          className={`px-2 py-0.5 rounded text-[10px] font-bold border ${
                            POS_BADGE_STYLES[p.position]
                          }`}
                        >
                          {p.position}
                        </span>
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-bold text-white">{p.name}</span>
                            {isOnMyRoster && (
                              <span className="px-1.5 py-0.2 rounded bg-blue-950 text-blue-300 border border-blue-700/50 text-[9px] font-semibold">
                                ON YOUR TEAM
                              </span>
                            )}
                          </div>
                          <div className="text-[11px] text-slate-400">
                            {p.team} • {p.weeklyProjPts.toFixed(1)} Proj Pts
                          </div>
                        </div>
                      </div>
                      <span className="inline-flex items-center gap-1 text-xs font-semibold text-rose-400">
                        <Plus className="w-3.5 h-3.5" /> Add
                      </span>
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          <div className="space-y-3">
            {scaledSendPlayers.length === 0 ? (
              <div className="p-8 rounded-xl border border-dashed border-slate-800 text-center space-y-1.5">
                <p className="text-xs font-medium text-slate-400">No outgoing players selected</p>
                <p className="text-[11px] text-slate-500">
                  Click one of your team&apos;s players above or search to add them to &quot;Your Team Sends&quot;.
                </p>
              </div>
            ) : (
              scaledSendPlayers.map((p) => (
                <div
                  key={p.id}
                  className="flex items-center justify-between p-4 rounded-xl bg-[#0f1629] border border-slate-800"
                >
                  <div className="flex items-center gap-3.5">
                    <span className="w-11 h-11 rounded-xl bg-rose-950/60 border border-rose-800/50 text-rose-300 font-bold text-xs flex items-center justify-center">
                      {p.position}
                    </span>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-white text-base">{p.name}</span>
                        {userRosterIds.has(p.id) && (
                          <span className="px-1.5 py-0.5 rounded bg-blue-950/90 text-blue-300 border border-blue-800 text-[9px] font-semibold">
                            YOUR ROSTER
                          </span>
                        )}
                      </div>
                      <div className="text-xs text-slate-400 mt-0.5">
                        {p.team} • Avg: {p.avgPts} pts
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="text-right">
                      <div className="font-bold text-white text-lg">
                        {p.weeklyProjPts.toFixed(1)}
                      </div>
                      <div className="text-[10px] uppercase text-slate-500">Proj Pts</div>
                    </div>
                    <button
                      title="Remove Player"
                      onClick={() => handleRemoveSendPlayer(p.id)}
                      className="p-1.5 rounded-lg hover:bg-slate-800 text-slate-500 hover:text-rose-400 transition"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Center Swap Badge */}
        <div className="hidden md:flex absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-11 h-11 rounded-full bg-[#111827] border border-slate-700 items-center justify-center text-slate-400 shadow-xl">
          <ArrowLeftRight className="w-4 h-4" />
        </div>

        {/* Right Card: Your Team Receives */}
        <div className="p-6 rounded-2xl bg-[#0b101e] border border-slate-800/90 space-y-5">
          <div className="flex items-center justify-between border-b border-slate-800/80 pb-4">
            <div className="flex items-center gap-2.5 font-bold text-white text-base">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-400" />
              Your Team Receives
            </div>
            <div className="text-right">
              <div className="text-2xl font-extrabold text-white">
                {scaledReceivePlayers.reduce((s, p) => s + p.weeklyProjPts, 0).toFixed(1)}
              </div>
              <div className="text-[11px] text-slate-400">Total Proj</div>
            </div>
          </div>

          <div className="relative space-y-2">
            <div className="text-xs text-slate-400">
              Search any ESPN player to receive:
            </div>

            <div className="relative">
              <Search className="w-4 h-4 text-slate-500 absolute left-3 top-2.5" />
              <input
                type="text"
                value={receiveSearchQuery}
                onChange={(e) => setReceiveSearchQuery(e.target.value)}
                placeholder="Search ESPN player to receive..."
                className="w-full pl-9 pr-8 py-2 rounded-xl bg-[#070b14] border border-slate-800 text-xs text-white focus:outline-none focus:border-emerald-500"
              />
              {receiveSearchQuery && (
                <button
                  onClick={() => setReceiveSearchQuery('')}
                  className="absolute right-2.5 top-2.5 text-slate-500 hover:text-slate-300"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            {receiveSearchResults.length > 0 && (
              <div className="absolute z-20 mt-1 w-full rounded-xl bg-[#0f172a] border border-slate-700 shadow-2xl divide-y divide-slate-800 max-h-60 overflow-y-auto">
                {receiveSearchResults.map((p) => (
                  <button
                    key={p.id}
                    onClick={() => handleAddReceivePlayer(p)}
                    className="w-full flex items-center justify-between px-3.5 py-2.5 hover:bg-slate-800/80 text-left transition"
                  >
                    <div className="flex items-center gap-2.5">
                      <span
                        className={`px-2 py-0.5 rounded text-[10px] font-bold border ${
                          POS_BADGE_STYLES[p.position]
                        }`}
                      >
                        {p.position}
                      </span>
                      <div>
                        <div className="text-xs font-bold text-white">{p.name}</div>
                        <div className="text-[11px] text-slate-400">
                          {p.team} • {p.weeklyProjPts.toFixed(1)} Proj Pts
                        </div>
                      </div>
                    </div>
                    <span className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-400">
                      <Plus className="w-3.5 h-3.5" /> Add
                    </span>
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="space-y-3">
            {scaledReceivePlayers.length === 0 ? (
              <div className="p-8 rounded-xl border border-dashed border-slate-800 text-center space-y-1.5">
                <p className="text-xs font-medium text-slate-400">No incoming players selected</p>
                <p className="text-[11px] text-slate-500">
                  Use the search box above and click a player to add them to &quot;Your Team Receives&quot;.
                </p>
              </div>
            ) : (
              scaledReceivePlayers.map((p) => (
                <div
                  key={p.id}
                  className="flex items-center justify-between p-4 rounded-xl bg-[#0f1629] border border-slate-800"
                >
                  <div className="flex items-center gap-3.5">
                    <span className="w-11 h-11 rounded-xl bg-emerald-950/60 border border-emerald-800/50 text-emerald-300 font-bold text-xs flex items-center justify-center">
                      {p.position}
                    </span>
                    <div>
                      <div className="font-bold text-white text-base">{p.name}</div>
                      <div className="text-xs text-slate-400 mt-0.5">
                        {p.team} • Avg: {p.avgPts} pts
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="text-right">
                      <div className="font-bold text-white text-lg">
                        {p.weeklyProjPts.toFixed(1)}
                      </div>
                      <div className="text-[10px] uppercase text-slate-500">Proj Pts</div>
                    </div>
                    <button
                      title="Remove Player"
                      onClick={() => handleRemoveReceivePlayer(p.id)}
                      className="p-1.5 rounded-lg hover:bg-slate-800 text-slate-500 hover:text-rose-400 transition"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* Analyze Trade Button */}
      <div className="flex justify-center">
        <button
          onClick={handleAnalyzeTrade}
          disabled={scaledSendPlayers.length === 0 || scaledReceivePlayers.length === 0}
          className="flex items-center gap-2.5 px-8 py-3.5 rounded-xl bg-blue-600 hover:bg-blue-500 disabled:opacity-40 text-white font-bold text-sm transition shadow-lg shadow-blue-600/20"
        >
          <Zap className="w-4 h-4 fill-current" />
          Analyze Trade for My Team
        </button>
      </div>

      {/* Trade_Grade + Team Impact Output */}
      {tradeResult && (
        <div className="p-6 rounded-2xl bg-[#0b101e] border border-blue-500/40 space-y-5">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <div className="w-16 h-16 rounded-2xl bg-emerald-500/10 border border-emerald-500/40 flex flex-col items-center justify-center">
                <span className="text-[10px] uppercase text-emerald-300">Grade</span>
                <span className="text-2xl font-black text-emerald-400">
                  {tradeResult.letterGrade}
                </span>
              </div>
              <div>
                <div className="flex flex-wrap items-center gap-3">
                  <h3 className="font-bold text-lg text-white">
                    Raw Package Delta:{' '}
                    <span
                      className={
                        tradeResult.netPointDifferential >= 0
                          ? 'text-emerald-400'
                          : 'text-rose-400'
                      }
                    >
                      {tradeResult.netPointDifferential >= 0 ? '+' : ''}
                      {tradeResult.netPointDifferential} Pts/Wk
                    </span>
                  </h3>

                  {tradeResult.hasTeamContext && (
                    <span className="px-2.5 py-1 rounded-lg bg-blue-950/80 border border-blue-700/50 text-xs font-bold text-blue-300">
                      Starter Lineup Impact:{' '}
                      <strong
                        className={
                          tradeResult.startingLineupDelta >= 0
                            ? 'text-emerald-400'
                            : 'text-rose-400'
                        }
                      >
                        {tradeResult.startingLineupDelta >= 0 ? '+' : ''}
                        {tradeResult.startingLineupDelta} Pts/Wk
                      </strong>
                    </span>
                  )}
                </div>
                <p className="text-sm text-slate-300 mt-1.5 max-w-2xl">
                  {tradeResult.summary}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <button
                onClick={handleAcceptAndApplyTrade}
                className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold transition"
              >
                <CheckCircle2 className="w-4 h-4" />
                Accept &amp; Update My Team
              </button>
              <button
                onClick={() => setTradeStatus('DECLINED')}
                className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-rose-950 hover:bg-rose-900 text-rose-300 border border-rose-800 text-xs font-bold transition"
              >
                <XCircle className="w-4 h-4" />
                Decline Trade
              </button>
            </div>
          </div>

          {tradeResult.hasTeamContext && (
            <div className="p-4 rounded-xl bg-[#070b14] border border-slate-800 space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-800 pb-2.5">
                <span className="text-xs font-bold uppercase tracking-wider text-blue-400 flex items-center gap-1.5">
                  <TrendingUp className="w-4 h-4" />
                  How This Trade Impacts Your Custom {starterSlotCount}-Starter Lineup
                </span>
                <span className="text-xs text-slate-300">
                  Optimal Starters Before:{' '}
                  <strong className="text-white">{tradeResult.preTradeLineupPts.toFixed(1)} pts</strong>
                  {' → '}After:{' '}
                  <strong className="text-emerald-400">{tradeResult.postTradeLineupPts.toFixed(1)} pts</strong>
                </span>
              </div>

              <ul className="space-y-1.5 text-xs text-slate-300 list-disc list-inside">
                {tradeResult.teamFitInsights.map((insight, idx) => (
                  <li key={idx}>{insight}</li>
                ))}
              </ul>
            </div>
          )}

          {tradeStatus !== 'IDLE' && (
            <div className="text-xs font-medium text-slate-400 pt-2 border-t border-slate-800">
              {tradeStatus === 'ACCEPTED' ? (
                <span className="text-emerald-400">
                  ✓ Trade accepted! Sent players were removed from your team and received players were added and optimized in your Weekly Lineup.
                </span>
              ) : (
                <span>
                  Status: Trade marked as <strong className="text-white">DECLINED</strong>.
                </span>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}