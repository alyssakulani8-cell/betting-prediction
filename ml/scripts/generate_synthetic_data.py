"""
Generate realistic synthetic football match data for training.
Creates teams with strength ratings and simulates matches with:
- Stronger teams win more often
- Home advantage (~60% win rate for evenly matched)
- Draw probability based on team parity
- Multiple seasons of data
- Realistic score distributions
"""

import sys
from pathlib import Path
sys.path.append(str(Path(__file__).parent.parent))

import numpy as np
import pandas as pd
from datetime import datetime, timedelta

np.random.seed(42)

TEAMS = [
    ("mci", "Manchester City", 95), ("ars", "Arsenal", 90), ("liv", "Liverpool", 88),
    ("che", "Chelsea", 82), ("mun", "Manchester United", 80), ("tot", "Tottenham", 78),
    ("new", "Newcastle", 80), ("avl", "Aston Villa", 76),
    ("bar", "Barcelona", 92), ("rma", "Real Madrid", 94), ("atm", "Atletico Madrid", 85),
    ("sev", "Sevilla", 78),
    ("juv", "Juventus", 84), ("acm", "AC Milan", 83), ("int", "Inter Milan", 86),
    ("nap", "Napoli", 82),
    ("bay", "Bayern Munich", 93), ("bvb", "Borussia Dortmund", 82), ("rbl", "RB Leipzig", 80),
    ("psg", "Paris Saint-Germain", 90), ("mon", "AS Monaco", 78),
]

LEAGUES = {
    "PL": "Premier League", "PD": "La Liga", "SA": "Serie A",
    "BL": "Bundesliga", "FL": "Ligue 1",
}

def simulate_score(home_strength: float, away_strength: float) -> tuple[int, int]:
    home_advantage = 0.3
    home_lambda = max(0.1, home_strength / 75 + home_advantage)
    away_lambda = max(0.1, away_strength / 75)
    home_goals = np.random.poisson(home_lambda)
    away_goals = np.random.poisson(away_lambda)
    return home_goals, away_goals

def simulate_over_under_prob(home_strength: float, away_strength: float) -> tuple[float, float]:
    home_lambda = max(0.1, home_strength / 75 + 0.3)
    away_lambda = max(0.1, away_strength / 75)
    total_lambda = home_lambda + away_lambda
    over_2_5 = 1 - np.exp(-total_lambda) * (1 + total_lambda + total_lambda**2 / 2 + total_lambda**3 / 6)
    over_2_5 = np.clip(over_2_5, 0.05, 0.95)
    return over_2_5, 1 - over_2_5

def simulate_btts_prob(home_strength: float, away_strength: float) -> tuple[float, float]:
    home_lambda = max(0.1, home_strength / 75 + 0.3)
    away_lambda = max(0.1, away_strength / 75)
    p_both = (1 - np.exp(-home_lambda)) * (1 - np.exp(-away_lambda))
    p_both = np.clip(p_both, 0.05, 0.95)
    return p_both, 1 - p_both

def generate_dataset(seasons: list[str]) -> pd.DataFrame:
    rows = []
    match_id = 1

    for season in seasons:
        year = int(season[:4])
        season_start = datetime(year, 8, 1)
        season_end = datetime(year + 1, 5, 31)

        for league_code, league_name in LEAGUES.items():
            league_teams = [t for t in TEAMS]
            np.random.shuffle(league_teams)

            num_fixtures = len(league_teams) * 2 - 2
            for fixture_week in range(num_fixtures):
                for i in range(0, len(league_teams), 2):
                    if i + 1 >= len(league_teams):
                        continue
                    home = league_teams[i]
                    away = league_teams[i + 1]

                    days_offset = fixture_week * 7 + np.random.randint(0, 3)
                    match_date = season_start + timedelta(days=days_offset)
                    if match_date > season_end:
                        continue

                    home_goals, away_goals = simulate_score(home[2], away[2])

                    row = {
                        "match_id": str(match_id),
                        "competition": league_name,
                        "season": season,
                        "matchday": fixture_week + 1,
                        "status": "FINISHED",
                        "utc_date": match_date.isoformat(),
                        "home_team_id": home[0],
                        "home_team_name": home[1],
                        "home_team_short": home[0].upper(),
                        "away_team_id": away[0],
                        "away_team_name": away[1],
                        "away_team_short": away[0].upper(),
                        "home_score": home_goals,
                        "away_score": away_goals,
                        "half_time_home": max(0, home_goals - np.random.poisson(0.3)),
                        "half_time_away": max(0, away_goals - np.random.poisson(0.3)),
                        "extra_time_home": None,
                        "extra_time_away": None,
                        "penalties_home": None,
                        "penalties_away": None,
                        "winner": "HOME_TEAM" if home_goals > away_goals else ("AWAY_TEAM" if away_goals > home_goals else "DRAW"),
                        "duration": "REGULAR",
                    }
                    rows.append(row)
                    match_id += 1

                league_teams = [league_teams[-1]] + league_teams[:-1]

    df = pd.DataFrame(rows)
    print(f"Generated {len(df)} matches across {len(seasons)} seasons")
    print(f"Home win rate: {(df['home_score'] > df['away_score']).mean():.3f}")
    print(f"Draw rate: {(df['home_score'] == df['away_score']).mean():.3f}")
    print(f"Away win rate: {(df['home_score'] < df['away_score']).mean():.3f}")
    print(f"Avg goals per match: {df['home_score'].mean() + df['away_score'].mean():.2f}")
    return df

if __name__ == "__main__":
    df = generate_dataset(["2022", "2023", "2024", "2025"])
    output_path = Path(__file__).parent.parent / "data" / "synthetic_football.csv"
    output_path.parent.mkdir(parents=True, exist_ok=True)
    df.to_csv(output_path, index=False)
    print(f"Saved to {output_path}")
