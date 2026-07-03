"""
Train an XGBoost model using football-data.co.uk CSV data (48,665 matches).
Uses optimized sequential feature engineering to avoid O(n²) slowdown.
"""

import sys, json, shutil
from pathlib import Path
sys.path.insert(0, str(Path(__file__).parent.parent))

import numpy as np
import pandas as pd
from datetime import datetime
from collections import defaultdict, deque

from config import config
from services.team_names import normalize


def load_combined_data() -> pd.DataFrame:
    csv_path = Path("data/raw/football-data-uk/all_matches.csv")
    if not csv_path.exists():
        raise FileNotFoundError(f"CSV data not found: {csv_path}")

    df = pd.read_csv(csv_path)
    df = df.rename(columns={
        "home_team_name": "home_team",
        "away_team_name": "away_team",
    })
    df["utc_date"] = pd.to_datetime(df["utc_date"], errors="coerce")
    df = df.dropna(subset=["utc_date"])
    df["home_score"] = pd.to_numeric(df["home_score"], errors="coerce")
    df["away_score"] = pd.to_numeric(df["away_score"], errors="coerce")
    df = df.dropna(subset=["home_score", "away_score"])
    df = df.sort_values("utc_date").reset_index(drop=True)

    db_path = Path(config.backend_db_path)
    if db_path.exists():
        import sqlite3
        conn = sqlite3.connect(str(db_path))
        query = """
            SELECT m.home_score, m.away_score, m.kickoff,
                   ht.name AS home_team, at.name AS away_team,
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
        backend_df = pd.read_sql_query(query, conn)
        conn.close()

        backend_df["utc_date"] = pd.to_datetime(backend_df["kickoff"] / 1000, unit="s", utc=True)
        backend_df["home_score"] = pd.to_numeric(backend_df["home_score"], errors="coerce")
        backend_df["away_score"] = pd.to_numeric(backend_df["away_score"], errors="coerce")
        backend_df = backend_df.dropna(subset=["home_score", "away_score"])
        backend_df = backend_df.drop(columns=["kickoff"])

        df = pd.concat([df, backend_df], ignore_index=True)
        df = df.drop_duplicates(subset=["utc_date", "home_team", "away_team"])
        df = df.sort_values("utc_date").reset_index(drop=True)

    print(f"[Data] {len(df)} matches, {df['utc_date'].min()} -> {df['utc_date'].max()}")
    return df


def engineer_features_fast(df: pd.DataFrame) -> pd.DataFrame:
    """O(n) feature engineering using per-team match deques."""
    team_history = defaultdict(lambda: deque(maxlen=50))
    elo = defaultdict(lambda: 1500.0)
    k_factor = 32.0

    rows = []

    for i in range(len(df)):
        row = df.iloc[i]
        home = normalize(str(row["home_team"]))
        away = normalize(str(row["away_team"]))
        home_goals = int(row["home_score"])
        away_goals = int(row["away_score"])

        f = {}

        f["elo_home"] = elo[home]
        f["elo_away"] = elo[away]
        f["elo_diff"] = elo[home] - elo[away]

        def win_rate(team, n):
            hist = list(team_history[team])
            if not hist:
                return 0.5
            recent = hist[-n:]
            if not recent:
                return 0.5
            wins = sum(
                1 for h in recent
                if (h[0] == team and h[2] > h[3]) or (h[1] == team and h[3] > h[2])
            )
            return wins / len(recent)

        def avg_scored(team, n):
            hist = list(team_history[team])
            if not hist:
                return 1.5
            recent = hist[-n:]
            if not recent:
                return 1.5
            goals = [h[2] if h[0] == team else h[3] for h in recent]
            return float(np.mean(goals)) if goals else 1.5

        def avg_conceded(team, n):
            hist = list(team_history[team])
            if not hist:
                return 1.5
            recent = hist[-n:]
            if not recent:
                return 1.5
            goals = [h[3] if h[0] == team else h[2] for h in recent]
            return float(np.mean(goals)) if goals else 1.5

        f["home_win_rate_10"] = win_rate(home, 10)
        f["away_win_rate_10"] = win_rate(away, 10)
        f["home_win_rate_38"] = win_rate(home, 38)
        f["away_win_rate_38"] = win_rate(away, 38)
        f["home_avg_goals_scored_10"] = avg_scored(home, 10)
        f["away_avg_goals_scored_10"] = avg_scored(away, 10)
        f["home_avg_goals_conceded_10"] = avg_conceded(home, 10)
        f["away_avg_goals_conceded_10"] = avg_conceded(away, 10)

        # Use odds if available
        if "odds_home" in row and pd.notna(row.get("odds_home")):
            f["odds_home"] = row["odds_home"]
            f["odds_draw"] = row.get("odds_draw", np.nan)
            f["odds_away"] = row.get("odds_away", np.nan)
            f["odds_movement_home"] = row.get("odds_movement_home", 0.0)
            f["odds_movement_draw"] = row.get("odds_movement_draw", 0.0)
            f["odds_movement_away"] = row.get("odds_movement_away", 0.0)
            f["market_volume"] = row.get("bookmaker_count", 0)

        f["target"] = 0 if home_goals > away_goals else (1 if home_goals == away_goals else 2)

        rows.append(f)

        # Update ELO
        if home_goals > away_goals:
            home_result, away_result = 1.0, 0.0
        elif home_goals == away_goals:
            home_result, away_result = 0.5, 0.5
        else:
            home_result, away_result = 0.0, 1.0

        expected_home = 1.0 / (1.0 + 10.0 ** ((elo[away] - elo[home]) / 400.0))
        expected_away = 1.0 - expected_home

        goal_diff = abs(home_goals - away_goals)
        margin = np.log(max(goal_diff, 1) + 1)

        elo[home] += k_factor * margin * (home_result - expected_home)
        elo[away] += k_factor * margin * (away_result - expected_away)

        # Store match for future rolling features
        team_history[home].append((home, away, home_goals, away_goals))
        team_history[away].append((home, away, home_goals, away_goals))

        if (i + 1) % 10000 == 0:
            print(f"   Engineered {i + 1}/{len(df)} matches...", flush=True)

    print(f"   Done engineering {len(rows)} matches")
    return pd.DataFrame(rows), dict(elo)


def main():
    print("=" * 60)
    print(f"CSV DATA TRAINING - {datetime.now().isoformat()}")
    print("=" * 60)

    print("\n1. Loading match data...")
    df = load_combined_data()
    print(f"   Competitions: {sorted(df['competition'].unique())}")

    target_dist = df.apply(
        lambda r: "H" if r.home_score > r.away_score else ("D" if r.home_score == r.away_score else "A"),
        axis=1
    ).value_counts()
    print(f"   Target: H={target_dist.get('H', 0)}, D={target_dist.get('D', 0)}, A={target_dist.get('A', 0)}")

    print("\n2. Engineering features (optimized sequential)...")
    feature_df, elo_state = engineer_features_fast(df)
    print(f"   Feature shape: {feature_df.shape}")
    print(f"   Teams in ELO state: {len(elo_state)}")

    core_cols = [
        "elo_home", "elo_away", "elo_diff",
        "home_win_rate_10", "away_win_rate_10",
        "home_win_rate_38", "away_win_rate_38",
        "home_avg_goals_scored_10", "away_avg_goals_scored_10",
        "home_avg_goals_conceded_10", "away_avg_goals_conceded_10",
    ]
    use_cols = [c for c in core_cols if c in feature_df.columns]

    feature_df = feature_df.dropna(subset=use_cols + ["target"])
    print(f"   After dropna: {feature_df.shape}")

    X = feature_df[use_cols].values
    y = feature_df["target"].values

    from sklearn.model_selection import TimeSeriesSplit
    from sklearn.metrics import accuracy_score, log_loss
    import xgboost as xgb

    print(f"\n3. Time-series CV ({config.n_folds} folds)...")
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
            n_estimators=800,
            early_stopping_rounds=30,
            random_state=42,
            verbosity=0,
        )
        model.fit(X_tr, y_tr, eval_set=[(X_te, y_te)], verbose=False)

        y_pred = model.predict(X_te)
        y_prob = model.predict_proba(X_te)
        acc = accuracy_score(y_te, y_pred)
        ll = log_loss(y_te, y_prob)
        fold_scores.append(acc)
        fold_logloss.append(ll)
        print(f"   Fold {fold + 1}: acc={acc:.4f}, log_loss={ll:.4f}, train={len(X_tr)}, test={len(X_te)}")

    mean_acc = np.mean(fold_scores)
    std_acc = np.std(fold_scores)
    print(f"\n   CV Accuracy: {mean_acc:.4f} +/- {std_acc:.4f}")
    print(f"   CV LogLoss: {np.mean(fold_logloss):.4f}")

    print("\n4. Training final model on ALL data...")
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
        n_estimators=800,
        random_state=42,
        verbosity=0,
    )
    final_model.fit(X, y)

    from joblib import dump

    registry_dir = Path(config.registry_path) / "football_ensemble"
    registry_dir.mkdir(parents=True, exist_ok=True)

    model_path = registry_dir / "xgb_csv_data.pkl"
    champion_path = registry_dir / "champion.pkl"
    feature_list_path = registry_dir / "feature_columns.json"
    elo_path = registry_dir / "elo_state.json"

    dump(final_model, model_path)
    shutil.copy2(model_path, champion_path)

    with open(feature_list_path, "w") as f:
        json.dump(use_cols, f)

    with open(elo_path, "w") as f:
        json.dump(elo_state, f, indent=2)

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
        "model": "xgboost_csv_data",
        "metrics": {
            "val_accuracy_mean": float(mean_acc),
            "val_accuracy_std": float(std_acc),
        },
        "feature_columns": use_cols,
        "training_samples": len(feature_df),
        "source": "football-data.co.uk + backend",
        "elo_teams": len(elo_state),
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
    print(f"   Teams in ELO state: {len(elo_state)}")
    print(f"\n{'=' * 60}")
    print(f"TRAINING COMPLETE")
    print(f"{'=' * 60}")


if __name__ == "__main__":
    main()
