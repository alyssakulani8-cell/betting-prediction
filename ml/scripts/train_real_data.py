"""
Standalone training script using real match data from the backend SQLite database.
Minimal dependencies: pandas, numpy, scikit-learn, xgboost.
"""

import sys, json, os
from pathlib import Path
sys.path.insert(0, str(Path(__file__).parent.parent))

import sqlite3
import numpy as np
import pandas as pd
from datetime import datetime, timezone
from collections import defaultdict

from config import config


def load_matches_from_backend() -> pd.DataFrame:
    db_path = Path(config.backend_db_path)
    if not db_path.exists():
        raise FileNotFoundError(f"Backend DB not found: {db_path}")

    conn = sqlite3.connect(str(db_path))
    query = """
        SELECT m.id, m.league_id, m.home_team_id, m.away_team_id,
               m.home_score, m.away_score, m.kickoff, m.season,
               ht.name AS home_team_name, at.name AS away_team_name,
               l.name AS competition
        FROM matches m
        LEFT JOIN teams ht ON ht.id = m.home_team_id
        LEFT JOIN teams at ON at.id = m.away_team_id
        LEFT JOIN leagues l ON l.id = m.league_id
        WHERE m.status = 'FINISHED'
          AND m.home_score IS NOT NULL
          AND m.away_score IS NOT NULL
          AND l.sport = 'football'
        ORDER BY m.kickoff ASC
    """
    df = pd.read_sql_query(query, conn)
    conn.close()

    df["kickoff"] = pd.to_numeric(df["kickoff"], errors="coerce")
    df["utc_date"] = pd.to_datetime(df["kickoff"] / 1000, unit="s", utc=True)
    df["home_score"] = pd.to_numeric(df["home_score"], errors="coerce")
    df["away_score"] = pd.to_numeric(df["away_score"], errors="coerce")
    df = df.dropna(subset=["home_score", "away_score"]).reset_index(drop=True)

    return df


def engineer_features(df: pd.DataFrame) -> pd.DataFrame:
    """Build feature matrix with ELO, rolling stats, and form."""
    elo = defaultdict(lambda: 1500.0)
    k_factor = 32.0
    rows = []

    for i in range(len(df)):
        row = df.iloc[i]
        home_id = row["home_team_id"]
        away_id = row["away_team_id"]
        home_name = row["home_team_name"]
        away_name = row["away_team_name"]

        history = df.iloc[:i]

        f = {}

        f["elo_home"] = elo[home_id]
        f["elo_away"] = elo[away_id]
        f["elo_diff"] = elo[home_id] - elo[away_id]

        def team_matches(hist, tid):
            return hist[(hist["home_team_id"] == tid) | (hist["away_team_id"] == tid)]

        def win_rate(matches, tid, n):
            subset = matches.tail(n)
            if len(subset) == 0:
                return 0.5
            wins = sum(
                1 for _, m in subset.iterrows()
                if (m["home_team_id"] == tid and m["home_score"] > m["away_score"])
                or (m["away_team_id"] == tid and m["away_score"] > m["home_score"])
            )
            return wins / len(subset)

        def avg_goals(matches, tid, n, scored=True):
            subset = matches.tail(n)
            if len(subset) == 0:
                return 1.5
            goals = []
            for _, m in subset.iterrows():
                if m["home_team_id"] == tid:
                    goals.append(m["home_score"] if scored else m["away_score"])
                else:
                    goals.append(m["away_score"] if scored else m["home_score"])
            return np.mean(goals) if goals else 1.5

        mh = team_matches(history, home_id)
        ma = team_matches(history, away_id)

        f["home_win_rate_10"] = win_rate(mh, home_id, 10)
        f["away_win_rate_10"] = win_rate(ma, away_id, 10)
        f["home_win_rate_38"] = win_rate(mh, home_id, 38)
        f["away_win_rate_38"] = win_rate(ma, away_id, 38)
        f["home_avg_goals_scored_10"] = avg_goals(mh, home_id, 10, scored=True)
        f["away_avg_goals_scored_10"] = avg_goals(ma, away_id, 10, scored=True)
        f["home_avg_goals_conceded_10"] = avg_goals(mh, home_id, 10, scored=False)
        f["away_avg_goals_conceded_10"] = avg_goals(ma, away_id, 10, scored=False)

        f["target"] = (
            0 if row["home_score"] > row["away_score"]
            else 1 if row["home_score"] == row["away_score"]
            else 2
        )

        rows.append(f)

        # Update ELO after match
        home_goals = row["home_score"]
        away_goals = row["away_score"]
        if home_goals > away_goals:
            home_result, away_result = 1.0, 0.0
        elif home_goals == away_goals:
            home_result, away_result = 0.5, 0.5
        else:
            home_result, away_result = 0.0, 1.0

        expected_home = 1 / (1 + 10 ** ((elo[away_id] - elo[home_id]) / 400))
        expected_away = 1 - expected_home
        goal_diff = abs(home_goals - away_goals)
        margin = np.log(max(goal_diff, 1) + 1)

        elo[home_id] += k_factor * margin * (home_result - expected_home)
        elo[away_id] += k_factor * margin * (away_result - expected_away)

    return pd.DataFrame(rows)


