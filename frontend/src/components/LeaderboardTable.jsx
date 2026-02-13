/**
 * LeaderboardTable Component
 * Displays top 10 players in a minimal table
 */

export default function LeaderboardTable({ players, source, lastUpdated, onRefresh }) {
  return (
    <section className="bg-black border border-gray-800 rounded overflow-hidden">
      {/* Header */}
      <div className="flex justify-between items-center px-5 py-4 border-b border-gray-800">
        <h2 className="text-sm font-medium text-white tracking-wide">
          Top 10 Players
        </h2>
        <div className="flex items-center gap-2">
          <span className={`px-2 py-0.5 rounded text-[0.65rem] font-medium uppercase border ${
            source === 'cache'
              ? 'text-green-500 border-green-800'
              : 'text-gray-400 border-gray-700'
          }`}>
            {source === 'cache' ? 'CACHED' : 'DB'}
          </span>
          <button
            onClick={onRefresh}
            className="px-2 py-1 text-xs text-gray-400 border border-gray-700 rounded hover:text-white hover:border-gray-500"
          >
            ↻
          </button>
        </div>
      </div>

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr>
              <th className="px-5 py-3 text-center text-xs font-medium text-gray-500 uppercase border-b border-gray-800 w-16">
                #
              </th>
              <th className="px-5 py-3 text-left text-xs font-medium text-gray-500 uppercase border-b border-gray-800">
                Player
              </th>
              <th className="px-5 py-3 text-right text-xs font-medium text-gray-500 uppercase border-b border-gray-800">
                Score
              </th>
              <th className="px-5 py-3 text-center text-xs font-medium text-gray-500 uppercase border-b border-gray-800 w-20">
                Games
              </th>
            </tr>
          </thead>
          <tbody>
            {players.length === 0 ? (
              <tr>
                <td colSpan={4} className="px-5 py-12 text-center text-gray-600 text-sm">
                  No data yet. Submit scores to begin.
                </td>
              </tr>
            ) : (
              players.map((player, idx) => {
                const rank = player.rank || idx + 1;

                return (
                  <tr
                    key={player.user_id}
                    className="border-b border-gray-800/50 last:border-b-0 hover:bg-gray-900/50"
                  >
                    <td className="px-5 py-3 text-center text-sm font-mono text-gray-400">
                      {rank}
                    </td>
                    <td className="px-5 py-3">
                      <div className="text-sm text-white">{player.username || `User ${player.user_id}`}</div>
                      <div className="text-xs text-gray-600">ID: {player.user_id}</div>
                    </td>
                    <td className="px-5 py-3 text-right text-sm font-mono text-white">
                      {player.total_score?.toLocaleString() || '0'}
                    </td>
                    <td className="px-5 py-3 text-center text-sm text-gray-500">
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
      <div className="px-5 py-2.5 text-xs text-gray-600 border-t border-gray-800">
        Updated: {lastUpdated || '--'}
      </div>
    </section>
  );
}
