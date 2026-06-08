"""
Tests for the ML pipeline components.
Run with: pytest scripts/tests/test_pipeline.py -v
"""

import sys
from pathlib import Path
sys.path.append(str(Path(__file__).parent.parent.parent))

import numpy as np
import pandas as pd
import pytest
from datetime import datetime, timedelta


class TestFeatureEngineering:
    def test_form_decay_weights_recent_more(self):
        from services.feature_engineering import FootballFeatureEngineer
        engineer = FootballFeatureEngineer()

        recent_wins = ["L", "L", "L", "L", "W"]
        recent_losses = ["W", "W", "W", "W", "L"]

        win_score = engineer._form_decay(
            self._make_form_df(recent_wins), "team1", window=5
        )
        loss_score = engineer._form_decay(
            self._make_form_df(recent_losses), "team1", window=5
        )

        assert win_score > loss_score, "Winning form should score higher"

    def test_elo_updates_correctly(self):
        from services.feature_engineering import FootballFeatureEngineer
        engineer = FootballFeatureEngineer()

        row = pd.Series({"home_score": 2, "away_score": 0, "home_team_id": "A", "away_team_id": "B"})
        features = {}

        engineer._update_elo("A", "B", row, features)

        assert engineer.elo_ratings["A"] > 1500
        assert engineer.elo_ratings["B"] < 1500

    def test_head_to_head(self):
        from services.feature_engineering import FootballFeatureEngineer
        engineer = FootballFeatureEngineer()

        history = pd.DataFrame([
            {"home_team_id": "A", "away_team_id": "B", "home_score": 3, "away_score": 1},
            {"home_team_id": "B", "away_team_id": "A", "home_score": 2, "away_score": 2},
            {"home_team_id": "A", "away_team_id": "B", "home_score": 1, "away_score": 0},
        ])
        result = engineer._head_to_head(history, "A", "B")
        assert result["total"] == 3
        assert result["home_win_rate"] == 2 / 3

    def test_strength_of_schedule(self):
        from services.feature_engineering import FootballFeatureEngineer
        engineer = FootballFeatureEngineer()
        engineer.elo_ratings["B"] = 1600.0
        engineer.elo_ratings["C"] = 1400.0

        matches = pd.DataFrame([
            {"home_team_id": "A", "away_team_id": "B", "home_score": 1, "away_score": 1},
            {"home_team_id": "A", "away_team_id": "C", "home_score": 2, "away_score": 2},
        ])
        sos = engineer._strength_of_schedule(matches, "A", matches)
        assert sos == 1500.0

    @staticmethod
    def _make_form_df(results):
        data = []
        for i, r in enumerate(results):
            is_home = (i % 2 == 0)
            home_score = 1 if (is_home and r == "W") or (not is_home and r == "L") else 0
            away_score = 0 if (is_home and r == "W") or (not is_home and r == "L") else 1
            if r == "D":
                home_score = away_score = 1
            data.append({
                "utc_date": datetime.now() - timedelta(days=len(results) - i),
                "home_team_id": "team1" if is_home else "team2",
                "away_team_id": "team2" if is_home else "team1",
                "home_team_name": "Team 1" if is_home else "Team 2",
                "away_team_name": "Team 2" if is_home else "Team 1",
                "home_score": home_score,
                "away_score": away_score,
            })
        return pd.DataFrame(data)


class TestModelRegistry:
    def test_register_and_load(self):
        from models.registry import ModelRegistry
        import tempfile, os

        with tempfile.TemporaryDirectory() as tmp:
            registry = ModelRegistry(registry_path=tmp)
            dummy_model = {"type": "test", "coef": [1, 2, 3]}

            version = registry.register(
                model=dummy_model,
                name="test_model",
                sport="football",
                metrics={"val_accuracy": 0.65},
                params={"lr": 0.1},
            )
            assert version.startswith("v")

            loaded = registry.load_champion("test_model")
            assert loaded["type"] == "test"

            record = registry.get_champion_record("test_model")
            assert record is not None
            assert record.is_champion

    def test_champion_overwrite(self):
        from models.registry import ModelRegistry
        import tempfile

        with tempfile.TemporaryDirectory() as tmp:
            registry = ModelRegistry(registry_path=tmp)

            registry.register(model={"v": 1}, name="m", sport="f", metrics={"acc": 0.6}, params={}, make_champion=True)
            registry.register(model={"v": 2}, name="m", sport="f", metrics={"acc": 0.7}, params={}, make_champion=True)

            champion = registry.load_champion("m")
            assert champion["v"] == 2

            versions = registry.get_all_versions("m")
            assert len(versions) == 2

    def test_manifest_persistence(self):
        from models.registry import ModelRegistry
        import tempfile, json

        with tempfile.TemporaryDirectory() as tmp:
            registry = ModelRegistry(registry_path=tmp)
            registry.register(model={"x": 1}, name="p", sport="b", metrics={"acc": 0.8}, params={})

            manifest_path = Path(tmp) / "manifest.json"
            assert manifest_path.exists()

            with open(manifest_path) as f:
                data = json.load(f)
            assert len(data) > 0


