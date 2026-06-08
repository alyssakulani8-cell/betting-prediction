import pandas as pd
import numpy as np
from typing import Dict, List

def compute_form_scores(recent_results: List[str]) -> float:
    weights = {"W": 1.0, "D": 0.5, "L": 0.0}
    scores = [weights.get(r, 0.0) for r in recent_results[-5:]]
    return np.mean(scores) if scores else 0.5

def calculate_features(match_data: Dict) -> pd.DataFrame:
    features = {
        "home_win_rate": match_data.get("home_win_rate", 0.5),
        "away_win_rate": match_data.get("away_win_rate", 0.5),
        "home_avg_goals": match_data.get("home_avg_goals", 1.5),
        "away_avg_goals": match_data.get("away_avg_goals", 1.5),
        "home_avg_conceded": match_data.get("home_avg_conceded", 1.5),
        "away_avg_conceded": match_data.get("away_avg_conceded", 1.5),
        "home_xg": match_data.get("home_xg", 1.5),
        "away_xg": match_data.get("away_xg", 1.5),
        "home_form_score": compute_form_scores(match_data.get("home_form", [])),
        "away_form_score": compute_form_scores(match_data.get("away_form", [])),
        "h2h_home_wins": match_data.get("h2h_home_wins", 0),
        "h2h_away_wins": match_data.get("h2h_away_wins", 0),
        "h2h_draws": match_data.get("h2h_draws", 0),
    }
    return pd.DataFrame([features])

def normalize_features(df: pd.DataFrame, means: Dict = None, stds: Dict = None):
    if means is None or stds is None:
        means = df.mean()
        stds = df.std().replace(0, 1)
    normalized = (df - means) / stds
    return normalized, means, stds
