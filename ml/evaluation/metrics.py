"""
Comprehensive evaluation metrics for betting prediction models.
"""

import numpy as np
from typing import Dict, Tuple


def classification_metrics(y_true: np.ndarray, y_pred: np.ndarray, y_proba: np.ndarray) -> Dict:
    n_classes = y_proba.shape[1]
    accuracy = np.mean(y_pred == y_true)

    brier = np.mean(np.sum((y_proba - np.eye(n_classes)[y_true]) ** 2, axis=1))

    y_proba_clipped = np.clip(y_proba, 1e-15, 1 - 1e-15)
    log_loss = -np.mean(np.sum(np.eye(n_classes)[y_true] * np.log(y_proba_clipped), axis=1))

    confusion = np.zeros((n_classes, n_classes), dtype=int)
    for t, p in zip(y_true, y_pred):
        confusion[t, p] += 1

    precision = {}
    recall = {}
    f1 = {}
    for c in range(n_classes):
        tp = confusion[c, c]
        fp = confusion[:, c].sum() - tp
        fn = confusion[c, :].sum() - tp
        precision[c] = tp / (tp + fp) if (tp + fp) > 0 else 0.0
        recall[c] = tp / (tp + fn) if (tp + fn) > 0 else 0.0
        f1[c] = (2 * precision[c] * recall[c] / (precision[c] + recall[c])
                 if (precision[c] + recall[c]) > 0 else 0.0)

    return {
        "accuracy": float(accuracy),
        "brier_score": float(brier),
        "log_loss": float(log_loss),
        "precision_per_class": {str(k): float(v) for k, v in precision.items()},
        "recall_per_class": {str(k): float(v) for k, v in recall.items()},
        "f1_per_class": {str(k): float(v) for k, v in f1.items()},
        "confusion_matrix": confusion.tolist(),
    }


def calibration_metrics(y_true: np.ndarray, y_proba: np.ndarray, n_bins: int = 10) -> Dict:
    """Compute calibration curve and expected calibration error (ECE)."""
    confidences = y_proba.max(axis=1)
    predictions = y_proba.argmax(axis=1)
    correct = (predictions == y_true).astype(float)

    bin_boundaries = np.linspace(0, 1, n_bins + 1)
    ece = 0.0
    bin_accs = []
    bin_confs = []
    bin_counts = []

    for i in range(n_bins):
        in_bin = (confidences > bin_boundaries[i]) & (confidences <= bin_boundaries[i + 1])
        bin_size = in_bin.sum()
        if bin_size > 0:
            bin_acc = correct[in_bin].mean()
            bin_conf = confidences[in_bin].mean()
            ece += bin_size * abs(bin_acc - bin_conf)
        else:
            bin_acc = 0.0
            bin_conf = 0.0
        bin_accs.append(float(bin_acc))
        bin_confs.append(float(bin_conf))
        bin_counts.append(int(bin_size))

    ece /= len(y_true)

    return {
        "expected_calibration_error": float(ece),
        "bin_accuracies": bin_accs,
        "bin_confidences": bin_confs,
        "bin_counts": bin_counts,
    }


def betting_metrics(
    y_true: np.ndarray,
    y_proba: np.ndarray,
    odds: np.ndarray,
    stake: float = 0.02,
    initial_bankroll: float = 1000.0,
) -> Dict:
    """Simulate betting returns using predicted probabilities."""
    n_classes = y_proba.shape[1]
    predictions = y_proba.argmax(axis=1)
    confidences = y_proba.max(axis=1)

    bankroll = initial_bankroll
    total_stake = 0.0
    total_return = 0.0
    wins = 0
    total_bets = 0
    returns = []
    peak = bankroll
    max_dd = 0.0

    for i in range(len(y_true)):
        bet_odds = odds[i, predictions[i]]
        if bet_odds < 1.01:
            continue

        bet_stake = bankroll * stake
        if bet_stake <= 0:
            continue

        total_bets += 1
        total_stake += bet_stake

        if predictions[i] == y_true[i]:
            profit = bet_stake * (bet_odds - 1.0)
            bankroll += profit
            total_return += profit
            wins += 1
            returns.append(profit / bet_stake)
        else:
            bankroll -= bet_stake
            total_return -= bet_stake
            returns.append(-1.0)

        peak = max(peak, bankroll)
        dd = (peak - bankroll) / peak
        max_dd = max(max_dd, dd)

    roi = (total_return / total_stake * 100) if total_stake > 0 else 0.0
    avg_return = np.mean(returns) if returns else 0.0
    std_return = np.std(returns) if returns else 1.0
    sharpe = (avg_return / std_return * np.sqrt(252)) if std_return > 0 else 0.0

    return {
        "total_bets": total_bets,
        "win_rate": float(wins / total_bets) if total_bets > 0 else 0.0,
        "roi_pct": float(roi),
        "sharpe_ratio": float(sharpe),
        "max_drawdown": float(max_dd),
        "final_bankroll": float(bankroll),
        "total_profit": float(total_return),
    }


def feature_importance_report(importance: Dict[str, float], top_n: int = 20) -> Dict:
    sorted_features = sorted(importance.items(), key=lambda x: x[1], reverse=True)
    top = sorted_features[:top_n]
    return {
        "top_features": [{"name": k, "importance": float(v)} for k, v in top],
        "feature_count": len(importance),
    }
