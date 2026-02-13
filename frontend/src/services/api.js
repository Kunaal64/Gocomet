/**
 * API service for leaderboard endpoints
 */

const isDev = import.meta.env.DEV;
const BACKEND_URL = import.meta.env.VITE_API_URL || (isDev ? 'http://127.0.0.1:8000' : '');
const API_BASE = `${BACKEND_URL}/api/leaderboard`;

export async function fetchTopPlayers() {
    const start = performance.now();
    const res = await fetch(`${API_BASE}/top`);
    const elapsed = Math.round(performance.now() - start);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    return { ...data, latency: elapsed };
}

export async function fetchPlayerRank(userId) {
    const res = await fetch(`${API_BASE}/rank/${userId}`);
    const data = await res.json();
    if (!res.ok && !data.error) throw new Error(`HTTP ${res.status}`);
    return data;
}

export async function submitScore(userId, score) {
    const res = await fetch(`${API_BASE}/submit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_id: userId, score }),
    });
    const data = await res.json();
    if (!res.ok && !data.error) throw new Error(`HTTP ${res.status}`);
    return data;
}
