"""Test ModelService end-to-end with real team data from backend."""
import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).parent.parent))

import json
import sqlite3
import numpy as np
import pandas as pd
from collections import defaultdict
from datetime import datetime
from config import config

# Find teams with the most finished matches
db_path = Path(config.backend_db_path)
print(f"Backend DB: {db_path.resolve()}")
conn = sqlite3.connect(str(db_path))

# Find football competitions with the most finished matches
comp_query = """
SELECT l.name AS competition, COUNT(*) as cnt
FROM matches m
JOIN leagues l ON l.id = m.league_id
WHERE m.status = 'FINISHED' AND l.sport = 'football'
GROUP BY l.name ORDER BY cnt DESC LIMIT 5
"""
comps = pd.read_sql_query(comp_query, conn)
print("Competitions with most finished matches:")
for _, r in comps.iterrows():
    print(f"  {r['competition']}: {r['cnt']}")

# Find teams with most matches
team_query = """
SELECT t.name, COUNT(*) as cnt
FROM matches m
JOIN teams t ON t.id IN (m.home_team_id, m.away_team_id)
JOIN leagues l ON l.id = m.league_id
WHERE m.status = 'FINISHED' AND l.sport = 'football'
GROUP BY t.name ORDER BY cnt DESC LIMIT 10
"""
teams = pd.read_sql_query(team_query, conn)
print("\nTeams with most finished matches:")
for _, r in teams.iterrows():
    print(f"  {r['name']}: {r['cnt']}")

# Pick two teams and get their history
top2 = teams.head(2)
team1_name, team2_name = top2["name"].values[0], top2["name"].values[1]
print(f"\nUsing: {team1_name} vs {team2_name}")

query = """
SELECT m.id, m.home_team_id, m.away_team_id,
       m.home_score, m.away_score, m.kickoff,
       ht.name AS home_team_name, at.name AS away_team_name
FROM matches m
LEFT JOIN teams ht ON ht.id = m.home_team_id
LEFT JOIN teams at ON at.id = m.away_team_id
WHERE (ht.name = ? OR at.name = ? OR ht.name = ? OR at.name = ?)
  AND m.status = 'FINISHED'
  AND m.home_score IS NOT NULL
ORDER BY m.kickoff ASC
"""
history = pd.read_sql_query(query, conn, params=(team1_name, team1_name, team2_name, team2_name))
conn.close()

print(f"Found {len(history)} historical matches for {team1_name}/{team2_name}")

if len(history) > 0:
    from services.feature_engineering import FootballFeatureEngineer
    engineer = FootballFeatureEngineer()

    history["utc_date"] = pd.to_datetime(history["kickoff"] / 1000, unit="s", utc=True)
    history["target"] = np.where(
        history["home_score"] > history["away_score"], 0,
        np.where(history["home_score"] == history["away_score"], 1, 2)
    )

    new_row = pd.DataFrame([{
        "home_team_id": str(history["home_team_id"].iloc[0]),
        "away_team_id": str(history["away_team_id"].iloc[0]),
        "home_team_name": team1_name,
        "away_team_name": team2_name,
        "utc_date": pd.Timestamp.now(tz="UTC"),
        "target": -1,
    }])

    combined = pd.concat([history, new_row], ignore_index=True)
    feature_df = engineer.build_features(combined, is_training=False)
    last_row = feature_df.iloc[-1:]

    from services.model_service import model_service
    ok = model_service.load_champion("football")
    print(f"Champion loaded: {ok}")

    if ok:
        avail = [c for c in model_service._feature_cols["football"] if c in last_row.columns]
        X = last_row[avail].values
        print(f"X shape: {X.shape}, features: {avail}")

        model = model_service._models["football"]
        probas = model.predict_proba(X)[0]
        labels = ["Home Win", "Draw", "Away Win"]
        pred = int(probas.argmax())
        print(f"\n{team1_name} vs {team2_name} prediction:")
        print(f"  Home Win: {probas[0]:.3f}")
        print(f"  Draw:     {probas[1]:.3f}")
        print(f"  Away Win: {probas[2]:.3f}")
        print(f"  Outcome:  {labels[pred]} (conf={probas.max():.3f})")
        print(f"  Features:  elo_home={last_row['elo_home'].values[0]:.0f}, elo_away={last_row['elo_away'].values[0]:.0f}")
        print(f"             home_win_rate_10={last_row['home_win_rate_10'].values[0]:.3f}, away_win_rate_10={last_row['away_win_rate_10'].values[0]:.3f}")
    else:
        print("FAILED to load champion model")

print("\nALL OK")
