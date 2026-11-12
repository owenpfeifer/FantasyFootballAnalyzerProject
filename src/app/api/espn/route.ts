// src/app/api/espn/route.ts
import { NextResponse } from 'next/server';
import { promises as fs } from 'fs';
import path from 'path';
import { Player, Position, InjuryStatus } from '@/lib/models';
import { INITIAL_PLAYER_POOL, INITIAL_USER_ROSTER, TRADE_DEMO_PLAYERS } from '@/lib/cacheStore';

const CACHE_DIR = path.join(process.cwd(), '.next', 'cache');
const CACHE_FILE = path.join(CACHE_DIR, 'espn-players-cache-v3.json');
const CACHE_TTL_MS = 60 * 60 * 1000; // 1 hour standard cache TTL
const MIN_REFRESH_COOLDOWN_MS = 60 * 1000; // 60s minimum interval between live ESPN pulls

const POSITION_MAP: Record<number, Position> = {
  1: 'QB',
  2: 'RB',
  3: 'WR',
  4: 'TE',
  5: 'K',
  16: 'D/ST',
};

// Matches ESPN's official abbreviations (WSH for Washington)
const PRO_TEAM_MAP: Record<number, string> = {
  1: 'ATL', 2: 'BUF', 3: 'CHI', 4: 'CIN', 5: 'CLE', 6: 'DAL', 7: 'DEN', 8: 'DET',
  9: 'GB', 10: 'TEN', 11: 'IND', 12: 'KC', 13: 'LV', 14: 'LAR', 15: 'MIA', 16: 'MIN',
  17: 'NE', 18: 'NO', 19: 'NYG', 20: 'NYJ', 21: 'PHI', 22: 'ARI', 23: 'PIT', 24: 'LAC',
  25: 'SF', 26: 'SEA', 27: 'TB', 28: 'WSH', 29: 'CAR', 30: 'JAX', 33: 'BAL', 34: 'HOU',
};

function normalizeTeamAbbr(abbr?: string): string {
  if (!abbr) return 'NFL';
  const upper = abbr.toUpperCase();
  if (upper === 'WAS') return 'WSH';
  if (upper === 'JAC') return 'JAX';
  return upper;
}

