import sqlite3
import pandas as pd

conn = sqlite3.connect("../backend/prisma/betting.db")

# Get distinct team names from matches that have scores
query = """
    SELECT DISTINCT ht.name AS home_team, at.name AS away_team
    FROM matches m
    LEFT JOIN teams ht ON ht.id = m.home_team_id
    LEFT JOIN teams at ON at.id = m.away_team_id
    WHERE m.status = 'FINISHED' AND m.home_score IS NOT NULL AND m.away_score IS NOT NULL
"""
cur = conn.execute(query)
rows = cur.fetchall()
conn.close()

backend_teams = set()
for r in rows:
    backend_teams.add(r[0])
    backend_teams.add(r[1])
backend_teams = sorted(backend_teams, key=lambda x: x or "")

csv = pd.read_csv("data/raw/football-data-uk/all_matches.csv")
csv_teams = set(csv["home_team_name"].unique()) | set(csv["away_team_name"].unique())

print(f"Backend teams (finished matches): {len(backend_teams)}")
print(f"CSV teams: {len(csv_teams)}")
print()

# Find mismatches
for bt in backend_teams:
    if bt is None:
        continue
    bt_lower = bt.lower()
    exact_match = any(ct.lower() == bt_lower for ct in csv_teams)
    if exact_match:
        continue

    # Try substring matching
    found = False
    for ct in sorted(csv_teams):
        ct_lower = ct.lower()
        # Check if one contains the other
        if ct_lower in bt_lower or bt_lower in ct_lower:
            print(f"NEAR: backend='{bt}' ~ csv='{ct}'")
            found = True
            break
    if not found:
        # More lenient: check if any word overlaps
        bt_words = set(bt_lower.split())
        for ct in sorted(csv_teams):
            ct_words = set(ct.lower().split())
            if bt_words & ct_words:
                print(f"WORD: backend='{bt}' ~ csv='{ct}'")
                found = True
                break
    if not found:
        print(f"MISS: backend='{bt}' has NO match in CSV")
