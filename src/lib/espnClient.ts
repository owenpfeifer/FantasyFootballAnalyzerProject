// src/lib/espnClient.ts
import { Player } from './models';
import { cacheStore, INITIAL_PLAYER_POOL, INITIAL_USER_ROSTER } from './cacheStore';

const LOCAL_STORAGE_PLAYER_CACHE = 'ffa_espn_players_cache_v3';
const CACHE_TTL_MS = 60 * 60 * 1000; // 1 hour

export interface EspnFetchResult {
  players: Player[];
  source: string;
  currentWeek: number;
}

export async function fetchEspnPlayers(
  seasonId = 2026,
  forceRefresh = false
): Promise<EspnFetchResult> {
  const cacheKey = `espn_live_pool_v3_${seasonId}`;

  if (!forceRefresh) {
    const memCached = cacheStore.get<EspnFetchResult>(cacheKey);
    if (memCached) return memCached;

    if (typeof window !== 'undefined') {
      try {
        const raw = window.localStorage.getItem(LOCAL_STORAGE_PLAYER_CACHE);
        if (raw) {
          const parsed = JSON.parse(raw);
          if (
            parsed &&
            Date.now() - parsed.timestamp < CACHE_TTL_MS &&
            Array.isArray(parsed.players) &&
            parsed.players.length > 0
          ) {
            const result: EspnFetchResult = {
              players: parsed.players,
              source: 'Browser Cache',
              currentWeek: parsed.currentWeek || 10,
            };
            cacheStore.set(cacheKey, result);
            return result;
          }
        }
      } catch {
        // Proceed to network fetch
      }
    }
  }

  try {
    const query = `/api/espn?season=${seasonId}${forceRefresh ? '&refresh=true' : ''}`;
    const res = await fetch(query);
    if (!res.ok) throw new Error(`Status ${res.status}`);
    const data = await res.json();

    if (Array.isArray(data.players) && data.players.length > 0) {
      const result: EspnFetchResult = {
        players: data.players,
        source: data.source || 'ESPN Live API',
        currentWeek: data.currentWeek || 10,
      };

      cacheStore.set(cacheKey, result);

      if (typeof window !== 'undefined') {
        try {
          window.localStorage.setItem(
            LOCAL_STORAGE_PLAYER_CACHE,
            JSON.stringify({
              timestamp: Date.now(),
              currentWeek: result.currentWeek,
              players: result.players,
            })
          );
        } catch {
          // Ignore storage quota errors
        }
      }

      return result;
    }
    throw new Error('No players returned');
  } catch {
    const fallbackPlayers = [...INITIAL_PLAYER_POOL, ...INITIAL_USER_ROSTER];
    return {
      players: fallbackPlayers,
      source: 'Offline Cache',
      currentWeek: 10,
    };
  }
}