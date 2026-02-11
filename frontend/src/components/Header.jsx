/**
 * Header Component
 * Displays logo, title, and connection status
 */

export default function Header({ isConnected }) {
  return (
    <header className="mb-6">
      <div className="flex flex-col sm:flex-row justify-between items-center gap-4 px-2 py-4 border-b border-gray-800">
        {/* Logo & Title */}
        <div className="flex items-center gap-3">
          <div className="flex items-center justify-center w-10 h-10 bg-white text-black rounded font-bold text-xl">
            GL
          </div>
          <div>
            <h1 className="font-bold text-xl tracking-wider text-white">
              LEADERBOARD
            </h1>
          </div>
        </div>

        {/* Status */}
        <div className="flex items-center gap-4 text-sm font-mono">
          <div className={`flex items-center gap-2 ${isConnected ? 'text-green-500' : 'text-red-500'}`}>
            <span className={`w-2 h-2 rounded-full ${isConnected ? 'bg-green-500' : 'bg-red-500'}`} />
            {isConnected ? 'Connected' : 'Disconnected'}
          </div>
        </div>
      </div>
    </header>
  );
}
