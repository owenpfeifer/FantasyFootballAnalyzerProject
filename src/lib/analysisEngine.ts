// src/lib/analysisEngine.ts
import {
  Player,
  Position,
  LineupSlot,
  RosterSettings,
  DEFAULT_ROSTER_SETTINGS,
  SCORING_MULTIPLIERS,
  SCORING_LABELS,
  buildLineupSlots,
  isPositionEligibleForSlot,
  isPlayerUnavailableForWeek,
  getPlayerUnavailabilityLabel,
  getEffectiveWeeklyPts,
  User_Players,
  Current_Team,
  Player_Trade,
  Trade_Grade,
  DraftRecommendation,
  LineupEvaluationResult,
  LineupAssignment,
} from './models';

const BASE_PPR_REPLACEMENT: Record<Position, number> = {
  QB: 310.0,
  RB: 195.0,
  WR: 190.0,
  TE: 145.0,
  K: 130.0,
  'D/ST': 125.0,
};

/**
 * 1. OptimalDraft()
 */
export function OptimalDraft(
  availablePool: Player[],
  draftedByUser: Player[],
  settings: RosterSettings = DEFAULT_ROSTER_SETTINGS
): {
  recommendations: DraftRecommendation[];
  rankedPool: Player[];
  missingNeeds: Position[];
} {
  const undrafted = availablePool.filter((p) => !p.drafted);
  const formatMults = SCORING_MULTIPLIERS[settings.scoringFormat] ?? SCORING_MULTIPLIERS.PPR;

  const counts: Record<Position, number> = { QB: 0, RB: 0, WR: 0, TE: 0, K: 0, 'D/ST': 0 };
  draftedByUser.forEach((p) => {
    counts[p.position] = (counts[p.position] || 0) + 1;
  });

  const targetCounts: Record<Position, number> = {
    QB: settings.qb + settings.superflex,
    RB: settings.rb + Math.ceil(settings.flex * 0.5),
    WR: settings.wr + Math.floor(settings.flex * 0.5),
    TE: settings.te,
    K: settings.k,
    'D/ST': settings.dst,
  };

  const missingNeeds: Position[] = (['WR', 'RB', 'QB', 'TE'] as Position[]).filter(
    (pos) => counts[pos] < targetCounts[pos]
  );

  const scored = undrafted.map((player) => {
    const rawBase = BASE_PPR_REPLACEMENT[player.position] ?? 180;
    const baseline = Number((rawBase * (formatMults[player.position] ?? 1.0)).toFixed(1));
    const vorp = Number((player.seasonProjPts - baseline).toFixed(1));

    const samePosPool = undrafted
      .filter((p) => p.position === player.position && p.id !== player.id)
      .sort((a, b) => b.seasonProjPts - a.seasonProjPts);

    const nextBestPts = samePosPool[0]?.seasonProjPts ?? baseline;
    const nextBestDiff = Number((player.seasonProjPts - nextBestPts).toFixed(1));

    const needBonus = missingNeeds.includes(player.position) ? 12 : 0;
    const superflexBonus =
      player.position === 'QB' && settings.qb + settings.superflex >= 2 ? 18 : 0;

    // Penalize season-long IR/Out players during draft recommendations
    const injuryPenalty =
      player.injuryStatus === 'IR' || player.injuryStatus === 'SUSPENDED'
        ? -35
        : player.injuryStatus === 'OUT'
        ? -15
        : 0;

    const compositeScore = vorp + nextBestDiff * 0.5 + needBonus + superflexBonus + injuryPenalty;

    let headline = `Highest VORP Available • +${Math.max(0, nextBestDiff).toFixed(1)} vs next ${player.position}`;
    if (player.position === 'RB' && counts.RB >= 1) {
      headline = 'Secures RB/FLEX Depth • High Weekly Floor';
    } else if (player.tier === 1) {
      headline = `Elite Tier 1 ${player.position} • +${vorp} VORP`;
    }

    return {
      player,
      vorp,
      nextBestDiff,
      compositeScore,
      headline,
      subtext: `Tier ${player.tier} • ADP ${player.adp}`,
    };
  });

  scored.sort((a, b) => b.compositeScore - a.compositeScore);

  return {
    recommendations: scored.slice(0, 2),
    rankedPool: [...undrafted].sort((a, b) => a.adp - b.adp),
    missingNeeds,
  };
}

