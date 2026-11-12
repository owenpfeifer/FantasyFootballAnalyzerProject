// src/components/Sidebar.tsx
'use client';

import React from 'react';
import {
  Activity,
  ListOrdered,
  Users,
  ArrowLeftRight,
  RefreshCw,
  HardDrive,
} from 'lucide-react';

export type ActiveTab = 'draft' | 'lineup' | 'trade';

interface SidebarProps {
  activeTab: ActiveTab;
  setActiveTab: (tab: ActiveTab) => void;
  rosterCount: number;
  isHydrated: boolean;
  isLoadingApi: boolean;
  apiSource: string;
  onRefreshEspn: () => void;
}

export default function Sidebar({
  activeTab,
  setActiveTab,
  rosterCount,
  isHydrated,
  isLoadingApi,
  apiSource,
  onRefreshEspn,
}: SidebarProps) {
  return (
    <aside className="w-64 bg-[#0b101e] border-r border-slate-800/80 flex flex-col justify-between p-5 shrink-0">
      <div>
        <div className="flex items-center gap-3 px-2 pb-6 border-b border-slate-800/80">
          <div className="w-10 h-10 rounded-full bg-blue-600/20 border border-blue-500/40 flex items-center justify-center text-blue-400">
            <Activity className="w-5 h-5" />
          </div>
          <div>
            <h1 className="font-bold text-base tracking-tight text-white">Fantasy Football Analyzer</h1>
            <p className="text-xs text-slate-400">Created by Owen Pfeifer, Josh Smith, Ryan Snyder</p>
          </div>
        </div>

        <nav className="mt-6 space-y-2">
          <button
            onClick={() => setActiveTab('draft')}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition ${
              activeTab === 'draft'
                ? 'bg-blue-950/60 text-blue-400 border border-blue-700/50'
                : 'text-slate-400 hover:bg-slate-800/40 hover:text-slate-200'
            }`}
          >
            <ListOrdered className="w-4 h-4" />
            Draft Assistance
          </button>

          <button
            onClick={() => setActiveTab('lineup')}
            className={`w-full flex items-center justify-between px-4 py-3 rounded-xl text-sm font-medium transition ${
              activeTab === 'lineup'
                ? 'bg-emerald-950/60 text-emerald-400 border border-emerald-700/50'
                : 'text-slate-400 hover:bg-slate-800/40 hover:text-slate-200'
            }`}
          >
            <span className="flex items-center gap-3">
              <Users className="w-4 h-4" />
              Weekly Lineup
            </span>
            {isHydrated && rosterCount > 0 && (
              <span className="px-2 py-0.5 text-[10px] font-bold rounded-full bg-emerald-900/60 text-emerald-300">
                {rosterCount}
              </span>
            )}
          </button>

          <button
            onClick={() => setActiveTab('trade')}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition ${
              activeTab === 'trade'
                ? 'bg-blue-950/60 text-blue-400 border border-blue-700/50'
                : 'text-slate-400 hover:bg-slate-800/40 hover:text-slate-200'
            }`}
          >
            <ArrowLeftRight className="w-4 h-4" />
            Trade Analyzer
          </button>
        </nav>
      </div>

      <div className="p-3.5 rounded-xl bg-slate-900/70 border border-slate-800 text-xs text-slate-400 space-y-2.5">
        <div className="space-y-1">
          <div className="flex items-center justify-between">
            <span>Player Pool</span>
            <span className="text-emerald-400 font-medium">{apiSource}</span>
          </div>
          <div className="flex items-center justify-between">
            <span>Lineup Storage</span>
            <span className="text-blue-400 font-medium flex items-center gap-1">
              <HardDrive className="w-3 h-3" />
              {isHydrated ? 'Auto-Saved' : 'Syncing...'}
            </span>
          </div>
        </div>

        <button
          onClick={onRefreshEspn}
          disabled={isLoadingApi}
          className="w-full flex items-center justify-center gap-1.5 py-2 px-3 rounded-lg bg-slate-800 hover:bg-slate-700 disabled:opacity-50 text-slate-200 font-semibold text-[11px] transition"
        >
          <RefreshCw className={`w-3 h-3 ${isLoadingApi ? 'animate-spin text-emerald-400' : ''}`} />
          {isLoadingApi ? 'Syncing...' : 'Sync Live Injuries & Byes'}
        </button>
      </div>
    </aside>
  );
}