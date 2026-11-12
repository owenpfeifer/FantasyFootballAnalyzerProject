// src/lib/models.ts

export type Position = 'QB' | 'RB' | 'WR' | 'TE' | 'K' | 'D/ST';
export type LineupSlot = string;
export type ScoringFormat = 'PPR' | 'HALF_PPR' | 'STANDARD';
export type InjuryStatus =
  | 'ACTIVE'
  | 'QUESTIONABLE'
  | 'DOUBTFUL'
  | 'OUT'
  | 'IR'
  | 'SUSPENDED';

export const SCORING_LABELS: Record<ScoringFormat, string> = {
  PPR: 'Full PPR (1.0 pt/rec)',
  HALF_PPR: 'Half-PPR (0.5 pt/rec)',
  STANDARD: 'Standard Non-PPR (0 pt/rec)',
};

export interface RosterSettings {
  scoringFormat: ScoringFormat;
  currentWeek: number; // 1 - 18 NFL regular season week
  numTeams: number;    // 4 - 20 teams in league
  qb: number;          // 0 - 3
  rb: number;          // 0 - 4
  wr: number;          // 0 - 5
  te: number;          // 0 - 3
  flex: number;        // 0 - 4 (RB / WR / TE)
  superflex: number;   // 0 - 2 (QB / RB / WR / TE)
  k: number;           // 0 - 2
  dst: number;         // 0 - 2
  bench: number;       // 0 - 15
}

export const DEFAULT_ROSTER_SETTINGS: RosterSettings = {
  scoringFormat: 'PPR',
  currentWeek: 10,
  numTeams: 12,
  qb: 1,
  rb: 2,
  wr: 2,
  te: 1,
  flex: 1,
  superflex: 0,
  k: 1,
  dst: 0,
  bench: 6,
};

export const SCORING_MULTIPLIERS: Record<ScoringFormat, Record<Position, number>> = {
  PPR: { QB: 1.0, RB: 1.0, WR: 1.0, TE: 1.0, K: 1.0, 'D/ST': 1.0 },
  HALF_PPR: { QB: 1.0, RB: 0.91, WR: 0.86, TE: 0.84, K: 1.0, 'D/ST': 1.0 },
  STANDARD: { QB: 1.0, RB: 0.82, WR: 0.72, TE: 0.68, K: 1.0, 'D/ST': 1.0 },
};

export function buildLineupSlots(settings: RosterSettings): LineupSlot[] {
  const slots: LineupSlot[] = [];
  const pushSlots = (prefix: string, count: number) => {
    for (let i = 1; i <= count; i++) {
      slots.push(count === 1 ? prefix : `${prefix}${i}`);
    }
  };

  pushSlots('QB', settings.qb);
  pushSlots('RB', settings.rb);
  pushSlots('WR', settings.wr);
  pushSlots('TE', settings.te);
  pushSlots('FLEX', settings.flex);
  pushSlots('SFLX', settings.superflex);
  pushSlots('K', settings.k);
  pushSlots('D/ST', settings.dst);

  return slots;
}

export function isPositionEligibleForSlot(position: Position, slot: LineupSlot): boolean {
  if (slot.startsWith('QB')) return position === 'QB';
  if (slot.startsWith('RB')) return position === 'RB';
  if (slot.startsWith('WR')) return position === 'WR';
  if (slot.startsWith('TE')) return position === 'TE';
  if (slot.startsWith('FLEX')) return ['RB', 'WR', 'TE'].includes(position);
  if (slot.startsWith('SFLX')) return ['QB', 'RB', 'WR', 'TE'].includes(position);
  if (slot.startsWith('K')) return position === 'K';
  if (slot.startsWith('D/ST')) return position === 'D/ST';
  return false;
}

export interface Player {
  id: string;
  name: string;
  position: Position;
  team: string;
  opponent: string;
  byeWeek: number;
  injuryStatus?: InjuryStatus;
  adp: number;
  tier: number;
  seasonProjPts: number;
  weeklyProjPts: number;
  avgPts: number;
  baseSeasonProjPts?: number;
  baseWeeklyProjPts?: number;
  baseAvgPts?: number;
  drafted?: boolean;
}

