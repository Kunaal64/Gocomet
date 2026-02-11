/**
 * StatsBar Component
 * Displays key metrics: total players, highest score, live updates, latency
 */

export default function StatsBar({ stats }) {
  const items = [
    { value: stats.totalPlayers, label: 'Total Players' },
    { value: stats.totalGames, label: 'Total Games' },
    { value: stats.updateCount, label: 'Live Updates' },
    { value: `${stats.latency} ms`, label: 'API Latency' },
  ];

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
      {items.map((item) => (
        <div
          key={item.label}
          className="bg-black border border-gray-800 p-4 rounded flex flex-col items-center justify-center gap-1"
        >
          <span className="text-2xl font-mono font-bold text-white">
            {item.value ?? '--'}
          </span>
          <span className="text-xs text-gray-500 uppercase tracking-widest">
            {item.label}
          </span>
        </div>
      ))}
    </div>
  );
}
