"""
Rebuild ELO state from CSV data using normalized team names.
Ensures ELO keys match what the ML API's normalize() produces.
"""
import sys, json
from pathlib import Path
sys.path.insert(0, str(Path(__file__).parent.parent))

import numpy as np
import pandas as pd
from collections import defaultdict, deque
from services.team_names import normalize


def main():
    csv_path = Path("data/raw/football-data-uk/all_matches.csv")
    if not csv_path.exists():
        print("CSV data not found!")
        return

    df = pd.read_csv(csv_path)
    df["utc_date"] = pd.to_datetime(df["utc_date"], errors="coerce")
    df = df.dropna(subset=["utc_date"])
    df["home_score"] = pd.to_numeric(df["home_score"], errors="coerce")
    df["away_score"] = pd.to_numeric(df["away_score"], errors="coerce")
    df = df.dropna(subset=["home_score", "away_score"])
    df = df.sort_values("utc_date").reset_index(drop=True)

    print(f"Processing {len(df)} matches...")

    team_history = defaultdict(lambda: deque(maxlen=50))
    elo = defaultdict(lambda: 1500.0)
    k_factor = 32.0

    for i in range(len(df)):
        row = df.iloc[i]
        home = normalize(str(row["home_team_name"]))
        away = normalize(str(row["away_team_name"]))
        home_goals = int(row["home_score"])
        away_goals = int(row["away_score"])

        if home_goals > away_goals:
            home_result, away_result = 1.0, 0.0
        elif home_goals == away_goals:
            home_result, away_result = 0.5, 0.5
        else:
            home_result, away_result = 0.0, 1.0

        expected_home = 1.0 / (1.0 + 10.0 ** ((elo[away] - elo[home]) / 400.0))
        expected_away = 1.0 - expected_home
        goal_diff = abs(home_goals - away_goals)
        margin = np.log(max(goal_diff, 1) + 1)

        elo[home] += k_factor * margin * (home_result - expected_home)
        elo[away] += k_factor * margin * (away_result - expected_away)

        team_history[home].append((home, away, home_goals, away_goals))

    state_path = Path("models/registry/football_ensemble/elo_state.json")
    with open(state_path, "w") as f:
        json.dump(dict(elo), f, indent=2)

    print(f"\nSaved {len(elo)} teams to {state_path}")
    top5 = sorted(elo.items(), key=lambda x: -x[1])[:10]
    print("\nTop 10 ELO ratings:")
    for name, rating in top5:
        print(f"  {name}: {rating:.0f}")

    # Verify key mappings work
    test_pairs = [
        ("Manchester City FC", "Man City"),
        ("Paris Saint-Germain FC", "PSG"),
        ("Paris SG", "PSG"),
        ("FC Bayern München", "Bayern Munich"),
        ("Bayern Munich", "Bayern Munich"),
        ("FC Internazionale Milano", "Inter"),
        ("Inter Milan", "Inter"),
    ]
    print("\nNormalization verification:")
    for raw, expected in test_pairs:
        result = normalize(raw)
        status = "✓" if result == expected else "✗"
        in_elo = "IN ELO" if result in elo else "MISSING"
        print(f"  {status} '{raw}' -> '{result}' ({in_elo})")


if __name__ == "__main__":
    main()
