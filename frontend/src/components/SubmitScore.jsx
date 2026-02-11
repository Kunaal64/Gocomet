/**
 * SubmitScore Component
 * Form to submit a score for a user
 */
import { useState } from 'react';
import { submitScore as submitScoreApi } from '../services/api';

export default function SubmitScore({ onScoreSubmitted }) {
  const [userId, setUserId] = useState('');
  const [score, setScore] = useState('');
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async () => {
    const uid = parseInt(userId, 10);
    const sc = parseInt(score, 10);
    if (!uid || uid <= 0) {
      setResult({ success: false, error: 'Enter a valid User ID' });
      return;
    }
    if (isNaN(sc) || sc < 0) {
      setResult({ success: false, error: 'Enter a valid score' });
      return;
    }

    setLoading(true);
    try {
      const data = await submitScoreApi(uid, sc);
      setResult(data);
      if (data.success) {
        onScoreSubmitted?.({ userId: uid, score: sc, totalScore: data.data?.total_score });
      }
    } catch {
      setResult({ success: false, error: 'Failed to connect to server' });
    } finally {
      setLoading(false);
      setTimeout(() => setResult(null), 5000);
    }
  };

  return (
    <div className="border border-gray-800 rounded-lg p-6 bg-black mb-6">
      <h3 className="text-sm font-bold text-gray-400 uppercase tracking-widest mb-4">
        Submit Score
      </h3>

      <div className="flex flex-col gap-4">
        <div className="flex flex-col gap-1">
          <label className="text-xs text-gray-500 uppercase font-mono">User ID</label>
          <input
            type="number"
            value={userId}
            onChange={(e) => setUserId(e.target.value)}
            placeholder="ID"
            min="1"
            className="bg-gray-900 border border-gray-700 rounded px-3 py-2 text-white text-sm focus:outline-none focus:border-gray-500 transition-colors"
          />
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs text-gray-500 uppercase font-mono">Score</label>
          <input
            type="number"
            value={score}
            onChange={(e) => setScore(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSubmit()}
            placeholder="0 - 10000"
            min="0"
            max="1000000"
            className="bg-gray-900 border border-gray-700 rounded px-3 py-2 text-white text-sm focus:outline-none focus:border-gray-500 transition-colors"
          />
        </div>
        <button 
          onClick={handleSubmit} 
          disabled={loading} 
          className="mt-2 w-full py-2 bg-white text-black font-bold uppercase text-xs tracking-wider rounded hover:bg-gray-200 transition-colors disabled:opacity-50"
        >
          {loading ? 'Submitting...' : 'Submit Score'}
        </button>
      </div>

      {/* Result */}
      {result && (
        <div
          className={`mt-4 p-3 rounded border text-xs font-mono ${
            result.success
              ? 'bg-green-900/10 border-green-900/30 text-green-500'
              : 'bg-red-900/10 border-red-900/30 text-red-500'
          }`}
        >
          {result.success
            ? `SCORE SUBMITTED. TOTAL: ${result.data?.total_score?.toLocaleString() ?? 'N/A'}`
            : `ERROR: ${result.error || 'Failed'}`}
        </div>
      )}
    </div>
  );
}