/**
 * 2. OptimalLineup()
 * Flags starters who are on Bye, Out/IR/Doubtful, or outscored by a healthy bench player
 */
export function OptimalLineup(
  currentStarters: { slot: LineupSlot; player: Player }[],
  currentBench: Player[],
  settings: RosterSettings = DEFAULT_ROSTER_SETTINGS
): LineupEvaluationResult {
  const week = settings.currentWeek;

  const evaluatedStarters: LineupAssignment[] = currentStarters.map(({ slot, player }) => {
    const starterEffPts = getEffectiveWeeklyPts(player, week);
    const starterUnavailable = isPlayerUnavailableForWeek(player, week);
    const statusLabel = getPlayerUnavailabilityLabel(player, week);

    // Only recommend healthy/active bench players who are not on Bye or Out/IR/Doubtful
    const eligibleBench = currentBench
      .filter(
        (b) =>
          isPositionEligibleForSlot(b.position, slot) &&
          !isPlayerUnavailableForWeek(b, week)
      )
      .sort((a, b) => getEffectiveWeeklyPts(b, week) - getEffectiveWeeklyPts(a, week));

    const bestBench = eligibleBench[0];
    const bestBenchEffPts = bestBench ? getEffectiveWeeklyPts(bestBench, week) : 0;

    const isOutscoredByBench = Boolean(bestBench && bestBenchEffPts > starterEffPts);
    const isSuboptimal = starterUnavailable || isOutscoredByBench;

    let warningReason: string | undefined;
    if (player.byeWeek === week) {
      warningReason = `${player.name} is on BYE in Week ${week} (0.0 pts).`;
    } else if (starterUnavailable && statusLabel) {
      warningReason = `${player.name} is listed as ${statusLabel} this week.`;
    } else if (isOutscoredByBench && bestBench) {
      warningReason = `Bench upgrade available: ${bestBench.name} (+${(
        bestBenchEffPts - starterEffPts
      ).toFixed(1)} pts).`;
    }

    return {
      slot,
      player,
      isSuboptimal,
      warningReason,
      suggestedReplacement: bestBench,
      pointGain: bestBench
        ? Number(Math.max(0, bestBenchEffPts - starterEffPts).toFixed(1))
        : 0,
    };
  });

  // Projected total uses effective weekly points (0.0 for Bye / Out / IR players)
  const projectedTotal = Number(
    evaluatedStarters
      .reduce((sum, item) => sum + getEffectiveWeeklyPts(item.player, week), 0)
      .toFixed(2)
  );

  const allPlayers = [...currentStarters.map((s) => s.player), ...currentBench];
  const optimalAssignment = solveBestRoster(allPlayers, settings);
  const optimalProjectedTotal = Number(
    optimalAssignment.starters
      .reduce((sum, s) => sum + getEffectiveWeeklyPts(s.player, week), 0)
      .toFixed(2)
  );

  const suboptimalCount = evaluatedStarters.filter((s) => s.isSuboptimal).length;

  return {
    starters: evaluatedStarters,
    bench: currentBench,
    projectedTotal,
    optimalProjectedTotal,
    suboptimalCount,
  };
}

/**
 * Solves for the highest-scoring legal starting lineup while strictly excluding
 * players on a Bye Week or listed as OUT, IR, SUSPENDED, or DOUBTFUL.
 */
