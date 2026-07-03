"""
Continuous learning system that:
1. Logs predictions vs actual results for accuracy tracking
2. Periodically retrains models on new data
3. Triggers retraining when enough new finished matches are available
"""

import sys
import json
import time
import threading
from pathlib import Path
from datetime import datetime, timedelta
from typing import Optional, Dict, List
from dataclasses import dataclass, asdict

sys.path.append(str(Path(__file__).parent.parent))

import numpy as np
import pandas as pd

from config import config
from data.orchestrator import DataOrchestrator
from data.preprocessing import DataPreprocessor
from data.sources.football_data_uk import FootballDataCoUK
from services.feature_engineering import FootballFeatureEngineer
from models.registry import ModelRegistry
from scripts.train_pipeline import TrainingPipeline

# Import here to avoid circular imports at module level
_model_service = None
def _get_model_service():
    global _model_service
    if _model_service is None:
        from services.model_service import model_service
        _model_service = model_service
    return _model_service


@dataclass
class PredictionLog:
    match_id: str
    sport: str
    home_team: str
    away_team: str
    predicted_outcome: str
    predicted_probs: List[float]
    confidence: float
    actual_outcome: Optional[str] = None
    was_correct: Optional[bool] = None
    timestamp: str = ""
    resolved_at: Optional[str] = None


class PredictionLogger:
    """Logs predictions and resolves them against actual results."""

    def __init__(self, log_path: str = "data/predictions_log.json"):
        self.log_path = Path(log_path)
        self.log_path.parent.mkdir(parents=True, exist_ok=True)
        self._logs: List[PredictionLog] = self._load()

    def _load(self) -> List[PredictionLog]:
        if not self.log_path.exists():
            return []
        with open(self.log_path) as f:
            data = json.load(f)
        return [PredictionLog(**item) for item in data]

    def _save(self):
        with open(self.log_path, "w") as f:
            json.dump([asdict(log) for log in self._logs], f, indent=2, default=str)

    def log_prediction(
        self,
        match_id: str,
        sport: str,
        home_team: str,
        away_team: str,
        predicted_outcome: str,
        predicted_probs: List[float],
        confidence: float,
    ):
        self._logs.append(PredictionLog(
            match_id=match_id,
            sport=sport,
            home_team=home_team,
            away_team=away_team,
            predicted_outcome=predicted_outcome,
            predicted_probs=predicted_probs,
            confidence=confidence,
            timestamp=datetime.now().isoformat(),
        ))
        self._save()

    def resolve_match(self, match_id: str, home_score: int, away_score: int):
        """Resolve a prediction against actual score."""
        if home_score > away_score:
            actual = "Home Win"
        elif home_score < away_score:
            actual = "Away Win"
        else:
            actual = "Draw"

        for log in reversed(self._logs):
            if log.match_id == match_id and log.actual_outcome is None:
                log.actual_outcome = actual
                log.was_correct = log.predicted_outcome == actual
                log.resolved_at = datetime.now().isoformat()
                self._save()
                return log
        return None

    def get_accuracy(self, sport: Optional[str] = None, days: Optional[int] = None) -> Dict:
        """Get accuracy metrics for recent predictions."""
        filtered = self._logs
        if sport:
            filtered = [l for l in filtered if l.sport == sport]
        if days:
            cutoff = datetime.now() - timedelta(days=days)
            filtered = [l for l in filtered if l.timestamp and datetime.fromisoformat(l.timestamp) > cutoff]

        resolved = [l for l in filtered if l.was_correct is not None]
        total = len(resolved)
        correct = sum(1 for l in resolved if l.was_correct)
        
        by_confidence = {}
        for l in resolved:
            bucket = round(l.confidence * 10) / 10
            if bucket not in by_confidence:
                by_confidence[bucket] = {"total": 0, "correct": 0}
            by_confidence[bucket]["total"] += 1
            if l.was_correct:
                by_confidence[bucket]["correct"] += 1

        return {
            "total_predictions": len(filtered),
            "resolved": total,
            "correct": correct,
            "accuracy": float(correct / total) if total > 0 else 0.0,
            "accuracy_by_confidence": {
                str(k): {"total": v["total"], "correct": v["correct"], "accuracy": float(v["correct"] / v["total"]) if v["total"] > 0 else 0.0}
                for k, v in sorted(by_confidence.items())
            },
        }


