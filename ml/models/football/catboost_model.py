"""
CatBoost model for football prediction.
Excellent for categorical features with ordered boosting
to reduce target leakage in time-series data.
"""

from typing import Dict, Optional
import numpy as np
from catboost import CatBoostClassifier
import joblib

from ..base import BasePredictor


class FootballCatBoost(BasePredictor):
    def __init__(self, params: Optional[Dict] = None):
        self.params = params or {
            "iterations": 2000,
            "learning_rate": 0.03,
            "depth": 6,
            "l2_leaf_reg": 3.0,
            "border_count": 128,
            "loss_function": "MultiClass",
            "eval_metric": "MultiClass",
            "random_seed": 42,
            "od_type": "Iter",
            "od_wait": 50,
            "use_best_model": True,
            "verbose": False,
            "task_type": "CPU",
        }
        self.model: Optional[CatBoostClassifier] = None
        self.feature_names: list[str] = []

    @property
    def name(self) -> str:
        return "catboost_football"

    def fit(self, X_train, y_train, X_val, y_val) -> dict:
        self.model = CatBoostClassifier(**self.params)
        self.model.fit(
            X_train, y_train,
            eval_set=(X_val, y_val),
            use_best_model=True,
            verbose=False,
        )

        y_pred = self.model.predict_proba(X_val)
        val_acc = np.mean(y_pred.argmax(axis=1) == y_val)
        val_loss = self._log_loss(y_val, y_pred)
        return {"val_accuracy": float(val_acc), "val_log_loss": float(val_loss)}

    def predict_proba(self, X) -> np.ndarray:
        if self.model is None:
            raise RuntimeError("Model not trained")
        return self.model.predict_proba(X)

    def predict(self, X) -> np.ndarray:
        if self.model is None:
            raise RuntimeError("Model not trained")
        return self.model.predict(X).flatten().astype(int)

    def get_feature_importance(self) -> Optional[Dict[str, float]]:
        if self.model is None:
            return None
        scores = self.model.get_feature_importance()
        total = scores.sum() or 1
        return dict(zip(self.feature_names, scores / total))

    def save(self, path: str):
        if self.model:
            self.model.save_model(path)

    def load(self, path: str):
        self.model = CatBoostClassifier()
        self.model.load_model(path)

    @staticmethod
    def _log_loss(y_true, y_pred, eps=1e-15):
        y_pred = np.clip(y_pred, eps, 1 - eps)
        return -np.mean(np.sum(np.eye(y_pred.shape[1])[y_true] * np.log(y_pred), axis=1))
