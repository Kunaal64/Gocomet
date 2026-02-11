/**
 * LeaderboardTable Component
 * Displays top 10 players with rank badges, avatars, and scores
 */
import { useState } from 'react';

const RANK_STYLES = {
  1: 'bg-gradient-to-br from-amber-400 to-orange-500 text-black shadow-[0_0_20px_rgba(245,158,11,0.3)]',
  2: 'bg-gradient-to-br from-gray-300 to-gray-400 text-black shadow-[0_0_15px_rgba(148,163,184,0.2)]',
  3: 'bg-gradient-to-br from-amber-700 to-amber-500 text-black shadow-[0_0_15px_rgba(217,119,6,0.2)]',
};

const MEDALS = { 1: '🥇', 2: '🥈', 3: '🥉' };

export default function LeaderboardTable({ players, source, lastUpdated, onRefresh }) {
  const [spinning, setSpinning] = useState(false);

  const handleRefresh = () => {
    setSpinning(true);
    onRefresh();
    setTimeout(() => setSpinning(false), 800);
  };

  return (
    <section className="glass-card overflow-hidden">
      {/* Header */}
      <div className="flex justify-between items-center px-6 py-5 border-b border-white/[0.06]">
        <h2 className="flex items-center gap-2.5 font-display text-sm font-semibold tracking-wider">
          <span className="text-lg">🏆</span> Top 10 Players
        </h2>
        <div className="flex items-center gap-2.5">
          <span
            className={`px-2.5 py-1 rounded-full text-[0.6rem] font-semibold uppercase tracking-wider border ${
              source === 'cache'
                ? 'bg-accent-green/15 text-accent-green border-accent-green/20'
                : 'bg-accent-purple/15 text-accent-purple border-accent-purple/20'
            }`}
          >
            {source === 'cache' ? 'CACHED' : 'DB'}
          </span>
          <button
            onClick={handleRefresh}
            className="flex items-center justify-center w-9 h-9 border border-white/[0.06] rounded-lg bg-transparent text-gray-400 hover:border-accent-cyan hover:text-accent-cyan hover:bg-accent-cyan/5 transition-all duration-200"
          >
            <svg
              className={`w-4 h-4 ${spinning ? 'animate-spin' : ''}`}
              viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
            >
              <polyline points="23 4 23 10 17 10" />
              <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10" />
            </svg>
          </button>
        </div>
      </div>

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="bg-white/[0.02]">
              <th className="px-6 py-3.5 text-center text-[0.65rem] font-semibold text-gray-500 uppercase tracking-[1.5px] border-b border-white/[0.06] w-20">
                Rank
              </th>
              <th className="px-6 py-3.5 text-left text-[0.65rem] font-semibold text-gray-500 uppercase tracking-[1.5px] border-b border-white/[0.06]">
                Player
              </th>
              <th className="px-6 py-3.5 text-right text-[0.65rem] font-semibold text-gray-500 uppercase tracking-[1.5px] border-b border-white/[0.06]">
                Total Score
              </th>
              <th className="px-6 py-3.5 text-center text-[0.65rem] font-semibold text-gray-500 uppercase tracking-[1.5px] border-b border-white/[0.06] w-24">
                Games
              </th>
            </tr>
          </thead>
          <tbody>
            {players.length === 0 ? (
              <tr>
                <td colSpan={4} className="px-6 py-16 text-center text-gray-500 text-sm">
                  No leaderboard data. Submit scores to get started!
                </td>
              </tr>
            ) : (
              players.map((player, idx) => {
                const rank = player.rank || idx + 1;
                const initials = (player.username || 'U').replace('user_', '').substring(0, 2).toUpperCase();

                return (
                  <tr
                    key={player.user_id}
                    className="border-b border-white/[0.04] last:border-b-0 hover:bg-dark-700/50 transition-colors duration-200 animate-row-flash"
                    style={{ animationDelay: `${idx * 50}ms` }}
                  >
                    {/* Rank Badge */}
                    <td className="px-6 py-4 text-center">
                      <span
                        className={`inline-flex items-center justify-center w-10 h-10 rounded-[10px] font-display text-sm font-bold ${
                          RANK_STYLES[rank] || 'bg-white/5 border border-white/[0.06] text-gray-400'
                        }`}
                      >
                        {MEDALS[rank] || rank}
                      </span>
                    </td>

                    {/* Player */}
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-[10px] flex items-center justify-center font-bold text-sm bg-gradient-to-br from-accent-cyan/15 to-accent-purple/15 border border-accent-cyan/10">
                          {initials}
                        </div>
                        <div>
                          <div className="font-semibold text-sm">{player.username || `User ${player.user_id}`}</div>
                          <div className="text-[0.7rem] text-gray-500">ID: {player.user_id}</div>
                        </div>
                      </div>
                    </td>

                    {/* Score */}
                    <td className="px-6 py-4 text-right">
                      <span className="font-display text-sm font-semibold text-accent-cyan">
                        {player.total_score?.toLocaleString() || '0'}
                      </span>
                    </td>

                    {/* Games */}
                    <td className="px-6 py-4 text-center text-sm text-gray-400">
                      {player.games_played?.toLocaleString() || '--'}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Footer */}
      <div className="px-6 py-3 text-[0.7rem] text-gray-500 border-t border-white/[0.06]">
        Last updated: {lastUpdated || '--'}
      </div>
    </section>
  );
}