def main():
    print("=" * 60)
    print(f"REAL DATA TRAINING - {datetime.now().isoformat()}")
    print("=" * 60)

    print("\n1. Loading matches from backend database...")
    df = load_matches_from_backend()
    print(f"   Loaded {len(df)} finished matches")
    print(f"   Competitions: {sorted(df['competition'].unique())}")
    print(f"   Date range: {df['utc_date'].min()} to {df['utc_date'].max()}")

    target_dist = df.apply(
        lambda r: "H" if r.home_score > r.away_score else ("D" if r.home_score == r.away_score else "A"),
        axis=1
    ).value_counts()
    print(f"   Target distribution: H={target_dist.get('H', 0)}, D={target_dist.get('D', 0)}, A={target_dist.get('A', 0)}")

    print("\n2. Engineering features...")
    feature_df = engineer_features(df)
    print(f"   Feature shape: {feature_df.shape}")
    print(f"   Columns: {list(feature_df.columns)}")

    feature_df = feature_df.dropna()
    print(f"   After dropna: {feature_df.shape}")

    from sklearn.model_selection import TimeSeriesSplit
    from sklearn.metrics import accuracy_score, log_loss
    import xgboost as xgb

    feature_cols = [c for c in config.football_feature_columns if c in feature_df.columns]
    print(f"\n   Using {len(feature_cols)} features: {feature_cols[:5]}...")

    X = feature_df[feature_cols].values
    y = feature_df["target"].values

    print(f"\n3. Time-series cross-validation ({config.n_folds} folds)...")
    tscv = TimeSeriesSplit(n_splits=config.n_folds)
    fold_scores = []
    fold_logloss = []

    for fold, (train_idx, test_idx) in enumerate(tscv.split(X)):
        X_tr, X_te = X[train_idx], X[test_idx]
        y_tr, y_te = y[train_idx], y[test_idx]

        model = xgb.XGBClassifier(
            objective="multi:softprob",
            num_class=3,
            eval_metric=["mlogloss", "merror"],
            max_depth=6,
            learning_rate=0.05,
            subsample=0.8,
            colsample_bytree=0.8,
            min_child_weight=3,
            gamma=0.1,
            reg_alpha=0.1,
            reg_lambda=1.0,
            n_estimators=500,
            early_stopping_rounds=30,
            random_state=42,
            verbosity=0,
        )
        model.fit(
            X_tr, y_tr,
            eval_set=[(X_te, y_te)],
            verbose=False,
        )

        y_pred = model.predict(X_te)
        y_prob = model.predict_proba(X_te)
        acc = accuracy_score(y_te, y_pred)
        ll = log_loss(y_te, y_prob)
        fold_scores.append(acc)
        fold_logloss.append(ll)
        print(f"   Fold {fold + 1}: accuracy={acc:.4f}, log_loss={ll:.4f}, train={len(X_tr)}, test={len(X_te)}")

    mean_acc = np.mean(fold_scores)
    std_acc = np.std(fold_scores)
    print(f"\n   CV Accuracy: {mean_acc:.4f} +/- {std_acc:.4f}")
    print(f"   CV LogLoss: {np.mean(fold_logloss):.4f}")

    # Train final model on all data
    print("\n4. Training final model on all data...")
    final_model = xgb.XGBClassifier(
        objective="multi:softprob",
        num_class=3,
        eval_metric=["mlogloss", "merror"],
        max_depth=6,
        learning_rate=0.05,
        subsample=0.8,
        colsample_bytree=0.8,
        min_child_weight=3,
        gamma=0.1,
        reg_alpha=0.1,
        reg_lambda=1.0,
        n_estimators=500,
        random_state=42,
        verbosity=0,
    )
    final_model.fit(X, y)

    # Save model and artifacts
    from joblib import dump

    registry_dir = Path(config.registry_path) / "football_ensemble"
    registry_dir.mkdir(parents=True, exist_ok=True)

    model_path = registry_dir / "xgb_real_data.pkl"
    feature_list_path = registry_dir / "feature_columns.json"

    dump(final_model, model_path)
    with open(feature_list_path, "w") as f:
        json.dump(feature_cols, f)

    # Register as champion
    champion_path = registry_dir / "champion.pkl"
    import shutil
    shutil.copy2(model_path, champion_path)

    # Create manifest
    manifest = registry_dir / "manifest.json"
    history = []
    if manifest.exists():
        with open(manifest) as f:
            history = json.load(f)

    version = f"v{datetime.now().strftime('%Y%m%d_%H%M%S')}"
    entry = {
        "version": version,
        "timestamp": datetime.now().isoformat(),
        "sport": "football",
        "model": "xgboost_real_data",
        "metrics": {
            "val_accuracy_mean": float(mean_acc),
            "val_accuracy_std": float(std_acc),
        },
        "feature_columns": feature_cols,
        "training_samples": len(feature_df),
        "source": "backend_db",
    }
    history.append(entry)
    with open(manifest, "w") as f:
        json.dump(history, f, indent=2)

    print(f"\n5. Model saved!")
    print(f"   Version: {version}")
    print(f"   Path: {model_path}")
    print(f"   Champion: {champion_path}")
    print(f"   CV Accuracy: {mean_acc:.4f} +/- {std_acc:.4f}")
    print(f"   Training samples: {len(feature_df)}")
    print(f"\n{'=' * 60}")
    print(f"TRAINING COMPLETE")
    print(f"{'=' * 60}")


if __name__ == "__main__":
    main()
