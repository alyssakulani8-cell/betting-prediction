"""
Full training pipeline with:
1. Data fetching from all sources
2. Preprocessing & cleaning
3. Feature engineering (football or basketball)
4. Time-series cross validation
5. Hyperparameter tuning via Optuna
6. Ensemble training
7. Model registry & champion promotion
8. Performance reporting
"""

import sys
from pathlib import Path
sys.path.append(str(Path(__file__).parent.parent))

import argparse
import numpy as np
import pandas as pd
from datetime import datetime
from typing import Optional

from config import config
from data.orchestrator import DataOrchestrator
from data.preprocessing import DataPreprocessor
from services.feature_engineering import FootballFeatureEngineer, BasketballFeatureEngineer
try:
    from models.football.xgboost_model import FootballXGBoost
except ImportError:
    FootballXGBoost = None
try:
    from models.football.catboost_model import FootballCatBoost
except ImportError:
    FootballCatBoost = None
try:
    from models.football.neural_net import FootballNeuralNet
except ImportError:
    FootballNeuralNet = None
try:
    from models.basketball.basketball_xgb import BasketballXGBoost
except ImportError:
    BasketballXGBoost = None
from models.ensemble import EnsemblePredictor
from models.registry import ModelRegistry


def _optimize_xgboost(X_train, y_train, X_val, y_val, n_trials: int = 30) -> dict:
    """Use Optuna to find optimal XGBoost hyperparameters."""
    try:
        import optuna
        import xgboost as xgb

        def objective(trial):
            params = {
                "objective": "multi:softprob",
                "num_class": 3,
                "eval_metric": ["mlogloss", "merror"],
                "tree_method": "hist",
                "random_state": 42,
                "max_depth": trial.suggest_int("max_depth", 3, 10),
                "learning_rate": trial.suggest_float("learning_rate", 1e-3, 0.1, log=True),
                "subsample": trial.suggest_float("subsample", 0.5, 1.0),
                "colsample_bytree": trial.suggest_float("colsample_bytree", 0.3, 1.0),
                "min_child_weight": trial.suggest_int("min_child_weight", 1, 10),
                "gamma": trial.suggest_float("gamma", 0.0, 1.0),
                "reg_alpha": trial.suggest_float("reg_alpha", 1e-3, 10.0, log=True),
                "reg_lambda": trial.suggest_float("reg_lambda", 0.1, 10.0, log=True),
            }
            dtrain = xgb.DMatrix(X_train, label=y_train)
            dval = xgb.DMatrix(X_val, label=y_val)
            model = xgb.train(
                params, dtrain, num_boost_round=1000,
                evals=[(dval, "val")], early_stopping_rounds=30,
                verbose_eval=False,
            )
            y_pred = model.predict(dval)
            val_acc = float(np.mean(y_pred.argmax(axis=1) == y_val))
            return val_acc

        study = optuna.create_study(direction="maximize", sampler=optuna.samplers.TPESampler(seed=42))
        study.optimize(objective, n_trials=n_trials, timeout=3600)
        return study.best_params
    except ImportError:
        print("  Optuna not available, using default XGBoost params")
        return {}
    except Exception as e:
        print(f"  Optuna tuning failed: {e}, using defaults")
        return {}


def _optimize_catboost(X_train, y_train, X_val, y_val, n_trials: int = 30) -> dict:
    """Use Optuna to find optimal CatBoost hyperparameters."""
    try:
        import optuna
        from catboost import CatBoostClassifier

        def objective(trial):
            params = {
                "iterations": 1000,
                "loss_function": "MultiClass",
                "random_seed": 42,
                "verbose": False,
                "depth": trial.suggest_int("depth", 4, 10),
                "learning_rate": trial.suggest_float("learning_rate", 1e-3, 0.1, log=True),
                "l2_leaf_reg": trial.suggest_float("l2_leaf_reg", 1.0, 10.0),
                "border_count": trial.suggest_int("border_count", 32, 255),
                "subsample": trial.suggest_float("subsample", 0.5, 1.0),
            }
            model = CatBoostClassifier(**params)
            model.fit(X_train, y_train, eval_set=(X_val, y_val), early_stopping_rounds=30, verbose=False)
            y_pred = model.predict(X_val)
            from sklearn.metrics import accuracy_score
            return float(accuracy_score(y_val, y_pred))

        study = optuna.create_study(direction="maximize", sampler=optuna.samplers.TPESampler(seed=42))
        study.optimize(objective, n_trials=n_trials, timeout=3600)
        return study.best_params
    except ImportError:
        print("  Optuna not available, using default CatBoost params")
        return {}
    except Exception as e:
        print(f"  CatBoost tuning failed: {e}, using defaults")
        return {}


