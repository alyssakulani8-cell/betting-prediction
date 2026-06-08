"""
XGBoost model for football match outcome prediction.
- Multi-class: home win, draw, away win
- Uses log_loss objective for calibrated probabilities
- Early stopping on validation set
"""

from typing import Dict, Optional
import numpy as np
import xgboost as xgb
import joblib

from ..base import BasePredictor


class FootballXGBoost(BasePredictor):
    def __init__(self, params: Optional[Dict] = None):
        self.params = params or {
            "objective": "multi:softprob",
            "num_class": 3,
            "max_depth": 6,
            "learning_rate": 0.05,
            "subsample": 0.8,
            "colsample_bytree": 0.8,
            "min_child_weight": 3,
            "gamma": 0.1,
            "reg_alpha": 0.1,
            "reg_lambda": 1.0,
            "eval_metric": ["mlogloss", "merror"],
            "tree_method": "hist",
            "random_state": 42,
        }
        self.model: Optional[xgb.Booster] = None
        self.feature_names: list[str] = []
        self._best_iteration = 0

    @property
    def name(self) -> str:
        return "xgboost_football"

    def fit(self, X_train, y_train, X_val, y_val) -> dict:
        dtrain = xgb.DMatrix(X_train, label=y_train, feature_names=self.feature_names)
        dval = xgb.DMatrix(X_val, label=y_val, feature_names=self.feature_names)

        self.model = xgb.train(
            self.params,
            dtrain,
            num_boost_round=2000,
            evals=[(dtrain, "train"), (dval, "val")],
            early_stopping_rounds=50,
            verbose_eval=False,
        )
        self._best_iteration = self.model.best_iteration

        y_pred = self.model.predict(dval)
        val_acc = np.mean(y_pred.argmax(axis=1) == y_val)
        val_loss = self._log_loss(y_val, y_pred)

        return {"val_accuracy": float(val_acc), "val_log_loss": float(val_loss)}

    def predict_proba(self, X) -> np.ndarray:
        if self.model is None:
            raise RuntimeError("Model not trained")
        d = xgb.DMatrix(X, feature_names=self.feature_names)
        return self.model.predict(d)

    def predict(self, X) -> np.ndarray:
        return self.predict_proba(X).argmax(axis=1)

    def get_feature_importance(self) -> Optional[Dict[str, float]]:
        if self.model is None:
            return None
        scores = self.model.get_score(importance_type="gain")
        total = sum(scores.values()) or 1
        return {k: v / total for k, v in scores.items()}

    def save(self, path: str):
        if self.model:
            self.model.save_model(path)

    def load(self, path: str):
        self.model = xgb.Booster()
        self.model.load_model(path)
        if hasattr(self.model, "feature_names"):
            self.feature_names = self.model.feature_names or []

    @staticmethod
    def _log_loss(y_true, y_pred, eps=1e-15):
        y_pred = np.clip(y_pred, eps, 1 - eps)
        return -np.mean(np.sum(np.eye(y_pred.shape[1])[y_true] * np.log(y_pred), axis=1))
