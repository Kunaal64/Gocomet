/**
 * ActivityFeed Component
 * Shows real-time activity log of leaderboard events
 */

export default function ActivityFeed({ activities }) {
  return (
    <div className="border border-gray-800 rounded-lg p-6 bg-black h-full">
      <h3 className="text-sm font-bold text-gray-400 uppercase tracking-widest mb-4">
        Live Activity
      </h3>

      <div className="max-h-60 overflow-y-auto flex flex-col gap-2 pr-2 custom-scrollbar">
        {activities.length === 0 ? (
          <div className="text-center py-8 text-gray-600 text-xs font-mono">
            Waiting for updates...
          </div>
        ) : (
          activities.map((item, idx) => (
            <div
              key={idx}
              className="flex items-start gap-3 px-3 py-3 border-l-2 border-gray-700 bg-gray-900/20 text-xs text-gray-400 font-mono"
            >
              <span className="mt-0.5">{item.icon}</span>
              <div className="flex-1">
                 <span
                  className="block text-gray-300 [&>strong]:text-white [&>strong]:font-semibold"
                  dangerouslySetInnerHTML={{ __html: item.text }}
                />
                <span className="block mt-1 text-[0.6rem] text-gray-600">{item.time}</span>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
