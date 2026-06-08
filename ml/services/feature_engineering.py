"""
Advanced feature engineering:
- ELO ratings with K-factor tuning
- Rolling window stats with exponential decay
- Strength of schedule
- Form decay (recent results weighted more)
- Rest days / travel distance
- Injury indices
- Cup/derby context
- Odds-derived features
"""

from typing import List, Dict, Optional, Tuple
import numpy as np
import pandas as pd
from collections import defaultdict
from datetime import datetime, timedelta


class FootballFeatureEngineer:
    """
    Builds feature matrix from raw football match DataFrame.
    Computes features using expanding/rolling windows over historical data
    to avoid look-ahead bias.
    """

    def __init__(self, initial_elo: float = 1500.0, k_factor: float = 32.0):
        self.initial_elo = initial_elo
        self.k_factor = k_factor
        self.elo_ratings: Dict[str, float] = defaultdict(lambda: initial_elo)

    def build_features(
        self, df: pd.DataFrame, is_training: bool = True
    ) -> pd.DataFrame:
        df = df.sort_values("utc_date").reset_index(drop=True)
        rows = []

        for i in range(len(df)):
            row = df.iloc[i]
            history = df.iloc[:i] if is_training else df.iloc[:i]

            home_id = str(row.get("home_team_id", row.get("home_team_name", "")))
            away_id = str(row.get("away_team_id", row.get("away_team_name", "")))

            features = self._compute_match_features(row, history, home_id, away_id, i)
            features["target"] = row.get("target", np.nan)
            features["target_score_home"] = row.get("target_score_home", np.nan)
            features["target_score_away"] = row.get("target_score_away", np.nan)
            rows.append(features)

        return pd.DataFrame(rows)

    def _compute_match_features(
        self,
        row: pd.Series,
        history: pd.DataFrame,
        home_id: str,
        away_id: str,
        match_index: int,
    ) -> dict:
        f = {}

        f["elo_home"] = self.elo_ratings[home_id]
        f["elo_away"] = self.elo_ratings[away_id]
        f["elo_diff"] = f["elo_home"] - f["elo_away"]

        home_matches = self._team_matches(history, home_id)
        away_matches = self._team_matches(history, away_id)

        f["home_win_rate_10"] = self._win_rate(home_matches, home_id, 10)
        f["away_win_rate_10"] = self._win_rate(away_matches, away_id, 10)
        f["home_win_rate_38"] = self._win_rate(home_matches, home_id, 38)
        f["away_win_rate_38"] = self._win_rate(away_matches, away_id, 38)

        f["home_avg_goals_scored_10"] = self._avg_goals_for(home_matches, home_id, 10)
        f["away_avg_goals_scored_10"] = self._avg_goals_for(away_matches, away_id, 10)
        f["home_avg_goals_conceded_10"] = self._avg_goals_against(home_matches, home_id, 10)
        f["away_avg_goals_conceded_10"] = self._avg_goals_against(away_matches, away_id, 10)

        f["home_form_decay"] = self._form_decay(home_matches, home_id, window=10)
        f["away_form_decay"] = self._form_decay(away_matches, away_id, window=10)

        f["home_strength_of_schedule"] = self._strength_of_schedule(home_matches, home_id, history)
        f["away_strength_of_schedule"] = self._strength_of_schedule(away_matches, away_id, history)

        h2h = self._head_to_head(history, home_id, away_id)
        f["h2h_home_win_rate"] = h2h["home_win_rate"]
        f["h2h_total_meetings"] = h2h["total"]

        f["home_rest_days"] = self._rest_days(row, home_matches)
        f["away_rest_days"] = self._rest_days(row, away_matches)

        f["home_injury_index"] = row.get("home_injury_index", 0.0)
        f["away_injury_index"] = row.get("away_injury_index", 0.0)

        f["is_derby"] = self._is_derby(row, home_id, away_id)
        f["home_travel_distance"] = row.get("home_travel_distance", 0.0)
        f["away_travel_distance"] = row.get("away_travel_distance", 0.0)

        if "odds_home" in row and pd.notna(row.get("odds_home")):
            f["odds_home"] = row["odds_home"]
            f["odds_draw"] = row.get("odds_draw", np.nan)
            f["odds_away"] = row.get("odds_away", np.nan)
            f["odds_movement_home"] = row.get("odds_movement_home", 0.0)
            f["odds_movement_draw"] = row.get("odds_movement_draw", 0.0)
            f["odds_movement_away"] = row.get("odds_movement_away", 0.0)
            f["market_volume"] = row.get("bookmaker_count", 0)

        self._update_elo(home_id, away_id, row, f)

        return f

    def _team_matches(self, history: pd.DataFrame, team_id: str) -> pd.DataFrame:
        if history.empty:
            return pd.DataFrame()
        mask = (history["home_team_id"].astype(str) == team_id) | \
               (history["away_team_id"].astype(str) == team_id)
        return history[mask].tail(50)

    def _win_rate(self, matches: pd.DataFrame, team_id: str, window: int) -> float:
        if matches.empty:
            return 0.5
        recent = matches.tail(window)
        if recent.empty:
            return 0.5
        wins = 0
        for _, m in recent.iterrows():
            is_home = str(m["home_team_id"]) == team_id
            home_score = m.get("home_score", 0)
            away_score = m.get("away_score", 0)
            if is_home and home_score > away_score:
                wins += 1
            elif not is_home and away_score > home_score:
                wins += 1
        return wins / len(recent) if len(recent) > 0 else 0.5

    def _avg_goals_for(self, matches: pd.DataFrame, team_id: str, window: int) -> float:
        if matches.empty:
            return 1.5
        recent = matches.tail(window)
        goals = []
        for _, m in recent.iterrows():
            is_home = str(m["home_team_id"]) == team_id
            goals.append(m["home_score"] if is_home else m["away_score"])
        return np.mean(goals) if goals else 1.5

    def _avg_goals_against(self, matches: pd.DataFrame, team_id: str, window: int) -> float:
        if matches.empty:
            return 1.5
        recent = matches.tail(window)
        goals = []
        for _, m in recent.iterrows():
            is_home = str(m["home_team_id"]) == team_id
            goals.append(m["away_score"] if is_home else m["home_score"])
        return np.mean(goals) if goals else 1.5

    def _form_decay(self, matches: pd.DataFrame, team_id: str, window: int = 10) -> float:
        """Weighted form: most recent matches contribute more."""
        if matches.empty:
            return 0.5
        recent = matches.tail(window)
        if recent.empty:
            return 0.5
        weights = np.exp(np.linspace(-1, 0, len(recent)))
        weights = weights / weights.sum()

        score = 0.0
        for i, (_, m) in enumerate(recent.iterrows()):
            is_home = str(m["home_team_id"]) == team_id
            home_score = m.get("home_score", 0)
            away_score = m.get("away_score", 0)
            if (is_home and home_score > away_score) or (not is_home and away_score > home_score):
                score += weights[i] * 1.0
            elif home_score == away_score:
                score += weights[i] * 0.5
        return score

    def _strength_of_schedule(
        self, matches: pd.DataFrame, team_id: str, all_history: pd.DataFrame
    ) -> float:
        """Average ELO of all opponents faced."""
        if matches.empty or all_history.empty:
            return 1500.0
        total_elo = 0.0
        count = 0
        for _, m in matches.iterrows():
            is_home = str(m["home_team_id"]) == team_id
            opp_id = str(m["away_team_id"]) if is_home else str(m["home_team_id"])
            total_elo += self.elo_ratings.get(opp_id, 1500.0)
            count += 1
        return total_elo / count if count > 0 else 1500.0

    def _head_to_head(
        self, history: pd.DataFrame, home_id: str, away_id: str
    ) -> dict:
        if history.empty:
            return {"home_win_rate": 0.5, "total": 0}
        mask = (
            ((history["home_team_id"].astype(str) == home_id) & (history["away_team_id"].astype(str) == away_id)) |
            ((history["home_team_id"].astype(str) == away_id) & (history["away_team_id"].astype(str) == home_id))
        )
        h2h = history[mask]
        total = len(h2h)
        if total == 0:
            return {"home_win_rate": 0.5, "total": 0}
        home_wins = 0
        for _, m in h2h.iterrows():
            if str(m["home_team_id"]) == home_id:
                if m["home_score"] > m["away_score"]:
                    home_wins += 1
            else:
                if m["away_score"] > m["home_score"]:
                    home_wins += 1
        return {"home_win_rate": home_wins / total, "total": total}

    def _rest_days(self, row: pd.Series, team_matches: pd.DataFrame) -> float:
        if team_matches.empty:
            return 7.0
        current_date = pd.to_datetime(row.get("utc_date", row.get("date")))
        last_date = pd.to_datetime(team_matches.iloc[-1].get("utc_date", team_matches.iloc[-1].get("date")))
        return (current_date - last_date).days

    def _is_derby(self, row: pd.Series, home_id: str, away_id: str) -> int:
        derby_pairs = [
            ("Manchester City", "Manchester United"),
            ("Liverpool", "Everton"),
            ("Arsenal", "Tottenham"),
            ("Barcelona", "Real Madrid"),
            ("Inter", "Milan"),
            ("Roma", "Lazio"),
            ("Bayern Munich", "Borussia Dortmund"),
        ]
        home_name = str(row.get("home_team_name", "")).lower()
        away_name = str(row.get("away_team_name", "")).lower()
        for t1, t2 in derby_pairs:
            if (t1.lower() in home_name and t2.lower() in away_name) or \
               (t2.lower() in home_name and t1.lower() in away_name):
                return 1
        return 0

    def _update_elo(self, home_id: str, away_id: str, row: pd.Series, features: dict):
        """Update ELO ratings after the match (only for training data)."""
        home_score = row.get("home_score")
        away_score = row.get("away_score")
        if home_score is None or away_score is None or pd.isna(home_score) or pd.isna(away_score):
            return
        expected_home = 1.0 / (1.0 + 10 ** ((self.elo_ratings[away_id] - self.elo_ratings[home_id]) / 400.0))
        expected_away = 1.0 - expected_home

        if home_score > away_score:
            actual_home, actual_away = 1.0, 0.0
        elif home_score == away_score:
            actual_home, actual_away = 0.5, 0.5
        else:
            actual_home, actual_away = 0.0, 1.0

        goal_diff = abs(home_score - away_score)
        margin_multiplier = np.log(max(goal_diff, 1) + 1)

        self.elo_ratings[home_id] += self.k_factor * margin_multiplier * (actual_home - expected_home)
        self.elo_ratings[away_id] += self.k_factor * margin_multiplier * (actual_away - expected_away)


