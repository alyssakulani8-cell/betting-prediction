"""
Production model service that loads the champion model from registry
and serves predictions with proper feature engineering and calibration.
"""

import sys
from pathlib import Path
sys.path.append(str(Path(__file__).parent.parent))

import numpy as np
import pandas as pd
from typing import Dict, Optional, List, Tuple
from datetime import datetime

from config import config
from models.registry import ModelRegistry
from services.feature_engineering import FootballFeatureEngineer, BasketballFeatureEngineer


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

    def load_champion(self, sport: str = "football") -> bool:
        model = self.registry.load_champion(f"{sport}_ensemble")
        if model is None:
            print(f"[ModelService] No champion model found for {sport}")
            return False

        self._models[sport] = model

        if sport == "football":
            self._feature_engineers[sport] = FootballFeatureEngineer()
        else:
            self._feature_engineers[sport] = BasketballFeatureEngineer()

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

        if full_history is not None and engineer is not None:
            combined = pd.concat([full_history, df_row], ignore_index=True).reset_index(drop=True)
            combined["target"] = -1
            feature_df = engineer.build_features(combined, is_training=False)
            row_features = feature_df.iloc[-1:]
        else:
            row_features = engineer.build_features(df_row, is_training=False) if engineer else df_row

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
        else:
            result["predicted_outcome"] = "Home Win" if pred_class == 1 else "Away Win"
            result["home_win_prob"] = float(probas[1])
            result["away_win_prob"] = float(probas[0])

        return result

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
