import httpx, json

# Check model info
r = httpx.get("http://localhost:8000/api/ml/predictions/model-info?sport=football", timeout=10)
info = r.json()
print(f"Model: {info['version']}")
print(f"Samples: {info['training_samples']}")
print(f"Accuracy (CV): {info['metrics']['val_accuracy_mean']:.4f} +/- {info['metrics']['val_accuracy_std']:.4f}")

# ELO state
with open("models/registry/football_ensemble/elo_state.json") as f:
    elo = json.load(f)
print(f"ELO teams: {len(elo)}")

# Predictions with normalized names
tests = [
    ("Liverpool FC", "Manchester City FC"),
    ("FC Barcelona", "Real Madrid CF"),
    ("FC Bayern München", "Borussia Dortmund"),
    ("FC Internazionale Milano", "AC Milan"),
    ("Paris Saint-Germain FC", "Olympique de Marseille"),
    ("Ajax", "PSV"),
    ("Newcastle United FC", "Arsenal FC"),
]
for home, away in tests:
    match = {
        "home_team_id": home,
        "away_team_id": away,
        "home_team_name": home,
        "away_team_name": away,
    }
    r = httpx.post("http://localhost:8000/api/ml/predictions/football", json=match, timeout=10)
    if r.status_code == 200:
        p = r.json()
        print(f"  {home:<40s} vs {away:<30s} -> {p['predicted_outcome']:>8s} ({p['confidence']:.1%})")
    else:
        print(f"  {home} vs {away} -> ERROR: {r.status_code}")
