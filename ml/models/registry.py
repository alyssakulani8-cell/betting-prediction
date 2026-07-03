"""
Model registry with versioning, champion/challenger tracking,
and performance history persistence.
"""

import json
import joblib
from pathlib import Path
from datetime import datetime
from typing import Dict, Optional, List, Any
from dataclasses import dataclass


@dataclass
class ModelRecord:
    version: str
    name: str
    sport: str
    timestamp: str
    metrics: Dict[str, float]
    params: Dict[str, Any]
    feature_importance: Optional[Dict[str, float]] = None
    is_champion: bool = False
    model_path: str = ""
    training_samples: int = 0


class ModelRegistry:
    def __init__(self, registry_path: str = "models/registry/"):
        self.path = Path(registry_path)
        self.path.mkdir(parents=True, exist_ok=True)
        self._manifest = self._load_manifest()

    def register(
        self,
        model,
        name: str,
        sport: str,
        metrics: Dict[str, float],
        params: Dict[str, Any],
        feature_importance: Optional[Dict[str, float]] = None,
        training_samples: int = 0,
        make_champion: bool = True,
    ) -> str:
        version = datetime.now().strftime("%Y%m%d_%H%M%S")
        version = f"v{version}"

        model_dir = self.path / name
        model_dir.mkdir(parents=True, exist_ok=True)
        model_path = str(model_dir / f"{version}.pkl")

        joblib.dump(model, model_path)

        record = ModelRecord(
            version=version,
            name=name,
            sport=sport,
            timestamp=datetime.now().isoformat(),
            metrics=metrics,
            params=params,
            feature_importance=feature_importance,
            is_champion=make_champion,
            model_path=model_path,
            training_samples=training_samples,
        )

        if make_champion:
            for existing in self._manifest.values():
                if existing.name == name:
                    existing.is_champion = False

        self._manifest[f"{name}_{version}"] = record
        self._save_manifest()

        if make_champion:
            champion_path = self.path / name / "champion.pkl"
            joblib.dump(model, champion_path)

        return version

    def refresh_manifest(self):
        """Re-read manifest from disk (e.g., after external training)."""
        self._manifest = self._load_manifest()

    def load_champion(self, name: str):
        champion_path = self.path / name / "champion.pkl"
        if champion_path.exists():
            return joblib.load(champion_path)
        return None

    def load_version(self, name: str, version: str):
        model_path = self.path / name / f"{version}.pkl"
        if model_path.exists():
            return joblib.load(model_path)
        return None

    def get_champion_record(self, name: str) -> Optional[ModelRecord]:
        for record in self._manifest.values():
            if record.name == name and record.is_champion:
                return record
        return None

    def get_all_versions(self, name: str) -> List[ModelRecord]:
        return [
            r for r in self._manifest.values()
            if r.name == name
        ]

    def get_performance_history(self, name: str) -> List[Dict]:
        records = sorted(
            self.get_all_versions(name),
            key=lambda r: r.timestamp,
        )
        return [
            {
                "version": r.version,
                "timestamp": r.timestamp,
                "metrics": r.metrics,
                "training_samples": r.training_samples,
                "is_champion": r.is_champion,
            }
            for r in records
        ]

    def _load_manifest(self) -> Dict[str, ModelRecord]:
        manifest_path = self.path / "manifest.json"
        if not manifest_path.exists():
            return {}

        with open(manifest_path) as f:
            data = json.load(f)

        records = {}
        for key, val in data.items():
            records[key] = ModelRecord(**val)
        return records

    def _save_manifest(self):
        data = {
            key: record.__dict__
            for key, record in self._manifest.items()
        }
        with open(self.path / "manifest.json", "w") as f:
            json.dump(data, f, indent=2, default=str)
