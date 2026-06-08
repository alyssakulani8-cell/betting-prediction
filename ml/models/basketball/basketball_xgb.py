"""
XGBoost model for basketball (NBA) outcome prediction.
Binary classification: home win / away win.
Basketball has fewer draws so we model as binary.
"""

from typing import Dict, Optional
import numpy as np
import xgboost as xgb
from ..base import BasePredictor


class BasketballXGBoost(BasePredictor):
    def __init__(self, params: Optional[Dict] = None):
        self.params = params or {
            "objective": "binary:logistic",
            "max_depth": 5,
            "learning_rate": 0.03,
            "subsample": 0.8,
            "colsample_bytree": 0.7,
            "min_child_weight": 5,
            "gamma": 0.2,
            "reg_alpha": 0.5,
            "reg_lambda": 2.0,
            "eval_metric": ["logloss", "error"],
            "tree_method": "hist",
            "random_state": 42,
        }
        self.model: Optional[xgb.Booster] = None
        self.feature_names: list[str] = []

    @property
    def name(self) -> str:
        return "xgboost_basketball"

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

        y_pred = self.model.predict(dval)
        val_pred_class = (y_pred > 0.5).astype(int)
        val_acc = np.mean(val_pred_class == y_val)
        val_loss = self._binary_log_loss(y_val, y_pred)

        return {"val_accuracy": float(val_acc), "val_log_loss": float(val_loss)}

    def predict_proba(self, X) -> np.ndarray:
        if self.model is None:
            raise RuntimeError("Model not trained")
        d = xgb.DMatrix(X, feature_names=self.feature_names)
        preds = self.model.predict(d)
        return np.column_stack([1 - preds, preds])

    def predict(self, X) -> np.ndarray:
        return self.predict_proba(X)[:, 1] > 0.5

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

    @staticmethod
    def _binary_log_loss(y_true, y_pred, eps=1e-15):
        y_pred = np.clip(y_pred, eps, 1 - eps)
        return -np.mean(y_true * np.log(y_pred) + (1 - y_true) * np.log(1 - y_pred))