class TrainingPipeline:
    def __init__(self, sport: str = "football"):
        self.sport = sport
        self.orchestrator = DataOrchestrator()
        self.preprocessor = DataPreprocessor(
            val_size=config.val_size,
            test_size=config.test_size,
        )
        self.registry = ModelRegistry(registry_path=config.registry_path)
        self.feature_cols = (
            config.football_feature_columns
            if sport == "football"
            else config.basketball_feature_columns
        )

    def run(
        self,
        leagues: Optional[list[str]] = None,
        seasons: Optional[list[str]] = None,
        tune: bool = True,
        n_trials: int = 30,
        source: str = "api",
    ) -> dict:
        print(f"[{datetime.now().isoformat()}] Starting {self.sport} training pipeline (source={source})...")

        df = self._fetch_data(leagues, seasons, source)
        print(f"  Fetched {len(df)} matches")

        df = self.preprocessor.clean_matches(df)
        df = self.preprocessor.create_target(df, sport=self.sport)
        print(f"  Cleaned: {len(df)} matches")

        feature_df = self._engineer_features(df)
        print(f"  Features: {feature_df.shape}")

        feature_df = feature_df.dropna()
        print(f"  After dropna: {feature_df.shape}")

        available_features = [c for c in self.feature_cols if c in feature_df.columns]
        X = feature_df[available_features].values
        y = feature_df["target"].values

        splits = self.preprocessor.time_series_split(feature_df, available_features)
        print(f"  Time-series CV splits: {len(splits)}")

        all_metrics = []
        best_models = []
        tuned_xgb_params = None
        tuned_cat_params = None

        if tune and len(splits) > 0:
            first_tr, first_y_tr, first_val, first_y_val, _, _ = splits[0]
            print("\n  Tuning XGBoost hyperparameters with Optuna...")
            tuned_xgb_params = _optimize_xgboost(first_tr, first_y_tr, first_val, first_y_val, n_trials)
            if tuned_xgb_params:
                print(f"  Best XGBoost params: {tuned_xgb_params}")

            if self.sport == "football":
                print("  Tuning CatBoost hyperparameters with Optuna...")
                tuned_cat_params = _optimize_catboost(first_tr, first_y_tr, first_val, first_y_val, n_trials)
                if tuned_cat_params:
                    print(f"  Best CatBoost params: {tuned_cat_params}")

        for fold, (X_tr, y_tr, X_val, y_val, X_te, y_te) in enumerate(splits):
            print(f"\n  --- Fold {fold + 1}/{len(splits)} ---")
            print(f"    Train: {len(X_tr)}, Val: {len(X_val)}, Test: {len(X_te)}")

            X_tr_s, X_val_s, X_te_s = self.preprocessor.fit_transform(X_tr, X_val, X_te)

            models = self._build_models(X_tr_s.shape[1], available_features, tuned_xgb_params, tuned_cat_params)
            ensemble = EnsemblePredictor(base_models=models, method="stacking",
                                          n_classes=(3 if self.sport == "football" else 2))

            metrics = ensemble.fit(X_tr_s, y_tr, X_val_s, y_val)
            all_metrics.append(metrics)

            test_probas = ensemble.predict_proba(X_te_s)
            if self.sport == "football":
                test_preds = test_probas.argmax(axis=1)
            else:
                test_preds = (test_probas[:, 1] > 0.5).astype(int)

            test_acc = np.mean(test_preds == y_te)
            print(f"    Test accuracy: {test_acc:.4f}")

            best_models.append(ensemble)

        champion_model = self._select_champion(best_models, all_metrics)
        final_metrics = self._aggregate_metrics(all_metrics)

        feature_imp = champion_model.get_feature_importance()

        version = self.registry.register(
            model=champion_model,
            name=f"{self.sport}_ensemble",
            sport=self.sport,
            metrics=final_metrics,
            params={"leagues": leagues, "seasons": seasons, "n_trials": n_trials, "tuned_xgb": tuned_xgb_params, "tuned_cat": tuned_cat_params},
            feature_importance=feature_imp,
            training_samples=len(df),
            make_champion=True,
        )

        print(f"\n  Champion model registered: {version}")
        print(f"  Final metrics: {final_metrics}")

        return {
            "version": version,
            "sport": self.sport,
            "metrics": final_metrics,
            "training_samples": len(df),
            "feature_importance": feature_imp,
        }

    def _fetch_data(self, leagues, seasons, source: str = "api") -> pd.DataFrame:
        if source == "backend":
            if self.sport == "football":
                return self.orchestrator.fetch_backend_football_dataset()
            else:
                raise ValueError("Backend source not available for basketball yet")
        if self.sport == "football":
            return self.orchestrator.fetch_football_dataset(
                leagues=leagues or ["PL", "PD", "SA", "BL", "FL"],
                seasons=seasons or ["2024", "2025"],
            )
        else:
            return self.orchestrator.fetch_basketball_dataset(season="2025")

    def _engineer_features(self, df: pd.DataFrame) -> pd.DataFrame:
        if self.sport == "football":
            engineer = FootballFeatureEngineer()
        else:
            engineer = BasketballFeatureEngineer()
        return engineer.build_features(df, is_training=True)

    def _build_models(self, input_dim: int, feature_names: list, tuned_xgb: dict = None, tuned_cat: dict = None) -> list:
        if self.sport == "football":
            xgb_params = tuned_xgb if tuned_xgb else None
            xgb_model = FootballXGBoost(params=xgb_params)
            xgb_model.feature_names = feature_names

            cat_params = tuned_cat if tuned_cat else None
            cat_model = FootballCatBoost(params=cat_params)
            cat_model.feature_names = feature_names

            nn_model = FootballNeuralNet(input_dim=input_dim)
            nn_model.feature_names = feature_names

            return [xgb_model, cat_model, nn_model]
        else:
            xgb_params = tuned_xgb if tuned_xgb else None
            xgb_model = BasketballXGBoost(params=xgb_params)
            xgb_model.feature_names = feature_names
            return [xgb_model]

    def _select_champion(self, models, all_metrics) -> EnsemblePredictor:
        fold_scores = []
        for i, metrics in enumerate(all_metrics):
            acc = metrics.get("ensemble", {}).get("val_accuracy", 0)
            fold_scores.append(acc)
        best_fold = int(np.argmax(fold_scores))
        return models[best_fold]

    @staticmethod
    def _aggregate_metrics(all_metrics: list) -> dict:
        accs = []
        losses = []
        for m in all_metrics:
            ensemble = m.get("ensemble", {})
            if "val_accuracy" in ensemble:
                accs.append(ensemble["val_accuracy"])
        return {
            "val_accuracy_mean": float(np.mean(accs)) if accs else 0,
            "val_accuracy_std": float(np.std(accs)) if accs else 0,
        }


def main():
    parser = argparse.ArgumentParser(description="Training Pipeline")
    parser.add_argument("--sport", choices=["football", "basketball"], default="football")
    parser.add_argument("--leagues", nargs="+", default=None)
    parser.add_argument("--seasons", nargs="+", default=None)
    parser.add_argument("--trials", type=int, default=30)
    parser.add_argument("--source", choices=["api", "backend"], default="api",
                        help="'api' fetches from football-data.org, 'backend' reads from backend SQLite")
    args = parser.parse_args()

    pipeline = TrainingPipeline(sport=args.sport)
    result = pipeline.run(
        leagues=args.leagues,
        seasons=args.seasons,
        tune=True,
        n_trials=args.trials,
        source=args.source,
    )
    print(f"\nPipeline complete: {result}")


if __name__ == "__main__":
    main()
