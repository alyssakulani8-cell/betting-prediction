"""
Time-series backtesting framework that simulates predictions over historical
data and computes betting performance metrics:
- Accuracy, Brier score, Log loss
- ROI (Return on Investment)
- Sharpe ratio
- Maximum drawdown
- Kelly criterion optimal stake
- Confusion matrix
- Coverage by confidence threshold
"""

import sys
from pathlib import Path
sys.path.append(str(Path(__file__).parent.parent))

import argparse
import numpy as np
import pandas as pd
from datetime import datetime
from typing import Optional, List, Tuple
from dataclasses import dataclass

from config import config
from data.orchestrator import DataOrchestrator
from data.preprocessing import DataPreprocessor
from services.feature_engineering import FootballFeatureEngineer, BasketballFeatureEngineer
from models.registry import ModelRegistry


@dataclass
class BacktestResult:
    total_bets: int
    wins: int
    losses: int
    accuracy: float
    brier_score: float
    log_loss: float
    roi: float
    total_stake: float
    total_return: float
    sharpe_ratio: float
    max_drawdown: float
    kelly_fraction: float
    profit_by_confidence: dict
    confusion_matrix: np.ndarray
    average_odds: float


class BacktestEngine:
    def __init__(self, sport: str = "football", initial_bankroll: float = 1000.0):
        self.sport = sport
        self.initial_bankroll = initial_bankroll
        self.orchestrator = DataOrchestrator()
        self.preprocessor = DataPreprocessor()
        self.registry = ModelRegistry(registry_path=config.registry_path)
        self.feature_cols = (
            config.football_feature_columns
            if sport == "football"
            else config.basketball_feature_columns
        )

    def run(
        self,
        seasons: Optional[List[str]] = None,
        stake_per_bet: float = 0.02,
        min_confidence: float = 0.0,
        use_kelly: bool = False,
    ) -> BacktestResult:
        champion = self.registry.load_champion(f"{self.sport}_ensemble")
        if champion is None:
            raise RuntimeError(f"No champion model found for {self.sport}. Run training first.")

        record = self.registry.get_champion_record(f"{self.sport}_ensemble")
        print(f"Backtesting champion: {record.version if record else 'unknown'}")

        print(f"Fetching {self.sport} data for backtest...")
        if self.sport == "football":
            df = self.orchestrator.fetch_football_dataset(
                seasons=seasons or ["2023", "2024"],
            )
        else:
            df = self.orchestrator.fetch_basketball_dataset(
                season=seasons[0] if seasons else "2024",
            )

        df = self.preprocessor.clean_matches(df)
        df = self.preprocessor.create_target(df, sport=self.sport)

        print(f"Engineering features for {len(df)} matches...")
        if self.sport == "football":
            engineer = FootballFeatureEngineer()
        else:
            engineer = BasketballFeatureEngineer()
        feature_df = engineer.build_features(df, is_training=False)

        feature_df = feature_df.dropna()
        available_features = [c for c in self.feature_cols if c in feature_df.columns]
        X = feature_df[available_features].values
        y = feature_df["target"].values

        print(f"Generating predictions for {len(X)} matches...")
        probas = champion.predict_proba(X)

        if self.sport == "football":
            preds = probas.argmax(axis=1)
            home_win_probs = probas[:, 0]
        else:
            preds = (probas[:, 1] > 0.5).astype(int)
            home_win_probs = probas[:, 1]

        results = self._simulate_bets(
            y, probas, preds, home_win_probs, df,
            stake_per_bet, min_confidence, use_kelly,
        )

        return results

    def _simulate_bets(
        self,
        y_true: np.ndarray,
        probas: np.ndarray,
        preds: np.ndarray,
        home_win_probs: np.ndarray,
        df: pd.DataFrame,
        stake_per_bet: float,
        min_confidence: float,
        use_kelly: bool,
    ) -> BacktestResult:
        bankroll = self.initial_bankroll
        total_stake = 0.0
        total_return = 0.0
        wins = 0
        losses = 0
        bets_placed = 0
        peak_bankroll = bankroll
        max_drawdown = 0.0
        returns = []
        profit_by_conf = {"low": 0, "medium": 0, "high": 0}
        conf_counts = {"low": 0, "medium": 0, "high": 0}

        n_classes = probas.shape[1]

        for i in range(len(y_true)):
            if n_classes == 3:
                confidence = probas[i].max()
            else:
                confidence = max(probas[i, 1], 1 - probas[i, 1])

            if confidence < min_confidence:
                continue

            odds = self._get_odds(df, i, preds[i], n_classes)
            if odds is None or odds < 1.01:
                continue

            if use_kelly:
                p = probas[i, preds[i]]
                q = 1.0 - p
                b = odds - 1.0
                kelly = (p * b - q) / b
                stake = max(0, min(bankroll * kelly * 0.25, bankroll * 0.1))
            else:
                stake = bankroll * stake_per_bet

            if stake <= 0:
                continue

            correct = preds[i] == y_true[i]
            bets_placed += 1
            total_stake += stake

            if correct:
                profit = stake * (odds - 1.0)
                bankroll += profit
                total_return += profit
                wins += 1
                returns.append(profit / stake)
            else:
                bankroll -= stake
                total_return -= stake
                losses += 1
                returns.append(-1.0)

            if bankroll < 0:
                break

            peak_bankroll = max(peak_bankroll, bankroll)
            dd = (peak_bankroll - bankroll) / peak_bankroll
            max_drawdown = max(max_drawdown, dd)

            if confidence >= 0.7:
                profit_by_conf["high"] += profit if correct else -stake
                conf_counts["high"] += 1
            elif confidence >= 0.55:
                profit_by_conf["medium"] += profit if correct else -stake
                conf_counts["medium"] += 1
            else:
                profit_by_conf["low"] += profit if correct else -stake
                conf_counts["low"] += 1

        total = len(y_true)
        accuracy = np.mean(preds == y_true)
        brier = np.mean(np.sum((probas - np.eye(n_classes)[y_true]) ** 2, axis=1))
        logloss = self._log_loss(y_true, probas)

        roi = ((total_return / total_stake) * 100) if total_stake > 0 else 0.0
        avg_return = np.mean(returns) if returns else 0.0
        std_return = np.std(returns) if returns else 1.0
        sharpe = (avg_return / std_return * np.sqrt(252)) if std_return > 0 else 0.0

        confusion = np.zeros((n_classes, n_classes), dtype=int)
        for t, p in zip(y_true, preds):
            confusion[t, p] += 1

        avg_odds = self._average_odds(df, n_classes)

        for key in profit_by_conf:
            if conf_counts[key] > 0:
                profit_by_conf[key] = round(profit_by_conf[key] / conf_counts[key], 2)
            else:
                profit_by_conf[key] = 0.0

        return BacktestResult(
            total_bets=bets_placed,
            wins=wins,
            losses=losses,
            accuracy=float(accuracy),
            brier_score=float(brier),
            log_loss=float(logloss),
            roi=float(roi),
            total_stake=float(total_stake),
            total_return=float(total_return),
            sharpe_ratio=float(sharpe),
            max_drawdown=float(max_drawdown),
            kelly_fraction=float(wins / bets_placed) if bets_placed > 0 else 0.0,
            profit_by_confidence=profit_by_conf,
            confusion_matrix=confusion,
            average_odds=float(avg_odds),
        )

    def _get_odds(self, df, idx, prediction, n_classes) -> Optional[float]:
        if "odds_home" not in df.columns and "odds_away" not in df.columns:
            return 2.0
        if n_classes == 3:
            if prediction == 0:
                return df.iloc[idx].get("odds_home")
            elif prediction == 1:
                return df.iloc[idx].get("odds_draw")
            else:
                return df.iloc[idx].get("odds_away")
        else:
            return df.iloc[idx].get("odds_home" if prediction == 1 else "odds_away")

    def _average_odds(self, df, n_classes) -> float:
        odds_cols = ["odds_home"]
        if n_classes == 3:
            odds_cols.append("odds_draw")
        odds_cols.append("odds_away")

        vals = []
        for col in odds_cols:
            if col in df.columns:
                vals.extend(df[col].dropna().tolist())
        return np.mean(vals) if vals else 2.0

    @staticmethod
    def _log_loss(y_true, y_pred, eps=1e-15):
        y_pred = np.clip(y_pred, eps, 1 - eps)
        n = len(y_true)
        loss = -np.sum(np.eye(y_pred.shape[1])[y_true] * np.log(y_pred)) / n
        return loss


