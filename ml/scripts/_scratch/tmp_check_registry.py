from pathlib import Path
import json

registry = Path("models/registry/football_ensemble")
print("Files in registry:")
for f in sorted(registry.iterdir()):
    print(f"  {f.name} ({f.stat().st_size / 1024:.1f} KB)")

with open(registry / "manifest.json") as f:
    manifest = json.load(f)

print(f"\nManifest entries: {len(manifest)}")
for e in manifest:
    print(f"  {e['version']}: {e['training_samples']} samples, source={e['source']}, acc={e['metrics']['val_accuracy_mean']:.4f}")

with open(registry / "feature_columns.json") as f:
    cols = json.load(f)
print(f"\nFeature columns ({len(cols)}): {cols[:5]}...")

with open(registry / "elo_state.json") as f:
    elo = json.load(f)
print(f"ELO state: {len(elo)} teams")
top5 = sorted(elo.items(), key=lambda x: -x[1])[:5]
for name, rating in top5:
    print(f"  {name}: {rating:.0f}")
