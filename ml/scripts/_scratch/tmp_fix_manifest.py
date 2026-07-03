import json
from pathlib import Path
import sys
sys.path.insert(0, str(Path(__file__).parent.parent))

from datetime import datetime

# Fix the global manifest (used by ModelRegistry)
manifest_path = Path("models/registry/manifest.json")
if manifest_path.exists():
    with open(manifest_path) as f:
        manifest = json.load(f)

    # Find old champion and mark as not champion
    for key, entry in manifest.items():
        if entry.get("is_champion") and "football_ensemble" in key:
            entry["is_champion"] = False
            print(f"Unmarked: {key}")

    # Add new entry
    version = "v20260701_183243"
    new_key = f"football_ensemble_{version}"
    manifest[new_key] = {
        "version": version,
        "name": "football_ensemble",
        "sport": "football",
        "timestamp": "2026-07-01T18:32:43",
        "metrics": {
            "val_accuracy_mean": 0.4875,
            "val_accuracy_std": 0.0144,
        },
        "params": {
            "leagues": None,
            "seasons": None,
            "source": "football-data.co.uk",
        },
        "feature_importance": None,
        "is_champion": True,
        "model_path": str(Path("models/registry/football_ensemble/xgb_csv_data.pkl").resolve()),
        "training_samples": 49898,
    }

    with open(manifest_path, "w") as f:
        json.dump(manifest, f, indent=2, default=str)

    print(f"Added champion entry: {new_key}")
    print(f"Total entries: {len(manifest)}")
else:
    print(f"Manifest not found: {manifest_path}")