def print_report(result: BacktestResult):
    print("\n" + "=" * 60)
    print("BACKTEST RESULTS")
    print("=" * 60)
    print(f"Total bets:             {result.total_bets}")
    print(f"Wins / Losses:          {result.wins} / {result.losses}")
    print(f"Accuracy:               {result.accuracy:.4f} ({result.accuracy*100:.2f}%)")
    print(f"Brier Score:            {result.brier_score:.4f}")
    print(f"Log Loss:               {result.log_loss:.4f}")
    print(f"Total Stake:            ${result.total_stake:.2f}")
    print(f"Total Return:           ${result.total_return:.2f}")
    print(f"ROI:                    {result.roi:.2f}%")
    print(f"Sharpe Ratio:           {result.sharpe_ratio:.3f}")
    print(f"Max Drawdown:           {result.max_drawdown:.2%}")
    print(f"Average Odds:           {result.average_odds:.3f}")
    print(f"\nProfit by Confidence:")
    for level, profit in result.profit_by_confidence.items():
        print(f"  {level}: ${profit:.2f}/bet")
    print(f"\nConfusion Matrix:")
    print(result.confusion_matrix)
    print("=" * 60)


def main():
    parser = argparse.ArgumentParser(description="Backtest Engine")
    parser.add_argument("--sport", choices=["football", "basketball"], default="football")
    parser.add_argument("--seasons", nargs="+", default=None)
    parser.add_argument("--stake", type=float, default=0.02, help="Fraction of bankroll per bet")
    parser.add_argument("--min-confidence", type=float, default=0.0)
    parser.add_argument("--kelly", action="store_true", help="Use Kelly criterion staking")
    args = parser.parse_args()

    engine = BacktestEngine(sport=args.sport)
    result = engine.run(
        seasons=args.seasons,
        stake_per_bet=args.stake,
        min_confidence=args.min_confidence,
        use_kelly=args.kelly,
    )
    print_report(result)


if __name__ == "__main__":
    main()