/**
 * Returns true if the player is on Bye for the given week or ruled Out / IR / Suspended / Doubtful
 */
export function isPlayerUnavailableForWeek(player: Player, currentWeek: number): boolean {
  if (player.byeWeek === currentWeek) return true;
  const status = player.injuryStatus || 'ACTIVE';
  return ['OUT', 'IR', 'SUSPENDED', 'DOUBTFUL'].includes(status);
}

/**
 * Returns a human-readable reason if a player should not be started this week
 */
export function getPlayerUnavailabilityLabel(player: Player, currentWeek: number): string | null {
  if (player.byeWeek === currentWeek) return `BYE (Wk ${currentWeek})`;
  const status = player.injuryStatus || 'ACTIVE';
  if (status === 'OUT') return 'OUT';
  if (status === 'IR') return 'IR';
  if (status === 'SUSPENDED') return 'SUSP';
  if (status === 'DOUBTFUL') return 'DOUBTFUL';
  if (status === 'QUESTIONABLE') return 'QUESTIONABLE';
  return null;
}

/**
 * Calculates effective weekly projected points for lineup optimization.
 * Players on a Bye week or Out/IR/Suspended score 0.0 for the week; Doubtful players are heavily discounted.
 */
export function getEffectiveWeeklyPts(player: Player, currentWeek: number): number {
  if (player.byeWeek === currentWeek) return 0;
  const status = player.injuryStatus || 'ACTIVE';
  if (status === 'OUT' || status === 'IR' || status === 'SUSPENDED') return 0;
  if (status === 'DOUBTFUL') return Number((player.weeklyProjPts * 0.15).toFixed(1));
  return player.weeklyProjPts;
}

/**
 * Losslessly scales a player's projections to the active ScoringFormat
 */
export function scalePlayerForScoring(player: Player, format: ScoringFormat): Player {
  const baseSeason = player.baseSeasonProjPts ?? player.seasonProjPts;
  const baseWeekly = player.baseWeeklyProjPts ?? player.weeklyProjPts;
  const baseAvg = player.baseAvgPts ?? player.avgPts;

  const mult = SCORING_MULTIPLIERS[format]?.[player.position] ?? 1.0;

  return {
    ...player,
    injuryStatus: player.injuryStatus || 'ACTIVE',
    baseSeasonProjPts: baseSeason,
    baseWeeklyProjPts: baseWeekly,
    baseAvgPts: baseAvg,
    seasonProjPts: Number((baseSeason * mult).toFixed(1)),
    weeklyProjPts: Number((baseWeekly * mult).toFixed(1)),
    avgPts: Number((baseAvg * mult).toFixed(1)),
  };
}

export type User_Players = Player[];

export interface Current_Team {
  teamId: string;
  teamName: string;
  roster: User_Players;
  draftPicks: { pickLabel: string; player?: Player }[];
}

export interface Player_Trade {
  sendPlayers: Player[];
  receivePlayers: Player[];
}

export interface Trade_Grade {
  letterGrade: 'A+' | 'A' | 'A-' | 'B+' | 'B' | 'B-' | 'C+' | 'C' | 'D' | 'F';
  numericScore: number;
  sendTotalProj: number;
  receiveTotalProj: number;
  netPointDifferential: number;
  preTradeLineupPts: number;
  postTradeLineupPts: number;
  startingLineupDelta: number;
  hasTeamContext: boolean;
  teamFitInsights: string[];
  summary: string;
  recommendation: 'ACCEPT' | 'DECLINE' | 'NEUTRAL';
}

export interface DraftRecommendation {
  player: Player;
  vorp: number;
  nextBestDiff: number;
  headline: string;
  subtext: string;
}

export interface LineupAssignment {
  slot: LineupSlot;
  player: Player;
  isSuboptimal: boolean;
  warningReason?: string;
  suggestedReplacement?: Player;
  pointGain?: number;
}

export interface LineupEvaluationResult {
  starters: LineupAssignment[];
  bench: Player[];
  projectedTotal: number;
  optimalProjectedTotal: number;
  suboptimalCount: number;
}