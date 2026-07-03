"""
Train ML models using synthetic data.
Generates realistic match data, trains XGBoost + CatBoost + Neural Net ensemble,
and registers the champion model.
"""

import sys
from pathlib import Path
sys.path.append(str(Path(__file__).parent.parent))

import numpy as np
import pandas as pd
from datetime import datetime
import warnings
warnings.filterwarnings("ignore")

from config import config
from data.preprocessing import DataPreprocessor
from services.feature_engineering import FootballFeatureEngineer
from models.football.xgboost_model import FootballXGBoost
from models.football.catboost_model import FootballCatBoost
from models.football.neural_net import FootballNeuralNet
from models.ensemble import EnsemblePredictor
from models.registry import ModelRegistry

print("=" * 60)
print("AI Betting Prediction - Model Training")
print("=" * 60)

print("\nGenerating synthetic match data (2 seasons for speed)...")
from scripts.generate_synthetic_data import generate_dataset
df = generate_dataset(["2023", "2024"])

print("\nPreprocessing data...")
preprocessor = DataPreprocessor(val_size=0.10, test_size=0.15)
df = preprocessor.clean_matches(df)
df = preprocessor.create_target(df, sport="football")
print(f"  Cleaned matches: {len(df)}")
print(f"  Class distribution:")
print(f"    Home win: {(df['target'] == 0).mean():.3f}")
print(f"    Draw:     {(df['target'] == 1).mean():.3f}")
print(f"    Away win: {(df['target'] == 2).mean():.3f}")

print("\nEngineering features...")
engineer = FootballFeatureEngineer()
feature_df = engineer.build_features(df, is_training=True)
feature_df = feature_df.dropna()
feature_df["utc_date"] = df.loc[feature_df.index, "utc_date"].values
print(f"  Feature matrix: {feature_df.shape}")

available_features = [c for c in config.football_feature_columns if c in feature_df.columns]
print(f"  Features used: {len(available_features)}")
for f in available_features[:10]:
    print(f"    - {f}")
if len(available_features) > 10:
    print(f"    ... and {len(available_features) - 10} more")

X = feature_df[available_features].values
y = feature_df["target"].values

splits = preprocessor.time_series_split(feature_df, available_features)
print(f"\nTime-series CV splits: {len(splits)}")

all_metrics = []
best_models = []

for fold, (X_tr, y_tr, X_val, y_val, X_te, y_te) in enumerate(splits):
    print(f"\n--- Fold {fold + 1}/{len(splits)} ---")
    print(f"  Train: {len(X_tr)}, Val: {len(X_val)}, Test: {len(X_te)}")

    X_tr_s, X_val_s, X_te_s = preprocessor.fit_transform(X_tr, X_val, X_te)

    xgb = FootballXGBoost()
    xgb.feature_names = available_features
    xgb.fit(X_tr_s, y_tr, X_val_s, y_val)
    xgb_acc = (xgb.predict(X_te_s) == y_te).mean()
    print(f"  XGBoost test accuracy: {xgb_acc:.4f}")

    cat = FootballCatBoost()
    cat.feature_names = available_features
    cat.fit(X_tr_s, y_tr, X_val_s, y_val)
    cat_acc = (cat.predict(X_te_s) == y_te).mean()
    print(f"  CatBoost test accuracy: {cat_acc:.4f}")

    nn = FootballNeuralNet(input_dim=X_tr_s.shape[1])
    nn.feature_names = available_features
    nn.fit(X_tr_s, y_tr, X_val_s, y_val)
    nn_acc = (nn.predict(X_te_s) == y_te).mean()
    print(f"  Neural Net test accuracy: {nn_acc:.4f}")

    ensemble = EnsemblePredictor(
        base_models=[xgb, cat, nn],
        method="stacking",
        n_classes=3,
    )
    metrics = ensemble.fit(X_tr_s, y_tr, X_val_s, y_val)
    all_metrics.append(metrics)

    test_probas = ensemble.predict_proba(X_te_s)
    test_preds = test_probas.argmax(axis=1)
    test_acc = np.mean(test_preds == y_te)
    print(f"  Ensemble test accuracy: {test_acc:.4f}")

    best_models.append(ensemble)

fold_scores = [m.get("ensemble", {}).get("val_accuracy", 0) for m in all_metrics]
best_fold = int(np.argmax(fold_scores))
champion = best_models[best_fold]
print(f"\nBest fold: {best_fold + 1} (val_acc: {fold_scores[best_fold]:.4f})")

final_metrics = {
    "val_accuracy_mean": float(np.mean(fold_scores)),
    "val_accuracy_std": float(np.std(fold_scores)),
}

feature_imp = champion.get_feature_importance()
if feature_imp:
    feature_imp = dict(zip(available_features, list(feature_imp.values())[:len(available_features)]))

print("\nRegistering champion model...")
registry = ModelRegistry(registry_path=config.registry_path)
version = registry.register(
    model=champion,
    name="football_ensemble",
    sport="football",
    metrics=final_metrics,
    params={"source": "synthetic", "seasons": ["2022", "2023", "2024", "2025"]},
    feature_importance=feature_imp,
    training_samples=len(df),
    make_champion=True,
)

print(f"\n✅ Champion model registered: {version}")
print(f"   Final validation accuracy: {final_metrics['val_accuracy_mean']:.4f} ± {final_metrics['val_accuracy_std']:.4f}")
print(f"   Training samples: {len(df)}")

print("\nFeature importance (top 10):")
if feature_imp:
    sorted_imp = sorted(feature_imp.items(), key=lambda x: x[1], reverse=True)
    for name, imp in sorted_imp[:10]:
        print(f"  {name}: {imp:.4f}")