class BasketballFeatureEngineer:
    """Feature engineering for NBA-style basketball data."""

    def __init__(self, initial_elo: float = 1500.0, k_factor: float = 20.0):
        self.initial_elo = initial_elo
        self.k_factor = k_factor
        self.elo_ratings: Dict[str, float] = defaultdict(lambda: initial_elo)

    def build_features(self, df: pd.DataFrame, is_training: bool = True) -> pd.DataFrame:
        df = df.sort_values("date").reset_index(drop=True)
        rows = []

        for i in range(len(df)):
            row = df.iloc[i]
            history = df.iloc[:i] if is_training else df.iloc[:i]

            home_id = str(row.get("home_team_id", row.get("home_team_name", "")))
            away_id = str(row.get("away_team_id", row.get("away_team_name", "")))

            features = self._compute_features(row, history, home_id, away_id)
            features["target"] = row.get("target", np.nan)
            features["target_score_home"] = row.get("target_score_home", np.nan)
            features["target_score_away"] = row.get("target_score_away", np.nan)
            rows.append(features)

        return pd.DataFrame(rows)

    def _compute_features(self, row, history, home_id, away_id) -> dict:
        f = {}

        f["elo_home"] = self.elo_ratings[home_id]
        f["elo_away"] = self.elo_ratings[away_id]
        f["elo_diff"] = f["elo_home"] - f["elo_away"]

        home_games = self._team_games(history, home_id)
        away_games = self._team_games(history, away_id)

        f["home_win_rate_10"] = self._win_rate(home_games, home_id, 10)
        f["away_win_rate_10"] = self._win_rate(away_games, away_id, 10)

        f["home_avg_points_scored_10"] = self._avg_for(home_games, home_id, 10)
        f["away_avg_points_scored_10"] = self._avg_for(away_games, away_id, 10)
        f["home_avg_points_conceded_10"] = self._avg_against(home_games, home_id, 10)
        f["away_avg_points_conceded_10"] = self._avg_against(away_games, away_id, 10)

        f["home_ats_cover_rate_10"] = self._ats_cover_rate(row, home_games, home_id, 10)
        f["away_ats_cover_rate_10"] = self._ats_cover_rate(row, away_games, away_id, 10)

        f["home_pace_10"] = self._pace(home_games, home_id, 10)
        f["away_pace_10"] = self._pace(away_games, away_id, 10)

        f["home_form_decay"] = self._form_decay(home_games, home_id)
        f["away_form_decay"] = self._form_decay(away_games, away_id)

        h2h = self._head_to_head(history, home_id, away_id)
        f["h2h_home_win_rate"] = h2h["home_win_rate"]
        f["h2h_total_meetings"] = h2h["total"]

        f["home_rest_days"] = self._rest_days(row, home_games)
        f["away_rest_days"] = self._rest_days(row, away_games)
        f["home_back_to_back"] = int(f["home_rest_days"] == 0)
        f["away_back_to_back"] = int(f["away_rest_days"] == 0)

        f["home_travel_distance"] = self._travel_distance(row, home_id)

        f["home_injury_index"] = row.get("home_injury_index", 0.0)
        f["away_injury_index"] = row.get("away_injury_index", 0.0)

        if "odds_home" in row and pd.notna(row.get("odds_home")):
            f["odds_home"] = row["odds_home"]
            f["odds_away"] = row.get("odds_away", np.nan)
            f["odds_movement_home"] = row.get("odds_movement_home", 0.0)
            f["odds_movement_away"] = row.get("odds_movement_away", 0.0)
            f["total_line"] = row.get("total_line", 220.0)
            f["market_volume"] = row.get("bookmaker_count", 0)

        self._update_elo(home_id, away_id, row)
        return f

    def _team_games(self, history: pd.DataFrame, team_id: str) -> pd.DataFrame:
        if history.empty:
            return pd.DataFrame()
        mask = (history["home_team_id"].astype(str) == team_id) | \
               (history["away_team_id"].astype(str) == team_id)
        return history[mask].tail(82)

    def _win_rate(self, games: pd.DataFrame, team_id: str, window: int) -> float:
        if games.empty:
            return 0.5
        recent = games.tail(window)
        if recent.empty:
            return 0.5
        wins = 0
        for _, g in recent.iterrows():
            is_home = str(g["home_team_id"]) == team_id
            if is_home and g["home_score"] > g["away_score"]:
                wins += 1
            elif not is_home and g["away_score"] > g["home_score"]:
                wins += 1
        return wins / len(recent)

    def _avg_for(self, games: pd.DataFrame, team_id: str, window: int) -> float:
        if games.empty:
            return 110.0
        recent = games.tail(window)
        pts = []
        for _, g in recent.iterrows():
            is_home = str(g["home_team_id"]) == team_id
            pts.append(g["home_score"] if is_home else g["away_score"])
        return np.mean(pts) if pts else 110.0

    def _avg_against(self, games: pd.DataFrame, team_id: str, window: int) -> float:
        if games.empty:
            return 110.0
        recent = games.tail(window)
        pts = []
        for _, g in recent.iterrows():
            is_home = str(g["home_team_id"]) == team_id
            pts.append(g["away_score"] if is_home else g["home_score"])
        return np.mean(pts) if pts else 110.0

    def _ats_cover_rate(self, row, games: pd.DataFrame, team_id: str, window: int) -> float:
        """Against the spread cover rate (approximate using score margin)."""
        if games.empty:
            return 0.5
        recent = games.tail(window)
        if recent.empty:
            return 0.5
        covers = 0
        for _, g in recent.iterrows():
            is_home = str(g["home_team_id"]) == team_id
            spread = row.get("spread_home" if is_home else "spread_away")
            if spread is None or pd.isna(spread):
                continue
            spread_float = spread[0] if isinstance(spread, (list, tuple)) else float(spread)
            margin = (g["home_score"] - g["away_score"]) if is_home else (g["away_score"] - g["home_score"])
            if margin + spread_float > 0:
                covers += 1
        return covers / window if window > 0 else 0.5

    def _pace(self, games: pd.DataFrame, team_id: str, window: int) -> float:
        """Estimate pace: possessions per game."""
        if games.empty:
            return 100.0
        recent = games.tail(window)
        pace_vals = []
        for _, g in recent.iterrows():
            total = (g["home_score"] or 0) + (g["away_score"] or 0)
            pace_vals.append(total)
        return np.mean(pace_vals) if pace_vals else 100.0

    def _form_decay(self, games: pd.DataFrame, team_id: str, window: int = 10) -> float:
        if games.empty:
            return 0.5
        recent = games.tail(window)
        if recent.empty:
            return 0.5
        weights = np.exp(np.linspace(-1, 0, len(recent)))
        weights = weights / weights.sum()
        score = 0.0
        for i, (_, g) in enumerate(recent.iterrows()):
            is_home = str(g["home_team_id"]) == team_id
            won = (is_home and g["home_score"] > g["away_score"]) or \
                  (not is_home and g["away_score"] > g["home_score"])
            score += weights[i] * (1.0 if won else 0.0)
        return score

    def _head_to_head(self, history: pd.DataFrame, home_id: str, away_id: str) -> dict:
        if history.empty:
            return {"home_win_rate": 0.5, "total": 0}
        mask = (
            ((history["home_team_id"].astype(str) == home_id) & (history["away_team_id"].astype(str) == away_id)) |
            ((history["home_team_id"].astype(str) == away_id) & (history["away_team_id"].astype(str) == home_id))
        )
        h2h = history[mask]
        total = len(h2h)
        if total == 0:
            return {"home_win_rate": 0.5, "total": 0}
        home_wins = 0
        for _, g in h2h.iterrows():
            if str(g["home_team_id"]) == home_id:
                if g["home_score"] > g["away_score"]:
                    home_wins += 1
            else:
                if g["away_score"] > g["home_score"]:
                    home_wins += 1
        return {"home_win_rate": home_wins / total, "total": total}

    def _rest_days(self, row, team_games) -> float:
        if team_games.empty:
            return 3.0
        current = pd.to_datetime(row.get("date"))
        last = pd.to_datetime(team_games.iloc[-1].get("date"))
        return (current - last).days

    def _travel_distance(self, row, team_id) -> float:
        return 0.0

    def _update_elo(self, home_id: str, away_id: str, row):
        home_score = row.get("home_score")
        away_score = row.get("away_score")
        if home_score is None or away_score is None or pd.isna(home_score) or pd.isna(away_score):
            return
        expected_home = 1.0 / (1.0 + 10 ** ((self.elo_ratings[away_id] - self.elo_ratings[home_id]) / 400.0))
        actual_home = 1.0 if home_score > away_score else (0.5 if home_score == away_score else 0.0)
        actual_away = 1.0 - actual_home
        margin = abs(home_score - away_score)
        mult = np.log(max(margin, 1) + 1) / np.log(10)
        self.elo_ratings[home_id] += self.k_factor * mult * (actual_home - expected_home)
        self.elo_ratings[away_id] += self.k_factor * mult * ((1.0 - actual_home) - (1.0 - expected_home))
