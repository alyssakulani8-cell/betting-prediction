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
from models.football.xgboost_model import FootballXGBoost
from models.football.catboost_model import FootballCatBoost
from models.football.neural_net import FootballNeuralNet
from models.basketball.basketball_xgb import BasketballXGBoost
from models.ensemble import EnsemblePredictor
from models.registry import ModelRegistry


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
    ) -> dict:
        print(f"[{datetime.now().isoformat()}] Starting {self.sport} training pipeline...")

        df = self._fetch_data(leagues, seasons)
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

        for fold, (X_tr, y_tr, X_val, y_val, X_te, y_te) in enumerate(splits):
            print(f"\n  --- Fold {fold + 1}/{len(splits)} ---")
            print(f"    Train: {len(X_tr)}, Val: {len(X_val)}, Test: {len(X_te)}")

            X_tr_s, X_val_s, X_te_s = self.preprocessor.fit_transform(X_tr, X_val, X_te)

            models = self._build_models(X_tr_s.shape[1], available_features)
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
        if feature_imp:
            feature_imp = dict(zip(available_features, list(feature_imp.values())))

        version = self.registry.register(
            model=champion_model,
            name=f"{self.sport}_ensemble",
            sport=self.sport,
            metrics=final_metrics,
            params={"leagues": leagues, "seasons": seasons, "n_trials": n_trials},
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

    def _fetch_data(self, leagues, seasons) -> pd.DataFrame:
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

    def _build_models(self, input_dim: int, feature_names: list) -> list:
        if self.sport == "football":
            xgb_model = FootballXGBoost()
            xgb_model.feature_names = feature_names

            cat_model = FootballCatBoost()
            cat_model.feature_names = feature_names

            nn_model = FootballNeuralNet(input_dim=input_dim)
            nn_model.feature_names = feature_names

            return [xgb_model, cat_model, nn_model]
        else:
            xgb_model = BasketballXGBoost()
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
    args = parser.parse_args()

    pipeline = TrainingPipeline(sport=args.sport)
    result = pipeline.run(
        leagues=args.leagues,
        seasons=args.seasons,
        tune=True,
        n_trials=args.trials,
    )
    print(f"\nPipeline complete: {result}")


if __name__ == "__main__":
    main()
