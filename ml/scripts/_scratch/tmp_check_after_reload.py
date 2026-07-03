import httpx, json

# Check model info
r = httpx.get("http://localhost:8000/api/ml/predictions/model-info?sport=football", timeout=10)
if r.status_code == 200:
    info = r.json()
    print(f"Model: {info['version']}")
    print(f"Training samples: {info['training_samples']}")
    print(f"Accuracy: {info['metrics']['val_accuracy_mean']:.4f}")
else:
    print(f"Error: {r.status_code} {r.text[:200]}")

# Check ELO state
with open("models/registry/football_ensemble/elo_state.json") as f:
    elo = json.load(f)
print(f"ELO state: {len(elo)} teams")
top5 = sorted(elo.items(), key=lambda x: -x[1])[:5]
for name, rating in top5:
    print(f"  {name}: {rating:.0f}")

# Run a prediction
match = {
    "home_team_id": "Liverpool",
    "away_team_id": "Man City",
    "home_team_name": "Liverpool FC",
    "away_team_name": "Manchester City FC",
}
r = httpx.post("http://localhost:8000/api/ml/predictions/football", json=match, timeout=10)
if r.status_code == 200:
    pred = r.json()
    print(f"\nLiverpool vs Man City:")
    print(f"  Outcome: {pred['predicted_outcome']} ({pred['confidence']:.1%})")
    print(f"  Probs: H={pred['home_win_prob']:.3f} D={pred['draw_prob']:.3f} A={pred['away_win_prob']:.3f}")
    print(f"  Model: {pred['model']}")

# Health check
r = httpx.get("http://localhost:8000/api/ml/health", timeout=10)
print(f"\nHealth: {r.json()}")