class TestDataPreprocessor:
    def test_clean_matches_removes_invalid(self):
        from data.preprocessing import DataPreprocessor
        dp = DataPreprocessor()

        df = pd.DataFrame([
            {"home_score": 2, "away_score": 1, "utc_date": "2024-01-01"},
            {"home_score": -1, "away_score": 5, "utc_date": "2024-01-02"},
            {"home_score": None, "away_score": None, "utc_date": "2024-01-03"},
        ])
        cleaned = dp.clean_matches(df)
        assert len(cleaned) == 1

    def test_time_series_split_respects_order(self):
        from data.preprocessing import DataPreprocessor
        dp = DataPreprocessor(val_size=0.1, test_size=0.15)

        np.random.seed(42)
        n = 1000
        df = pd.DataFrame({
            "utc_date": pd.date_range("2024-01-01", periods=n, freq="D"),
            "feature": np.random.randn(n),
            "target": np.random.randint(0, 3, n),
        })

        splits = dp.time_series_split(df, ["feature"], n_splits=3)

        for X_tr, y_tr, X_val, y_val, X_te, y_te in splits:
            assert len(X_tr) > 0
            assert len(X_val) > 0
            assert len(X_te) > 0
            assert len(X_tr) > len(X_val)

    def test_create_target_football(self):
        from data.preprocessing import DataPreprocessor
        dp = DataPreprocessor()

        df = pd.DataFrame([
            {"home_score": 3, "away_score": 1},
            {"home_score": 1, "away_score": 1},
            {"home_score": 0, "away_score": 2},
        ])
        result = dp.create_target(df, sport="football")
        assert result["target"].tolist() == [0, 1, 2]


class TestEnsemble:
    def test_average_ensemble_reduces_variance(self):
        from models.ensemble import EnsemblePredictor

        np.random.seed(42)
        n = 200
        X = np.random.randn(n, 5)
        y = (X[:, 0] + X[:, 1] > 0).astype(int)

        split = n // 2
        X_train, X_val = X[:split], X[split:]
        y_train, y_val = y[:split], y[split:]

        from models.base import BasePredictor

        class DummyModel(BasePredictor):
            def __init__(self, noise=0.0):
                self.noise = noise
                self.feature_names = [f"f{i}" for i in range(5)]

            @property
            def name(self):
                return f"dummy_{self.noise}"

            def fit(self, X_tr, y_tr, X_v, y_v):
                return {"val_accuracy": 0.5}

            def predict_proba(self, X):
                preds = 0.5 + 0.1 * X[:, 0] + np.random.randn(len(X)) * self.noise
                return np.column_stack([1 - preds, preds])

            def predict(self, X):
                return (self.predict_proba(X)[:, 1] > 0.5).astype(int)

            def get_feature_importance(self):
                return None

            def save(self, p):
                pass

            def load(self, p):
                pass

        models = [DummyModel(noise=0.1), DummyModel(noise=0.2)]
        ensemble = EnsemblePredictor(models, method="average", n_classes=2)
        metrics = ensemble.fit(X_train, y_train, X_val, y_val)

        assert "ensemble" in metrics


class TestBedrock:
    """End-to-end test that exercises the full pipeline with synthetic data."""

    def test_synthetic_football_pipeline(self):
        from data.preprocessing import DataPreprocessor
        from services.feature_engineering import FootballFeatureEngineer
        from models.football.xgboost_model import FootballXGBoost
        from models.ensemble import EnsemblePredictor

        np.random.seed(42)
        n_matches = 500
        teams = [f"Team_{i}" for i in range(20)]

        matches = []
        for i in range(n_matches):
            home = np.random.choice(teams)
            away = np.random.choice([t for t in teams if t != home])
            home_goals = np.random.poisson(1.5)
            away_goals = np.random.poisson(1.2)
            matches.append({
                "utc_date": pd.Timestamp("2024-01-01") + pd.Timedelta(days=i),
                "home_team_id": home,
                "away_team_id": away,
                "home_team_name": home,
                "away_team_name": away,
                "home_score": home_goals,
                "away_score": away_goals,
            })

        df = pd.DataFrame(matches)
        dp = DataPreprocessor()
        df = dp.create_target(df)

        engineer = FootballFeatureEngineer()
        feature_df = engineer.build_features(df, is_training=True)
        feature_df = feature_df.dropna()

        assert len(feature_df) > 0

        feature_cols = [c for c in config.football_feature_columns if c in feature_df.columns]
        X = feature_df[feature_cols].values
        y = feature_df["target"].values

        split = int(len(X) * 0.8)
        X_tr, X_val = X[:split], X[split:]
        y_tr, y_val = y[:split], y[split:]

        xgb_model = FootballXGBoost()
        xgb_model.feature_names = feature_cols

        ensemble = EnsemblePredictor([xgb_model], method="average", n_classes=3)
        metrics = ensemble.fit(X_tr, y_tr, X_val, y_val)

        ensemble_metrics = metrics.get("ensemble", {})
        assert "val_accuracy" in ensemble_metrics


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