function mapEspnInjuryStatus(rawStatus?: string, injuredFlag?: boolean): InjuryStatus {
  if (!rawStatus) return injuredFlag ? 'QUESTIONABLE' : 'ACTIVE';
  const upper = rawStatus.toUpperCase();
  if (upper === 'OUT' || upper === 'O') return 'OUT';
  if (upper.includes('IR') || upper.includes('INJURY_RESERVE')) return 'IR';
  if (upper.includes('SUSP')) return 'SUSPENDED';
  if (upper.includes('DOUBT') || upper === 'D') return 'DOUBTFUL';
  if (upper.includes('QUEST') || upper === 'Q' || upper === 'PROBABLE') return 'QUESTIONABLE';
  return injuredFlag ? 'QUESTIONABLE' : 'ACTIVE';
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const season = searchParams.get('season') || '2026';
  const forceRefresh = searchParams.get('refresh') === 'true';

  // 1. Check local disk cache
  try {
    const rawCache = await fs.readFile(CACHE_FILE, 'utf-8');
    const parsed = JSON.parse(rawCache);
    const cacheAgeMs = Date.now() - (parsed?.timestamp || 0);

    if (
      parsed &&
      Array.isArray(parsed.players) &&
      ((!forceRefresh && cacheAgeMs < CACHE_TTL_MS) || cacheAgeMs < MIN_REFRESH_COOLDOWN_MS)
    ) {
      return NextResponse.json({
        source: 'Local Disk Cache (ESPN)',
        currentWeek: parsed.currentWeek || 10,
        count: parsed.players.length,
        players: parsed.players,
      });
    }
  } catch {
    // Cache miss or expired; proceed to live ESPN fetch
  }

  try {
    // 2. Fetch live NFL Scoreboard to get the active NFL week and live matchups
    let currentWeek = 10;
    const scoreboardMatchups: Record<string, string> = {};
    const playingTeamsThisWeek = new Set<string>();

    try {
      const sbRes = await fetch(
        'https://site.api.espn.com/apis/site/v2/sports/football/nfl/scoreboard',
        { cache: 'no-store' }
      );
      if (sbRes.ok) {
        const sbData = await sbRes.json();
        if (sbData.week?.number && sbData.season?.type === 2) {
          currentWeek = Number(sbData.week.number);
        }
        const events = sbData.events || [];
        for (const ev of events) {
          const comp = ev.competitions?.[0];
          const competitors = comp?.competitors || [];
          if (competitors.length === 2) {
            const home = competitors.find((c: any) => c.homeAway === 'home');
            const away = competitors.find((c: any) => c.homeAway === 'away');
            const homeAbbr = normalizeTeamAbbr(home?.team?.abbreviation);
            const awayAbbr = normalizeTeamAbbr(away?.team?.abbreviation);
            if (homeAbbr && awayAbbr) {
              scoreboardMatchups[homeAbbr] = `vs ${awayAbbr}`;
              scoreboardMatchups[awayAbbr] = `@ ${homeAbbr}`;
              playingTeamsThisWeek.add(homeAbbr);
              playingTeamsThisWeek.add(awayAbbr);
            }
          }
        }
      }
    } catch {
      // Continue to ESPN Fantasy proTeamSchedules_wl endpoint
    }

    // 3. Fetch official NFL team bye weeks & schedules by proTeamId from ESPN Fantasy API
    const officialByeByTeamId: Record<number, number> = {};
    const scheduleOppByTeamId: Record<number, Record<number, string>> = {};

    try {
      const schedUrl = `https://lm-api-reads.fantasy.espn.com/apis/v3/games/ffl/seasons/${season}?view=proTeamSchedules_wl`;
      const schedRes = await fetch(schedUrl, { cache: 'no-store' });
      if (schedRes.ok) {
        const schedData = await schedRes.json();
        const proTeams = schedData?.settings?.proTeams || [];

        // Map proTeamId -> abbreviation first
        for (const pt of proTeams) {
          if (typeof pt.id === 'number' && pt.abbrev) {
            PRO_TEAM_MAP[pt.id] = normalizeTeamAbbr(pt.abbrev);
          }
        }

        // Extract exact byeWeek and weekly opponents per proTeamId
        for (const pt of proTeams) {
          if (typeof pt.id === 'number') {
            if (typeof pt.byeWeek === 'number' && pt.byeWeek > 0) {
              officialByeByTeamId[pt.id] = pt.byeWeek;
            }
            if (pt.proGamesByScoringPeriod) {
              scheduleOppByTeamId[pt.id] = {};
              for (const [wkStr, games] of Object.entries(pt.proGamesByScoringPeriod)) {
                const wkNum = Number(wkStr);
                const game = Array.isArray(games) ? games[0] : null;
                if (game && wkNum >= 1 && wkNum <= 18) {
                  const isHome = game.homeProTeamId === pt.id;
                  const oppId = isHome ? game.awayProTeamId : game.homeProTeamId;
                  const oppAbbr = PRO_TEAM_MAP[oppId] || 'OPP';
                  scheduleOppByTeamId[pt.id][wkNum] = isHome ? `vs ${oppAbbr}` : `@ ${oppAbbr}`;
                }
              }
            }
          }
        }
      }
    } catch {
      // Fallback handled below
    }

    // 4. Request ALL active NFL players (limit: 2000) from ESPN Fantasy v3 API
    const filter = {
      players: {
        filterSlotIds: { value: [0, 2, 4, 6, 16, 17] },
        limit: 2000,
        sortPercOwned: { sortPriority: 1, sortAsc: false },
      },
    };

    const url = `https://lm-api-reads.fantasy.espn.com/apis/v3/games/ffl/seasons/${season}/segments/0/leaguedefaults/3?view=kona_player_info`;

    const response = await fetch(url, {
      headers: {
        Accept: 'application/json',
        'X-Fantasy-Filter': JSON.stringify(filter),
      },
      cache: 'no-store',
    });

    if (!response.ok) {
      throw new Error(`ESPN API responded with ${response.status}`);
    }

    const data = await response.json();
    const rawPlayers = data.players || [];

    if (!Array.isArray(rawPlayers) || rawPlayers.length === 0) {
      throw new Error('Empty player array from ESPN');
    }

    const players: Player[] = rawPlayers
      .map((entry: any, index: number): Player | null => {
        const p = entry.player || entry;
        if (!p || !p.fullName) return null;

        const position = POSITION_MAP[p.defaultPositionId];
        if (!position) return null;

        if (!p.proTeamId || p.proTeamId === 0) return null;

        const teamId = Number(p.proTeamId);
        const team = PRO_TEAM_MAP[teamId] || 'NFL';

        // Use official ESPN proTeam byeWeek
        let byeWeek = officialByeByTeamId[teamId] ?? 0;

        // Safety check: if the live scoreboard shows this team is playing in currentWeek,
        // they are definitely NOT on a bye in currentWeek
        if (playingTeamsThisWeek.has(team) && byeWeek === currentWeek) {
          byeWeek = 0;
        }

        const opponent =
          byeWeek === currentWeek
            ? 'BYE'
            : scoreboardMatchups[team] ||
              scheduleOppByTeamId[teamId]?.[currentWeek] ||
              `Wk ${currentWeek}`;

        const injuryStatus = mapEspnInjuryStatus(p.injuryStatus, p.injured);

        const adpRaw = p.ownership?.averageDraftPosition || index + 1;
        const adp = Number(Math.max(1, adpRaw).toFixed(1));
        const tier = Math.min(5, Math.floor(index / 24) + 1);

        let seasonProjPts = 0;
        let avgPts = 0;

        if (Array.isArray(p.stats)) {
          for (const stat of p.stats) {
            if (stat.statSourceId === 1 && stat.appliedTotal > seasonProjPts) {
              seasonProjPts = stat.appliedTotal;
              avgPts = stat.appliedAverage || stat.appliedTotal / 17;
            } else if (
              stat.statSourceId === 0 &&
              stat.appliedTotal > 30 &&
              seasonProjPts === 0
            ) {
              seasonProjPts = stat.appliedTotal;
              avgPts = stat.appliedAverage || stat.appliedTotal / 17;
            }
          }
        }

        if (!seasonProjPts || seasonProjPts < 10) {
          const pctOwned = p.ownership?.percentOwned || 0;
          const rankFactor = Math.max(0.05, Math.min(1, pctOwned / 100 || 1 - index / 800));
          const posBase =
            position === 'QB'
              ? 220
              : position === 'RB'
              ? 130
              : position === 'WR'
              ? 135
              : position === 'TE'
              ? 100
              : 110;
          seasonProjPts = posBase * rankFactor + (index < 150 ? 65 : 15);
          avgPts = seasonProjPts / 17;
        }

        const weeklyProjPts = Number((seasonProjPts / 17).toFixed(1));

        return {
          id: String(p.id),
          name: p.fullName,
          position,
          team,
          opponent,
          byeWeek,
          injuryStatus,
          adp,
          tier,
          seasonProjPts: Number(seasonProjPts.toFixed(1)),
          weeklyProjPts,
          avgPts: Number((avgPts || weeklyProjPts).toFixed(1)),
        };
      })
      .filter((p): p is Player => p !== null);

    try {
      await fs.mkdir(CACHE_DIR, { recursive: true });
      await fs.writeFile(
        CACHE_FILE,
        JSON.stringify({
          timestamp: Date.now(),
          currentWeek,
          players,
        }),
        'utf-8'
      );
    } catch {
      // Ignore file-write errors
    }

    return NextResponse.json({
      source: 'ESPN Live API',
      currentWeek,
      count: players.length,
      players,
    });
  } catch {
    const combinedMap = new Map<string, Player>();
    [
      ...INITIAL_PLAYER_POOL,
      ...INITIAL_USER_ROSTER,
      ...Object.values(TRADE_DEMO_PLAYERS),
    ].forEach((p) => combinedMap.set(p.name, { ...p, injuryStatus: 'ACTIVE' }));

    return NextResponse.json({
      source: 'Local Cache Fallback',
      currentWeek: 10,
      count: combinedMap.size,
      players: Array.from(combinedMap.values()),
    });
  }
}