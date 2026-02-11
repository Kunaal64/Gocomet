import requests
import random
import time
import threading

API_BASE_URL = "http://localhost:8000/api/leaderboard"

# Statistics for monitoring
stats = {
    "submitted": 0,
    "fetched_top": 0,
    "fetched_rank": 0,
    "errors": 0
}

def submit_score(user_id):
    try:
        score = random.randint(100, 10000)
        resp = requests.post(f"{API_BASE_URL}/submit", json={"user_id": user_id, "score": score})
        if resp.status_code == 200:
            stats["submitted"] += 1
        else:
            stats["errors"] += 1
    except Exception as e:
        print(f"Error submitting score: {e}")
        stats["errors"] += 1

def get_top_players():
    try:
        resp = requests.get(f"{API_BASE_URL}/top")
        if resp.status_code == 200:
            stats["fetched_top"] += 1
        else:
            stats["errors"] += 1
    except Exception as e:
        print(f"Error fetching top players: {e}")
        stats["errors"] += 1

def get_user_rank(user_id):
    try:
        resp = requests.get(f"{API_BASE_URL}/rank/{user_id}")
        if resp.status_code == 200:
            stats["fetched_rank"] += 1
        else:
            # 404 is valid if user not found, but we count it as 'fetched'
            if resp.status_code == 404:
                stats["fetched_rank"] += 1
            else:
                stats["errors"] += 1
    except Exception as e:
        print(f"Error fetching rank: {e}")
        stats["errors"] += 1

def worker(worker_id):
    """
    Simulates a single user's behavior loop
    """
    print(f"Worker {worker_id} started")
    while True:
        # 80% chance to submit score (write heavy simulation)
        # 10% chance to check top players
        # 10% chance to check own rank
        action = random.random()
        
        # Random user ID from the seeded range (1 to 1,000,000)
        user_id = random.randint(1, 1000000)

        if action < 0.8:
            submit_score(user_id)
        elif action < 0.9:
            get_top_players()
        else:
            get_user_rank(user_id)
            
        # Random sleep between 100ms and 1s
        time.sleep(random.uniform(0.1, 1.0))

if __name__ == "__main__":
    print("Starting Load Test Simulation...")
    print(f"Target: {API_BASE_URL}")
    print("Press Ctrl+C to stop")

    # Spawn 10 concurrent threads to simulate load
    threads = []
    for i in range(10):
        t = threading.Thread(target=worker, args=(i,))
        t.daemon = True
        t.start()
        threads.append(t)

    try:
        start_time = time.time()
        while True:
            time.sleep(5)
            elapsed = int(time.time() - start_time)
            print(f"[{elapsed}s] Stats: Submitted={stats['submitted']}, Top={stats['fetched_top']}, Rank={stats['fetched_rank']}, Errors={stats['errors']}")
    except KeyboardInterrupt:
        print("\nStopping simulation...")
