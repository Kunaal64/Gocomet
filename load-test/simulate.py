"""
Gaming Leaderboard - Load Simulation Script

Simulates real user behavior by continuously:
- Submitting random scores
- Fetching the top leaderboard
- Looking up individual player ranks

Logs response times for performance analysis.

Usage:
    python simulate.py
    python simulate.py --users 100000 --interval 0.5
"""

import requests
import random
import time
import sys
import argparse
from datetime import datetime

API_BASE_URL = "http://localhost:8000/api/leaderboard"

# Track performance metrics
metrics = {
    "submit": {"count": 0, "total_time": 0, "errors": 0},
    "top": {"count": 0, "total_time": 0, "errors": 0},
    "rank": {"count": 0, "total_time": 0, "errors": 0},
}


def submit_score(user_id):
    """Submit a random score for a user."""
    score = random.randint(100, 10000)
    try:
        start = time.time()
        response = requests.post(
            f"{API_BASE_URL}/submit",
            json={"user_id": user_id, "score": score},
            timeout=10,
        )
        elapsed = (time.time() - start) * 1000  # ms

        metrics["submit"]["count"] += 1
        metrics["submit"]["total_time"] += elapsed

        if response.status_code == 201:
            print(f"  [SUBMIT] user={user_id} score={score} -> {elapsed:.0f}ms")
        else:
            metrics["submit"]["errors"] += 1
            print(f"  [SUBMIT ERROR] {response.status_code}: {response.text[:100]}")
    except requests.exceptions.RequestException as e:
        metrics["submit"]["errors"] += 1
        print(f"  [SUBMIT FAILED] {str(e)[:80]}")


def get_top_players():
    """Fetch the top 10 players."""
    try:
        start = time.time()
        response = requests.get(f"{API_BASE_URL}/top", timeout=10)
        elapsed = (time.time() - start) * 1000

        metrics["top"]["count"] += 1
        metrics["top"]["total_time"] += elapsed

        if response.status_code == 200:
            data = response.json()
            source = data.get("source", "unknown")
            players = data.get("data", [])
            if players:
                top_player = players[0]
                print(
                    f"  [TOP]    #1: {top_player.get('username', 'N/A')} "
                    f"(score: {top_player.get('total_score', 0)}) "
                    f"[{source}] -> {elapsed:.0f}ms"
                )
            return data
        else:
            metrics["top"]["errors"] += 1
            print(f"  [TOP ERROR] {response.status_code}")
    except requests.exceptions.RequestException as e:
        metrics["top"]["errors"] += 1
        print(f"  [TOP FAILED] {str(e)[:80]}")
    return None


def get_user_rank(user_id):
    """Fetch a specific user's rank."""
    try:
        start = time.time()
        response = requests.get(f"{API_BASE_URL}/rank/{user_id}", timeout=10)
        elapsed = (time.time() - start) * 1000

        metrics["rank"]["count"] += 1
        metrics["rank"]["total_time"] += elapsed

        if response.status_code == 200:
            data = response.json()
            rank_data = data.get("data", {})
            print(
                f"  [RANK]   user={user_id} rank=#{rank_data.get('rank', '?')} "
                f"score={rank_data.get('total_score', 0)} "
                f"[{data.get('source', 'unknown')}] -> {elapsed:.0f}ms"
            )
            return data
        elif response.status_code == 404:
            print(f"  [RANK]   user={user_id} not found -> {elapsed:.0f}ms")
        else:
            metrics["rank"]["errors"] += 1
    except requests.exceptions.RequestException as e:
        metrics["rank"]["errors"] += 1
        print(f"  [RANK FAILED] {str(e)[:80]}")
    return None


def print_metrics():
    """Print aggregated performance metrics."""
    print("\n" + "=" * 60)
    print("  PERFORMANCE METRICS")
    print("=" * 60)
    for endpoint, data in metrics.items():
        count = data["count"]
        if count > 0:
            avg_time = data["total_time"] / count
            print(
                f"  {endpoint.upper():8s} | "
                f"Requests: {count:5d} | "
                f"Avg: {avg_time:7.1f}ms | "
                f"Errors: {data['errors']}"
            )
    print("=" * 60 + "\n")


def main():
    parser = argparse.ArgumentParser(description="Leaderboard Load Simulator")
    parser.add_argument("--users", type=int, default=1000000, help="Max user ID range")
    parser.add_argument(
        "--interval", type=float, default=1.0, help="Base interval between requests (seconds)"
    )
    parser.add_argument(
        "--iterations", type=int, default=0, help="Number of iterations (0 = infinite)"
    )
    args = parser.parse_args()

    print("═══════════════════════════════════════════════")
    print("  Gaming Leaderboard - Load Simulator")
    print(f"  Target: {API_BASE_URL}")
    print(f"  User range: 1 - {args.users}")
    print(f"  Interval: {args.interval}s")
    print("  Press Ctrl+C to stop")
    print("═══════════════════════════════════════════════\n")

    iteration = 0
    try:
        while True:
            iteration += 1
            user_id = random.randint(1, args.users)
            timestamp = datetime.now().strftime("%H:%M:%S")
            print(f"\n[{timestamp}] Iteration #{iteration} (user_id={user_id})")

            # 1. Submit a score
            submit_score(user_id)

            # 2. Get top players
            get_top_players()

            # 3. Get this user's rank
            get_user_rank(user_id)

            # Print metrics every 10 iterations
            if iteration % 10 == 0:
                print_metrics()

            # Check iteration limit
            if args.iterations > 0 and iteration >= args.iterations:
                print(f"\nCompleted {args.iterations} iterations.")
                break

            # Simulate real user interaction delay
            sleep_time = random.uniform(args.interval * 0.5, args.interval * 2)
            time.sleep(sleep_time)

    except KeyboardInterrupt:
        print("\n\nStopping simulation...")
        print_metrics()
        sys.exit(0)


if __name__ == "__main__":
    main()
