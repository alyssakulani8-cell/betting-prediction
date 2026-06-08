"""
Ensemble model that combines multiple base predictors using a
stacking (meta-learner) approach with logistic regression / ridge.

Features:
- Weighted averaging of base model probabilities
- Stacking meta-learner (LogisticRegression)
- Calibration via Platt scaling / isotonic regression
"""

from typing import Dict, List, Optional
import numpy as np
from sklearn.linear_model import LogisticRegression
from sklearn.calibration import CalibratedClassifierCV
from scipy.special import softmax

from .base import BasePredictor


class EnsemblePredictor(BasePredictor):
    def __init__(
        self,
        base_models: List[BasePredictor],
        method: str = "stacking",
        n_classes: int = 3,
    ):
        self.base_models = base_models
        self.method = method
        self.n_classes = n_classes
        self.meta_learner: Optional[LogisticRegression] = None
        self.base_weights: Optional[np.ndarray] = None
        self.feature_names: list[str] = []
        self._is_fitted = False

    @property
    def name(self) -> str:
        return f"ensemble_{self.method}_{'_'.join(m.name for m in self.base_models)}"

    def fit(self, X_train, y_train, X_val, y_val) -> dict:
        base_train_preds = []
        base_val_preds = []
        val_metrics = {}

        for i, model in enumerate(self.base_models):
            metrics = model.fit(X_train, y_train, X_val, y_val)
            val_metrics[model.name] = metrics

            train_probas = model.predict_proba(X_train)
            val_probas = model.predict_proba(X_val)
            base_train_preds.append(train_probas)
            base_val_preds.append(val_probas)

        if self.method == "average":
            self.base_weights = np.ones(len(self.base_models)) / len(self.base_models)
            ensemble_val_probas = np.average(base_val_preds, axis=0, weights=self.base_weights)

        elif self.method == "weighted":
            val_losses = []
            for model in self.base_models:
                probas = model.predict_proba(X_val)
                if self.n_classes == 2:
                    loss = self._binary_log_loss(y_val, probas[:, 1])
                else:
                    loss = self._log_loss(y_val, probas)
                val_losses.append(loss)
            inv_losses = 1.0 / (np.array(val_losses) + 1e-8)
            self.base_weights = inv_losses / inv_losses.sum()
            ensemble_val_probas = np.average(base_val_preds, axis=0, weights=self.base_weights)

        elif self.method == "stacking":
            stack_train = np.column_stack([
                p.reshape(len(p), -1) for p in base_train_preds
            ])
            stack_val = np.column_stack([
                p.reshape(len(p), -1) for p in base_val_preds
            ])

            if self.n_classes == 2:
                self.meta_learner = LogisticRegression(C=1.0, penalty="l2", solver="lbfgs")
                self.meta_learner.fit(stack_train, y_train)
                ensemble_val_probas = self.meta_learner.predict_proba(stack_val)
            else:
                self.meta_learner = LogisticRegression(
                    C=1.0, penalty="l2", solver="lbfgs", multi_class="multinomial", max_iter=1000
                )
                self.meta_learner.fit(stack_train, y_train)
                ensemble_val_probas = self.meta_learner.predict_proba(stack_val)

        self._is_fitted = True

        if self.n_classes == 2:
            ensemble_preds = (ensemble_val_probas[:, 1] > 0.5).astype(int)
            val_acc = np.mean(ensemble_preds == y_val)
        else:
            ensemble_preds = ensemble_val_probas.argmax(axis=1)
            val_acc = np.mean(ensemble_preds == y_val)

        val_metrics["ensemble"] = {"val_accuracy": float(val_acc)}
        return val_metrics

    def predict_proba(self, X) -> np.ndarray:
        if not self._is_fitted:
            raise RuntimeError("Ensemble not fitted")

        base_probas = [m.predict_proba(X) for m in self.base_models]

        if self.method in ("average", "weighted"):
            return np.average(base_probas, axis=0, weights=self.base_weights)

        elif self.method == "stacking" and self.meta_learner:
            stack = np.column_stack([p.reshape(len(p), -1) for p in base_probas])
            return self.meta_learner.predict_proba(stack)

        return np.average(base_probas, axis=0)

    def predict(self, X) -> np.ndarray:
        probas = self.predict_proba(X)
        if self.n_classes == 2:
            return (probas[:, 1] > 0.5).astype(int)
        return probas.argmax(axis=1)

    def get_feature_importance(self) -> Optional[Dict[str, float]]:
        if self.method == "stacking" and self.meta_learner:
            coefs = np.abs(self.meta_learner.coef_).mean(axis=0)
            n_models = len(self.base_models)
            n_per_model = len(coefs) // n_models
            importance = {}
            for i, model in enumerate(self.base_models):
                start = i * n_per_model
                end = start + n_per_model
                importance[model.name] = float(coefs[start:end].mean())
            total = sum(importance.values()) or 1
            return {k: v / total for k, v in importance.items()}
        return None

    def save(self, path: str):
        import joblib
        joblib.dump({
            "base_models": self.base_models,
            "method": self.method,
            "meta_learner": self.meta_learner,
            "base_weights": self.base_weights,
            "n_classes": self.n_classes,
        }, path)

    def load(self, path: str):
        import joblib
        data = joblib.load(path)
        self.base_models = data["base_models"]
        self.method = data["method"]
        self.meta_learner = data["meta_learner"]
        self.base_weights = data["base_weights"]
        self.n_classes = data["n_classes"]
        self._is_fitted = True

    @staticmethod
    def _log_loss(y_true, y_pred, eps=1e-15):
        y_pred = np.clip(y_pred, eps, 1 - eps)
        return -np.mean(np.sum(np.eye(y_pred.shape[1])[y_true] * np.log(y_pred), axis=1))

    @staticmethod
    def _binary_log_loss(y_true, y_pred, eps=1e-15):
        y_pred = np.clip(y_pred, eps, 1 - eps)
        return -np.mean(y_true * np.log(y_pred) + (1 - y_true) * np.log(1 - y_pred))
