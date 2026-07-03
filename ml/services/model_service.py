"""
Production model service that loads the champion model from registry
and serves predictions with proper feature engineering and calibration.
"""

import sys, json, random
from pathlib import Path
sys.path.append(str(Path(__file__).parent.parent))

import numpy as np
import pandas as pd
from typing import Dict, Optional, List, Tuple
from datetime import datetime
from math import exp, factorial

from config import config
from models.registry import ModelRegistry
from services.feature_engineering import FootballFeatureEngineer, BasketballFeatureEngineer
from services.team_names import normalize


class ModelService:
    """Singleton service for model inference in production."""

    def __init__(self):
        self.registry = ModelRegistry(registry_path=config.registry_path)
        self._models: Dict[str, object] = {}
        self._feature_engineers: Dict[str, object] = {}
        self._feature_cols: Dict[str, List[str]] = {
            "football": config.football_feature_columns,
            "basketball": config.basketball_feature_columns,
        }
        self._elo_states: Dict[str, Dict[str, float]] = {}

    def _elo_state_path(self, sport: str) -> Path:
        return Path(self.registry.path) / f"{sport}_ensemble" / "elo_state.json"

    def _save_elo_state(self, sport: str):
        state = self._elo_states.get(sport)
        if state:
            path = self._elo_state_path(sport)
            with open(path, "w") as f:
                json.dump(state, f)

    def _load_elo_state(self, sport: str) -> Dict[str, float]:
        path = self._elo_state_path(sport)
        if path.exists():
            with open(path) as f:
                return json.load(f)
        return {}

    def load_champion(self, sport: str = "football") -> bool:
        model = self.registry.load_champion(f"{sport}_ensemble")
        if model is None:
            print(f"[ModelService] No champion model found for {sport}")
            return False

        self._models[sport] = model

        if sport == "football":
            engineer = FootballFeatureEngineer()
        else:
            engineer = BasketballFeatureEngineer()

        # Load persisted ELO state
        elo_state = self._load_elo_state(sport)
        if elo_state:
            engineer.set_elo_state(elo_state)
            print(f"[ModelService] Loaded ELO state for {len(elo_state)} teams ({sport})")

        self._elo_states[sport] = engineer.get_elo_state()

        self._feature_engineers[sport] = engineer

        # Load the feature columns the model was trained with
        model_dir = Path(self.registry.path) / f"{sport}_ensemble"
        feat_cols_path = model_dir / "feature_columns.json"
        if feat_cols_path.exists():
            with open(feat_cols_path) as f:
                self._feature_cols[sport] = json.load(f)
            print(f"[ModelService] Using {len(self._feature_cols[sport])} feature columns from {feat_cols_path}")

        record = self.registry.get_champion_record(f"{sport}_ensemble")
        version = record.version if record else "unknown"
        print(f"[ModelService] Loaded {sport} champion: {version}")
        return True

    def predict_football(
        self,
        match_data: Dict,
        full_history: Optional[pd.DataFrame] = None,
    ) -> Dict:
        return self._predict("football", match_data, full_history)

    def predict_basketball(
        self,
        match_data: Dict,
        full_history: Optional[pd.DataFrame] = None,
    ) -> Dict:
        return self._predict("basketball", match_data, full_history)

    def _predict(
        self,
        sport: str,
        match_data: Dict,
        full_history: Optional[pd.DataFrame] = None,
    ) -> Dict:
        model = self._models.get(sport)
        if model is None:
            loaded = self.load_champion(sport)
            if not loaded:
                return self._fallback_prediction(sport)

        engineer = self._feature_engineers.get(sport)

        df_row = pd.DataFrame([match_data])

        # Normalize team names to canonical form for consistent ELO lookups
        home_name_raw = str(df_row.get("home_team_name", df_row.get("home_team", "")).iloc[0])
        away_name_raw = str(df_row.get("away_team_name", df_row.get("away_team", "")).iloc[0])
        df_row["home_team_id"] = normalize(home_name_raw)
        df_row["away_team_id"] = normalize(away_name_raw)
        df_row["home_team_name"] = normalize(home_name_raw)
        df_row["away_team_name"] = normalize(away_name_raw)

        if full_history is not None and engineer is not None:
            combined = pd.concat([full_history, df_row], ignore_index=True).reset_index(drop=True)
            combined["target"] = -1
            feature_df = engineer.build_features(combined, is_training=False)
            row_features = feature_df.iloc[-1:]
        else:
            row_features = engineer.build_features(df_row, is_training=False) if engineer else df_row

        self._elo_states[sport] = engineer.get_elo_state()

        if random.random() < 0.1:
            self._save_elo_state(sport)

        available_features = [c for c in self._feature_cols[sport] if c in row_features.columns]
        X = row_features[available_features].values

        probas = model.predict_proba(X)[0]
        pred_class = int(probas.argmax())
        confidence = float(probas.max())

        result = {
            "prediction": pred_class,
            "confidence": confidence,
            "probabilities": probas.tolist(),
            "sport": sport,
            "timestamp": datetime.now().isoformat(),
            "model": model.name if hasattr(model, "name") else "ensemble",
        }

        if sport == "football":
            result["predicted_outcome"] = ["Home Win", "Draw", "Away Win"][pred_class]
            result["home_win_prob"] = float(probas[0])
            result["draw_prob"] = float(probas[1])
            result["away_win_prob"] = float(probas[2])

            score_data = self._estimate_score(row_features.iloc[0] if len(row_features) > 0 else None)
            result.update(score_data)
        else:
            result["predicted_outcome"] = "Home Win" if pred_class == 1 else "Away Win"
            result["home_win_prob"] = float(probas[1])
            result["away_win_prob"] = float(probas[0])

        try:
            from services.continuous_learning import continuous_learner
            continuous_learner.logger.log_prediction(
                match_id=match_data.get("match_id", str(hash(str(match_data)))),
                sport=sport,
                home_team=str(match_data.get("home_team_name", "")),
                away_team=str(match_data.get("away_team_name", "")),
                predicted_outcome=result["predicted_outcome"],
                predicted_probs=probas.tolist(),
                confidence=confidence,
            )
        except Exception:
            pass

        return result

    def _estimate_score(self, features: Optional[pd.Series]) -> Dict:
        """Estimate goals, over/under and BTTS from feature data using Poisson."""
        score_data = {
            "predicted_home_goals": 1.0,
            "predicted_away_goals": 1.0,
            "over_25_prob": 0.5,
            "under_25_prob": 0.5,
            "btts_prob": 0.5,
            "most_likely_score": "1-1",
        }

        if features is None:
            return score_data

        try:
            home_scored = float(features.get("home_avg_goals_scored_10", 1.5))
            home_conceded = float(features.get("home_avg_goals_conceded_10", 1.2))
            away_scored = float(features.get("away_avg_goals_scored_10", 1.3))
            away_conceded = float(features.get("away_avg_goals_conceded_10", 1.4))
            elo_home = float(features.get("elo_home", 1500.0))
            elo_away = float(features.get("elo_away", 1500.0))

            elo_diff = elo_home - elo_away
            elo_factor = 1.0 + (elo_diff / 2000.0)
            elo_factor = max(0.8, min(1.2, elo_factor))

            lambda_home = ((home_scored + away_conceded) / 2.0) * elo_factor
            lambda_away = ((away_scored + home_conceded) / 2.0) / elo_factor

            lambda_home = max(0.3, min(4.0, lambda_home))
            lambda_away = max(0.2, min(3.5, lambda_away))

            def poisson_prob(lmbda: float, k: int) -> float:
                return (exp(-lmbda) * (lmbda ** k)) / factorial(k)

            over_25 = 0.0
            btts = 0.0
            max_score_prob = 0.0
            best_home_goals = 1
            best_away_goals = 1

            for hg in range(7):
                ph = poisson_prob(lambda_home, hg)
                for ag in range(7):
                    pa = poisson_prob(lambda_away, ag)
                    prob = ph * pa
                    if hg + ag > 2.5:
                        over_25 += prob
                    if hg > 0 and ag > 0:
                        btts += prob
                    if prob > max_score_prob:
                        max_score_prob = prob
                        best_home_goals = hg
                        best_away_goals = ag

            score_data["predicted_home_goals"] = round(lambda_home, 2)
            score_data["predicted_away_goals"] = round(lambda_away, 2)
            score_data["over_25_prob"] = round(over_25, 4)
            score_data["under_25_prob"] = round(1.0 - over_25, 4)
            score_data["btts_prob"] = round(btts, 4)
            score_data["most_likely_score"] = f"{best_home_goals}-{best_away_goals}"
        except Exception:
            pass

        return score_data

    def predict_batch(self, sport: str, matches: List[Dict]) -> List[Dict]:
        return [self._predict(sport, m) for m in matches]

    def get_champion_info(self, sport: str = "football") -> Optional[Dict]:
        record = self.registry.get_champion_record(f"{sport}_ensemble")
        if record is None:
            return None
        return {
            "version": record.version,
            "name": record.name,
            "sport": record.sport,
            "timestamp": record.timestamp,
            "metrics": record.metrics,
            "training_samples": record.training_samples,
            "feature_importance": record.feature_importance,
        }

    def _fallback_prediction(self, sport: str) -> Dict:
        if sport == "football":
            return {
                "prediction": 0,
                "confidence": 0.4,
                "probabilities": [0.45, 0.25, 0.30],
                "predicted_outcome": "Home Win",
                "home_win_prob": 0.45,
                "draw_prob": 0.25,
                "away_win_prob": 0.30,
                "predicted_home_goals": 1.2,
                "predicted_away_goals": 0.8,
                "over_25_prob": 0.45,
                "under_25_prob": 0.55,
                "btts_prob": 0.48,
                "most_likely_score": "1-0",
                "sport": sport,
                "timestamp": datetime.now().isoformat(),
                "model": "fallback",
            }
        else:
            return {
                "prediction": 1,
                "confidence": 0.55,
                "probabilities": [0.45, 0.55],
                "predicted_outcome": "Home Win",
                "home_win_prob": 0.55,
                "away_win_prob": 0.45,
                "sport": sport,
                "timestamp": datetime.now().isoformat(),
                "model": "fallback",
            }


model_service = ModelService()
