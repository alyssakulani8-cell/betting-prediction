import httpx, json

# Check model info
r = httpx.get("http://localhost:8000/api/ml/predictions/model-info?sport=football", timeout=10)
print("Model info:")
if r.status_code == 200:
    info = r.json()
    print(f"  Version: {info['version']}")
    print(f"  Training samples: {info['training_samples']}")
    print(f"  Accuracy: {info['metrics']['val_accuracy_mean']:.4f}")
else:
    print(f"  Error: {r.status_code} {r.text}")

# Check ELO state
with open("models/registry/football_ensemble/elo_state.json") as f:
    elo = json.load(f)
print(f"\nELO state: {len(elo)} teams")

# Test prediction with a well-known team
match = {
    "home_team_id": "Man City",
    "away_team_id": "Man United",
    "home_team_name": "Manchester City FC",
    "away_team_name": "Manchester United FC",
    "league": "PL",
    "season": "2025/2026",
}
r = httpx.post("http://localhost:8000/api/ml/predictions/football", json=match, timeout=10)
if r.status_code == 200:
    pred = r.json()
    print(f"\nTest prediction: Man City vs Man United")
    print(f"  Outcome: {pred['predicted_outcome']} ({pred['confidence']:.1%})")
    print(f"  Probs: H={pred['home_win_prob']:.3f}, D={pred['draw_prob']:.3f}, A={pred['away_win_prob']:.3f}")
else:
    print(f"\nPrediction error: {r.status_code} {r.text}")

# Test with a team from the ELO state
r = httpx.post("http://localhost:8000/api/ml/predictions/football", json={
    "home_team_id": "Liverpool",
    "away_team_id": "Barcelona",
    "home_team_name": "Liverpool FC",
    "away_team_name": "FC Barcelona",
    "league": "PL",
    "season": "2025/2026",
}, timeout=10)
if r.status_code == 200:
    pred = r.json()
    print(f"\nTest prediction: Liverpool vs Barcelona")
    print(f"  Outcome: {pred['predicted_outcome']} ({pred['confidence']:.1%})")
    print(f"  Probs: H={pred['home_win_prob']:.3f}, D={pred['draw_prob']:.3f}, A={pred['away_win_prob']:.3f}")
else:
    print(f"\nPrediction error: {r.status_code} {r.text}")
