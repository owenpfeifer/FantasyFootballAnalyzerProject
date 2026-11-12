// src/lib/cacheStore.ts
import { Player } from './models';

interface CacheEntry<T> {
  data: T;
  timestamp: number;
}

class MemoryCacheStore {
  private store = new Map<string, CacheEntry<unknown>>();
  private ttlMs = 5 * 60 * 1000; // 5-minute TTL

  get<T>(key: string): T | null {
    const entry = this.store.get(key);
    if (!entry) return null;
    if (Date.now() - entry.timestamp > this.ttlMs) {
      this.store.delete(key);
      return null;
    }
    return entry.data as T;
  }

  set<T>(key: string, data: T): void {
    this.store.set(key, { data, timestamp: Date.now() });
  }
}

export const cacheStore = new MemoryCacheStore();

// Pre-populated current + historical NFL player store matching UI screenshots
export const INITIAL_PLAYER_POOL: Player[] = [
  { id: '1', name: 'Breece Hall', position: 'RB', team: 'NYJ', opponent: 'vs NE', byeWeek: 12, adp: 14.2, tier: 2, seasonProjPts: 285.5, weeklyProjPts: 17.2, avgPts: 16.8 },
  { id: '2', name: 'Marvin Harrison Jr.', position: 'WR', team: 'ARI', opponent: 'vs LAR', byeWeek: 11, adp: 15.8, tier: 2, seasonProjPts: 270.2, weeklyProjPts: 15.9, avgPts: 15.1 },
  { id: '3', name: 'Josh Allen', position: 'QB', team: 'BUF', opponent: 'vs MIA', byeWeek: 12, adp: 18.5, tier: 1, seasonProjPts: 390.1, weeklyProjPts: 24.1, avgPts: 23.5 },
  { id: '4', name: 'Sam LaPorta', position: 'TE', team: 'DET', opponent: '@ CHI', byeWeek: 9, adp: 22.1, tier: 1, seasonProjPts: 210.8, weeklyProjPts: 13.4, avgPts: 12.9 },
  { id: '5', name: 'Isiah Pacheco', position: 'RB', team: 'KC', opponent: 'vs LV', byeWeek: 10, adp: 24.3, tier: 3, seasonProjPts: 245.0, weeklyProjPts: 14.8, avgPts: 14.2 },
  { id: '6', name: 'Nico Collins', position: 'WR', team: 'HOU', opponent: 'vs JAX', byeWeek: 14, adp: 26.4, tier: 3, seasonProjPts: 255.0, weeklyProjPts: 16.1, avgPts: 15.7 },
  { id: '7', name: 'Trey McBride', position: 'TE', team: 'ARI', opponent: 'vs LAR', byeWeek: 11, adp: 38.2, tier: 2, seasonProjPts: 192.4, weeklyProjPts: 12.1, avgPts: 11.8 },
];

export const INITIAL_USER_ROSTER: Player[] = [
  // Current Starting Lineup (Screenshot 3)
  { id: '101', name: 'Patrick Mahomes', position: 'QB', team: 'KC', opponent: 'vs LV', byeWeek: 6, adp: 28.0, tier: 1, seasonProjPts: 355.0, weeklyProjPts: 20.5, avgPts: 20.1 },
  { id: '102', name: 'Travis Etienne', position: 'RB', team: 'JAX', opponent: '@ HOU', byeWeek: 12, adp: 21.0, tier: 2, seasonProjPts: 248.0, weeklyProjPts: 14.2, avgPts: 14.5 },
  { id: '103', name: 'Najee Harris', position: 'RB', team: 'PIT', opponent: 'vs CLE', byeWeek: 9, adp: 68.0, tier: 4, seasonProjPts: 175.0, weeklyProjPts: 9.1, avgPts: 9.8 },
  { id: '104', name: 'CeeDee Lamb', position: 'WR', team: 'DAL', opponent: 'vs PHI', byeWeek: 7, adp: 2.1, tier: 1, seasonProjPts: 315.0, weeklyProjPts: 18.5, avgPts: 19.2 },
  { id: '105', name: 'Drake London', position: 'WR', team: 'ATL', opponent: 'vs NO', byeWeek: 12, adp: 34.0, tier: 3, seasonProjPts: 215.0, weeklyProjPts: 10.5, avgPts: 11.4 },
  { id: '106', name: 'George Kittle', position: 'TE', team: 'SF', opponent: '@ SEA', byeWeek: 9, adp: 48.0, tier: 2, seasonProjPts: 188.0, weeklyProjPts: 11.2, avgPts: 11.6 },
  { id: '107', name: 'Jakobi Meyers', position: 'WR', team: 'LV', opponent: '@ KC', byeWeek: 10, adp: 95.0, tier: 4, seasonProjPts: 168.0, weeklyProjPts: 9.8, avgPts: 10.1 },
  { id: '108', name: 'Brandon Aubrey', position: 'K', team: 'DAL', opponent: 'vs PHI', byeWeek: 7, adp: 130.0, tier: 1, seasonProjPts: 152.0, weeklyProjPts: 8.5, avgPts: 9.2 },
  // Bench Players (Screenshot 3)
  { id: '109', name: "De'Von Achane", position: 'RB', team: 'MIA', opponent: 'vs NYJ', byeWeek: 6, adp: 19.5, tier: 2, seasonProjPts: 268.0, weeklyProjPts: 16.8, avgPts: 17.1 },
  { id: '110', name: 'Mike Evans', position: 'WR', team: 'TB', opponent: 'vs CAR', byeWeek: 11, adp: 31.0, tier: 2, seasonProjPts: 252.0, weeklyProjPts: 15.5, avgPts: 15.0 },
  { id: '111', name: 'DJ Moore', position: 'WR', team: 'CHI', opponent: '@ DET', byeWeek: 7, adp: 36.0, tier: 2, seasonProjPts: 238.0, weeklyProjPts: 14.0, avgPts: 13.8 },
  { id: '112', name: 'Kyle Pitts', position: 'TE', team: 'ATL', opponent: 'vs NO', byeWeek: 12, adp: 72.0, tier: 3, seasonProjPts: 154.0, weeklyProjPts: 8.2, avgPts: 8.5 },
];

export const TRADE_DEMO_PLAYERS: Record<string, Player> = {
  lamar: { id: '201', name: 'Lamar Jackson', position: 'QB', team: 'BAL', opponent: 'vs CIN', byeWeek: 14, adp: 20.1, tier: 1, seasonProjPts: 375.0, weeklyProjPts: 22.4, avgPts: 21.1 },
  andrews: { id: '202', name: 'Mark Andrews', position: 'TE', team: 'BAL', opponent: 'vs CIN', byeWeek: 14, adp: 44.0, tier: 2, seasonProjPts: 182.0, weeklyProjPts: 10.2, avgPts: 11.5 },
  jefferson: { id: '203', name: 'Justin Jefferson', position: 'WR', team: 'MIN', opponent: '@ GB', byeWeek: 6, adp: 1.5, tier: 1, seasonProjPts: 325.0, weeklyProjPts: 19.8, avgPts: 18.5 },
  montgomery: { id: '204', name: 'David Montgomery', position: 'RB', team: 'DET', opponent: '@ CHI', byeWeek: 9, adp: 54.0, tier: 2, seasonProjPts: 232.0, weeklyProjPts: 14.5, avgPts: 14.0 },
};