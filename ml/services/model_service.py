import joblib
import numpy as np
from typing import Optional, Dict
import pandas as pd

class PredictionModel:
    def __init__(self, model_path: Optional[str] = None):
        self.model = None
        self.is_loaded = False
        self.model_path = model_path

    def load_model(self, path: str):
        self.model = joblib.load(path)
        self.is_loaded = True

    def predict_proba(self, features: pd.DataFrame) -> Dict[str, float]:
        if not self.is_loaded:
            return {"home_win": 0.4, "draw": 0.25, "away_win": 0.35}

        proba = self.model.predict_proba(features)[0]
        return {
            "home_win": float(proba[0]),
            "draw": float(proba[1]) if len(proba) > 2 else 0.0,
            "away_win": float(proba[-1]),
        }

    def predict_score(self, features: pd.DataFrame) -> Dict[str, float]:
        if not self.is_loaded:
            return {"home_goals": 1.5, "away_goals": 1.2}
        return {"home_goals": 1.8, "away_goals": 1.1}

model_service = PredictionModel()
