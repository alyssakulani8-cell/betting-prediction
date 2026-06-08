"""
Data preprocessing: cleaning, validation, train/val/test splits with
time-series awareness, and feature scaling.
"""

from typing import Tuple, Optional, List
import numpy as np
import pandas as pd
from sklearn.preprocessing import StandardScaler
from sklearn.model_selection import TimeSeriesSplit


class DataPreprocessor:
    def __init__(self, val_size: float = 0.10, test_size: float = 0.15):
        self.val_size = val_size
        self.test_size = test_size
        self.scaler = StandardScaler()
        self._fitted = False

    def clean_matches(self, df: pd.DataFrame) -> pd.DataFrame:
        """Remove invalid rows and ensure required columns exist."""
        df = df.copy()

        df = df.replace([np.inf, -np.inf], np.nan)
        df = df.dropna(how="all")

        date_col = "utc_date" if "utc_date" in df.columns else "date"
        if date_col in df.columns:
            df[date_col] = pd.to_datetime(df[date_col], errors="coerce")
            df = df.dropna(subset=[date_col])
            df = df.sort_values(date_col)

        score_cols = [c for c in ["home_score", "away_score"] if c in df.columns]
        if score_cols:
            df[score_cols] = df[score_cols].apply(pd.to_numeric, errors="coerce")
            df = df.dropna(subset=score_cols)
            df = df[(df[score_cols] >= 0).all(axis=1)]

        for col in df.columns:
            if df[col].dtype in ("float64", "int64"):
                upper = df[col].quantile(0.999)
                df[col] = df[col].clip(None, upper)

        return df.reset_index(drop=True)

    def create_target(self, df: pd.DataFrame, sport: str = "football") -> pd.DataFrame:
        """Create target column based on match outcome."""
        df = df.copy()

        if sport == "football":
            df["target_home_win"] = (df["home_score"] > df["away_score"]).astype(int)
            df["target_draw"] = (df["home_score"] == df["away_score"]).astype(int)
            df["target_away_win"] = (df["home_score"] < df["away_score"]).astype(int)
            df["target"] = df["target_home_win"] * 0 + df["target_draw"] * 1 + df["target_away_win"] * 2
            df["target_score_home"] = df["home_score"]
            df["target_score_away"] = df["away_score"]
        elif sport == "basketball":
            df["target_home_win"] = (df["home_score"] > df["away_score"]).astype(int)
            df["target_away_win"] = (df["home_score"] < df["away_score"]).astype(int)
            df["target"] = df["target_home_win"]
            df["target_score_home"] = df["home_score"]
            df["target_score_away"] = df["away_score"]

        return df

    def time_series_split(
        self,
        df: pd.DataFrame,
        feature_cols: List[str],
        n_splits: int = 5,
    ) -> List[Tuple[np.ndarray, np.ndarray, np.ndarray]]:
        """
        Generate time-series aware train/val/test splits.
        Each split: train = past, val = recent past, test = future.
        """
        date_col = "utc_date" if "utc_date" in df.columns else "date"
        df = df.sort_values(date_col).reset_index(drop=True)

        n = len(df)
        test_start = int(n * (1 - self.test_size))
        val_start = int(test_start * (1 - self.val_size))

        tscv = TimeSeriesSplit(n_splits=n_splits, test_size=int(n * 0.1))

        splits = []
        for train_idx, test_idx in tscv.split(df):
            train_df = df.iloc[train_idx]
            test_df = df.iloc[test_idx]

            val_cut = int(len(train_df) * (1 - self.val_size))
            val_idx = train_idx[val_cut:]
            train_idx = train_idx[:val_cut]

            splits.append((
                df.iloc[train_idx][feature_cols].values,
                df.iloc[train_idx]["target"].values,
                df.iloc[val_idx][feature_cols].values,
                df.iloc[val_idx]["target"].values,
                df.iloc[test_idx][feature_cols].values,
                df.iloc[test_idx]["target"].values,
            ))

        return splits

    def fit_scaler(self, X_train: np.ndarray):
        self.scaler.fit(X_train)
        self._fitted = True

    def transform(self, X: np.ndarray) -> np.ndarray:
        if not self._fitted:
            raise RuntimeError("Scaler not fitted. Call fit_scaler first.")
        return self.scaler.transform(X)

    def fit_transform(self, X_train: np.ndarray, X_val: np.ndarray, X_test: np.ndarray):
        self.fit_scaler(X_train)
        return (
            self.transform(X_train),
            self.transform(X_val),
            self.transform(X_test),
        )