export function solveBestRoster(
  allPlayers: User_Players,
  settings: RosterSettings = DEFAULT_ROSTER_SETTINGS
): {
  starters: { slot: LineupSlot; player: Player }[];
  bench: Player[];
} {
  const slots = buildLineupSlots(settings);
  const week = settings.currentWeek;
  const usedIds = new Set<string>();
  const starters: { slot: LineupSlot; player: Player }[] = [];

  const sortedSlots = [...slots].sort((a, b) => {
    const rank = (s: string) =>
      s.startsWith('SFLX') ? 3 : s.startsWith('FLEX') ? 2 : 1;
    return rank(a) - rank(b);
  });

  const assignedBySlot = new Map<LineupSlot, Player>();

  for (const slot of sortedSlots) {
    // Only consider active players not on Bye or Out/IR/Doubtful/Suspended
    const healthyCandidates = allPlayers
      .filter(
        (p) =>
          !usedIds.has(p.id) &&
          isPositionEligibleForSlot(p.position, slot) &&
          !isPlayerUnavailableForWeek(p, week)
      )
      .sort((a, b) => getEffectiveWeeklyPts(b, week) - getEffectiveWeeklyPts(a, week));

    if (healthyCandidates[0]) {
      usedIds.add(healthyCandidates[0].id);
      assignedBySlot.set(slot, healthyCandidates[0]);
    }
  }

  for (const slot of slots) {
    const player = assignedBySlot.get(slot);
    if (player) {
      starters.push({ slot, player });
    }
  }

  // Remaining players (including Bye week and Injured players) go to the Bench
  const bench = allPlayers
    .filter((p) => !usedIds.has(p.id))
    .sort((a, b) => getEffectiveWeeklyPts(b, week) - getEffectiveWeeklyPts(a, week));

  return { starters, bench };
}

/**
 * 3. TradeGrader()
 */
