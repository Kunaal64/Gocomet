/**
 * App Component - Root of the Gaming Leaderboard UI
 *
 * Manages global state:
 * - WebSocket connection for live updates
 * - Leaderboard data fetching and caching
 * - Activity feed events
 * - Stats aggregation
 */
import { useState, useEffect, useCallback, useRef } from 'react';
import Header from './components/Header';
import StatsBar from './components/StatsBar';
import LeaderboardTable from './components/LeaderboardTable';
import RankLookup from './components/RankLookup';
import SubmitScore from './components/SubmitScore';
import ActivityFeed from './components/ActivityFeed';
import { useWebSocket } from './hooks/useWebSocket';
import { fetchTopPlayers } from './services/api';

const MAX_ACTIVITIES = 20;
const POLL_INTERVAL = 15000;

export default function App() {
  const [players, setPlayers] = useState([]);
  const [globalStats, setGlobalStats] = useState({ total_players: 0, total_games: 0 });
  const [source, setSource] = useState('--');
  const [lastUpdated, setLastUpdated] = useState('');
  const [activities, setActivities] = useState([]);
  const [updateCount, setUpdateCount] = useState(0);
  const [latency, setLatency] = useState(0);
  const pollTimerRef = useRef(null);

  // ─── Fetch leaderboard ──────────────────────────────
  const refreshLeaderboard = useCallback(async () => {
    try {
      const data = await fetchTopPlayers();
      setPlayers(data.data || []);
      if (data.stats) {
        setGlobalStats(data.stats);
      }
      setSource(data.source || 'database');
      setLatency(data.latency); // Store raw number
      setLastUpdated(new Date().toLocaleTimeString());
    } catch (err) {
      console.error('Fetch error:', err);
      setLatency(null);
    }
  }, []);

  // ─── Add activity item ──────────────────────────────
  const addActivity = useCallback((icon, text) => {
    const time = new Date().toLocaleTimeString();
    setActivities((prev) => [{ icon, text, time }, ...prev].slice(0, MAX_ACTIVITIES));
  }, []);

  // ─── WebSocket handler ──────────────────────────────
  const handleWsMessage = useCallback(
    (message) => {
      if (message.type === 'leaderboard_update' && message.data) {
        setUpdateCount((c) => c + 1);
        addActivity(
          '🎯',
          `<strong>User #${message.data.userId}</strong> scored ${
            message.data.newScore?.toLocaleString() ?? '???'
          } points`
        );
        refreshLeaderboard();
      }
    },
    [addActivity, refreshLeaderboard]
  );

  const { isConnected } = useWebSocket(handleWsMessage);

  // ─── Score submitted callback ───────────────────────
  const handleScoreSubmitted = useCallback(
    ({ userId, score }) => {
      addActivity('🎮', `<strong>You</strong> submitted ${score.toLocaleString()} pts for User #${userId}`);
      setTimeout(refreshLeaderboard, 500);
    },
    [addActivity, refreshLeaderboard]
  );

  // ─── Initial load + polling ─────────────────────────
  useEffect(() => {
    refreshLeaderboard();
    pollTimerRef.current = setInterval(refreshLeaderboard, POLL_INTERVAL);
    return () => clearInterval(pollTimerRef.current);
  }, [refreshLeaderboard]);

  // ─── Compute stats ─────────────────────────────────
  const stats = {
    totalPlayers: globalStats.total_players > 0 ? globalStats.total_players.toLocaleString() : '--',
    totalGames: globalStats.total_games > 0 ? globalStats.total_games.toLocaleString() : '--',
    updateCount: updateCount.toLocaleString(),
    latency,
  };

  return (
    <>
      {/* Main content - Pure Black Theme */}
      <div className="min-h-screen bg-black text-gray-200 selection:bg-white selection:text-black">
        <div className="max-w-[1280px] mx-auto px-4 sm:px-6 py-8">
        <Header isConnected={isConnected} />
        <StatsBar stats={stats} />

        <div className="grid grid-cols-1 lg:grid-cols-[1fr_380px] gap-6 mb-6">
          {/* Leaderboard */}
          <LeaderboardTable
            players={players}
            source={source}
            lastUpdated={lastUpdated}
            onRefresh={refreshLeaderboard}
          />

          {/* Sidebar */}
          <aside className="flex flex-col gap-5">
            <RankLookup />
            <SubmitScore onScoreSubmitted={handleScoreSubmitted} />
            <ActivityFeed activities={activities} />
          </aside>
        </div>

        {/* Footer */}
        <footer className="text-center py-5 text-[0.7rem] text-gray-500 border-t border-white/[0.06]">
          Gaming Leaderboard System &bull; Node.js &bull; PostgreSQL &bull; Redis &bull; React &bull; Tailwind CSS
        </footer>
      </div>
      </div>
    </>
  );
}
