/**
 * RankLookup Component
 * Search for a player's rank by user ID
 */
import { useState } from 'react';
import { fetchPlayerRank } from '../services/api';

export default function RankLookup() {
  const [userId, setUserId] = useState('');
  const [result, setResult] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSearch = async () => {
    const id = parseInt(userId, 10);
    if (!id || id <= 0) return;

    setLoading(true);
    setError('');
    setResult(null);

    try {
      const data = await fetchPlayerRank(id);
      if (data.success) {
        setResult(data.data);
      } else {
        setError(data.error || 'Player not found');
      }
    } catch {
      setError('Failed to connect to server');
    } finally {
      setLoading(false);
    }
  };

  const percentile =
    result?.rank && result?.total_players
      ? ((1 - result.rank / result.total_players) * 100).toFixed(1)
      : null;

  return (
    <div className="border border-gray-800 rounded-lg p-6 bg-black">
      <h3 className="text-sm font-bold text-gray-400 uppercase tracking-widest mb-4">
        Lookup Rank
      </h3>

      {/* Search */}
      <div className="flex gap-2">
        <input
          type="number"
          value={userId}
          onChange={(e) => setUserId(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
          placeholder="User ID..."
          min="1"
          className="flex-1 bg-gray-900 border border-gray-700 rounded px-3 py-2 text-white focus:outline-none focus:border-gray-500 transition-colors"
        />
        <button
          onClick={handleSearch}
          disabled={loading}
          className="px-4 py-2 bg-white text-black font-bold rounded hover:bg-gray-200 transition-colors disabled:opacity-50"
        >
          {loading ? '...' : '→'}
        </button>
      </div>

      {/* Result */}
      {result && (
        <div className="mt-4 p-4 border border-gray-800 rounded bg-gray-900/30">
          <div className="flex justify-between items-center mb-3 border-b border-gray-800 pb-2">
            <span className="text-gray-400 text-xs">#{result.user_id}</span>
            <span className="text-green-500 font-bold">RANK #{result.rank}</span>
          </div>
          <div className="grid grid-cols-2 gap-4 text-center">
            <div>
              <div className="text-xl font-bold text-white">{result.total_score}</div>
              <div className="text-xs text-gray-500 uppercase">Score</div>
            </div>
            <div>
              <div className="text-xl font-bold text-white">{percentile ? `${percentile}%` : '--'}</div>
              <div className="text-xs text-gray-500 uppercase">Percentile</div>
            </div>
          </div>
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="mt-4 text-red-500 text-sm text-center border border-red-900/30 bg-red-900/10 p-2 rounded">
          {error}
        </div>
      )}
    </div>
  );
}