export function TradeGrader(
  trade: Player_Trade,
  currentTeam?: Current_Team,
  settings: RosterSettings = DEFAULT_ROSTER_SETTINGS
): Trade_Grade {
  const sendTotalProj = Number(
    trade.sendPlayers.reduce((sum, p) => sum + p.weeklyProjPts, 0).toFixed(1)
  );
  const receiveTotalProj = Number(
    trade.receivePlayers.reduce((sum, p) => sum + p.weeklyProjPts, 0).toFixed(1)
  );
  const netPointDifferential = Number((receiveTotalProj - sendTotalProj).toFixed(1));

  const hasTeamContext = Boolean(currentTeam && currentTeam.roster.length > 0);
  let preTradeLineupPts = 0;
  let postTradeLineupPts = 0;
  let startingLineupDelta = netPointDifferential;
  const teamFitInsights: string[] = [];

  // Warn if any incoming player in the trade is currently injured
  const injuredIncoming = trade.receivePlayers.filter(
    (p) => p.injuryStatus && p.injuryStatus !== 'ACTIVE'
  );
  if (injuredIncoming.length > 0) {
    teamFitInsights.push(
      `Injury Alert: Incoming player(s) ${injuredIncoming
        .map((p) => `${p.name} (${p.injuryStatus})`)
        .join(', ')} currently carry an injury designation.`
    );
  }

  if (hasTeamContext && currentTeam) {
    const preOptimal = solveBestRoster(currentTeam.roster, settings);
    preTradeLineupPts = Number(
      preOptimal.starters.reduce((sum, s) => sum + s.player.weeklyProjPts, 0).toFixed(1)
    );

    const sendIds = new Set(trade.sendPlayers.map((p) => p.id));
    const sendNames = new Set(trade.sendPlayers.map((p) => p.name.toLowerCase()));

    const postRoster = [
      ...currentTeam.roster.filter(
        (p) => !sendIds.has(p.id) && !sendNames.has(p.name.toLowerCase())
      ),
      ...trade.receivePlayers,
    ];

    const postOptimal = solveBestRoster(postRoster, settings);
    postTradeLineupPts = Number(
      postOptimal.starters.reduce((sum, s) => sum + s.player.weeklyProjPts, 0).toFixed(1)
    );
    startingLineupDelta = Number((postTradeLineupPts - preTradeLineupPts).toFixed(1));

    const postStarterIds = new Set(postOptimal.starters.map((s) => s.player.id));
    const newStarters = trade.receivePlayers.filter((p) => postStarterIds.has(p.id));
    if (newStarters.length > 0) {
      teamFitInsights.push(
        `Immediate Starter Upgrade: ${newStarters.map((p) => `${p.name} (${p.position})`).join(', ')} slots directly into your active starting lineup under ${SCORING_LABELS[settings.scoringFormat]}.`
      );
    } else {
      teamFitInsights.push(
        `Bench Depth Move: None of the incoming players crack your active starting lineup for Week ${settings.currentWeek}.`
      );
    }

    const preFilledSlots = new Set(preOptimal.starters.map((s) => s.slot));
    const postFilledSlots = new Set(postOptimal.starters.map((s) => s.slot));
    const lostSlots = Array.from(preFilledSlots).filter((slot) => !postFilledSlots.has(slot));
    const gainedSlots = Array.from(postFilledSlots).filter((slot) => !preFilledSlots.has(slot));

    if (lostSlots.length > 0) {
      teamFitInsights.push(
        `Positional Warning: Trading away ${trade.sendPlayers.map((p) => p.name).join(' & ')} leaves your ${lostSlots.join(', ')} slot empty.`
      );
    }
    if (gainedSlots.length > 0) {
      teamFitInsights.push(
        `Fills Roster Need: This trade fills your previously empty ${gainedSlots.join(', ')} starting slot.`
      );
    }
  }

  const effectiveDelta = hasTeamContext
    ? netPointDifferential * 0.45 + startingLineupDelta * 0.55
    : netPointDifferential;

  const rawScore = Math.max(0, Math.min(100, Math.round(75 + effectiveDelta * 4.5)));

  let letterGrade: Trade_Grade['letterGrade'] = 'C';
  if (rawScore >= 93) letterGrade = 'A+';
  else if (rawScore >= 87) letterGrade = 'A';
  else if (rawScore >= 82) letterGrade = 'A-';
  else if (rawScore >= 78) letterGrade = 'B+';
  else if (rawScore >= 73) letterGrade = 'B';
  else if (rawScore >= 68) letterGrade = 'B-';
  else if (rawScore >= 63) letterGrade = 'C+';
  else if (rawScore >= 55) letterGrade = 'C';
  else if (rawScore >= 45) letterGrade = 'D';
  else letterGrade = 'F';

  const recommendation: Trade_Grade['recommendation'] =
    effectiveDelta >= 0.8 ? 'ACCEPT' : effectiveDelta <= -0.8 ? 'DECLINE' : 'NEUTRAL';

  const recvNames = trade.receivePlayers.map((p) => p.name).join(' & ');
  const sendNames = trade.sendPlayers.map((p) => p.name).join(' & ');
  const formatLabel = SCORING_LABELS[settings.scoringFormat];

  let summary = '';
  if (hasTeamContext) {
    summary =
      startingLineupDelta >= 0
        ? `Under ${formatLabel}, acquiring ${recvNames} for ${sendNames} changes your optimal starting lineup from ${preTradeLineupPts.toFixed(1)} to ${postTradeLineupPts.toFixed(1)} pts/wk (${startingLineupDelta >= 0 ? '+' : ''}${startingLineupDelta} starter pts/wk; ${netPointDifferential >= 0 ? '+' : ''}${netPointDifferential} raw package pts/wk).`
        : `Under ${formatLabel}, while the raw package differential is ${netPointDifferential >= 0 ? '+' : ''}${netPointDifferential} pts/wk, this trade reduces your optimal starting lineup by ${startingLineupDelta} pts/wk (${preTradeLineupPts.toFixed(1)} → ${postTradeLineupPts.toFixed(1)} pts/wk).`;
  } else {
    summary =
      netPointDifferential >= 0
        ? `Under ${formatLabel}, acquiring ${recvNames} yields a +${netPointDifferential} pts/week upgrade over ${sendNames}. Add your team in Weekly Lineup to see exact starter impact.`
        : `Under ${formatLabel}, trading away ${sendNames} results in a ${netPointDifferential} pts/week net loss. Add your team in Weekly Lineup to evaluate positional fit.`;
  }

  return {
    letterGrade,
    numericScore: rawScore,
    sendTotalProj,
    receiveTotalProj,
    netPointDifferential,
    preTradeLineupPts,
    postTradeLineupPts,
    startingLineupDelta,
    hasTeamContext,
    teamFitInsights,
    summary,
    recommendation,
  };
}