class ContinuousLearner:
    """Background retraining scheduler with automatic CSV data refresh."""

    def __init__(self):
        self.logger = PredictionLogger()
        self.registry = ModelRegistry(registry_path=config.registry_path)
        self._scheduler_running = False
        self._scheduler_thread: Optional[threading.Thread] = None
        self._training_lock = threading.Lock()
        self._last_train_time: Dict[str, datetime] = {}
        self._last_csv_fetch_time: Optional[datetime] = None
        self._new_matches_since_train: Dict[str, int] = {"football": 0, "basketball": 0}

    def record_new_match(self, sport: str):
        self._new_matches_since_train[sport] = self._new_matches_since_train.get(sport, 0) + 1

    def should_retrain(self, sport: str) -> bool:
        min_samples = config.min_training_samples
        new_matches = self._new_matches_since_train.get(sport, 0)
        if new_matches < min_samples:
            return False
        last_train = self._last_train_time.get(sport)
        if last_train:
            days_since = (datetime.now() - last_train).days
            if days_since < config.retrain_frequency_days:
                return False
        return True

    def train(self, sport: str = "football") -> Optional[Dict]:
        if not self._training_lock.acquire(blocking=False):
            return None
        try:
            print(f"[ContinuousLearner] Starting retraining for {sport}...")
            pipeline = TrainingPipeline(sport=sport)
            result = pipeline.run(leagues=None, seasons=None, tune=True, n_trials=30, source="backend")
            self._last_train_time[sport] = datetime.now()
            self._new_matches_since_train[sport] = 0
            print(f"[ContinuousLearner] Retraining complete: {result['version']} (acc: {result['metrics'].get('val_accuracy_mean', 0):.3f})")
            return result
        except Exception as e:
            print(f"[ContinuousLearner] Retraining failed: {e}")
            return None
        finally:
            self._training_lock.release()

    def _fetch_csv_data(self) -> bool:
        """Re-fetch football CSV data from football-data.co.uk."""
        try:
            print("[ContinuousLearner] Re-fetching CSV data from football-data.co.uk...")
            uk_source = FootballDataCoUK()
            uk_source.fetch_all_leagues()
            self._last_csv_fetch_time = datetime.now()
            print("[ContinuousLearner] CSV data fetch complete")
            return True
        except Exception as e:
            print(f"[ContinuousLearner] CSV data fetch failed: {e}")
            return False

    def train_from_csv(self) -> Optional[Dict]:
        """Train a new model using CSV data source."""
        if not self._training_lock.acquire(blocking=False):
            return None
        try:
            print("[ContinuousLearner] Starting CSV-based retraining...")
            pipeline = TrainingPipeline(sport="football")
            result = pipeline.run(leagues=None, seasons=None, tune=True, n_trials=20, source="csv")
            self._last_train_time["football"] = datetime.now()
            self._new_matches_since_train["football"] = 0
            ms = _get_model_service()
            if ms:
                ms.load_champion("football")
            print(f"[ContinuousLearner] CSV retraining complete: {result['version']}")
            return result
        except Exception as e:
            print(f"[ContinuousLearner] CSV retraining failed: {e}")
            return None
        finally:
            self._training_lock.release()

    def _scheduler_loop(self, interval_seconds: int = 3600):
        """Background loop that fetches new data and retrains."""
        csv_fetch_interval = max(interval_seconds, 86400)
        last_csv_fetch = 0
        loop_count = 0

        while self._scheduler_running:
            try:
                loop_count += 1
                if loop_count * interval_seconds >= csv_fetch_interval:
                    self._fetch_csv_data()
                    loop_count = 0

                for sport in ["football", "basketball"]:
                    if self.should_retrain(sport):
                        self.train(sport)
            except Exception as e:
                print(f"[ContinuousLearner] Scheduler error: {e}")
            time.sleep(interval_seconds)

    def start_scheduler(self, interval_seconds: int = 3600):
        if self._scheduler_running:
            return
        self._scheduler_running = True
        self._scheduler_thread = threading.Thread(
            target=self._scheduler_loop, args=(interval_seconds,), daemon=True
        )
        self._scheduler_thread.start()
        print(f"[ContinuousLearner] Scheduler started (interval={interval_seconds}s)")

    def stop_scheduler(self):
        self._scheduler_running = False
        if self._scheduler_thread:
            self._scheduler_thread.join(timeout=5)


continuous_learner = ContinuousLearner()
