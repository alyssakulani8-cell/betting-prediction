import httpx

r = httpx.post("http://localhost:8000/api/ml/predictions/reload", timeout=10)
print("Reload:", r.json())

r = httpx.get("http://localhost:8000/api/ml/predictions/model-info?sport=football", timeout=10)
if r.status_code == 200:
    info = r.json()
    print(f"Model: version={info['version']}, samples={info['training_samples']}, acc={info['metrics']['val_accuracy_mean']:.4f}")
else:
    print(f"Model info error: {r.status_code} {r.text}")

# Test prediction with normalized names
match = {
    "home_team_name": "Manchester City FC",
    "away_team_name": "Manchester United FC",
    "league": "PL",
}
r = httpx.post("http://localhost:8000/api/ml/predictions/football", json=match, timeout=10)
if r.status_code == 200:
    pred = r.json()
    print(f"\nMan City vs Man United:")
    print(f"  Outcome: {pred['predicted_outcome']} ({pred['confidence']:.1%})")
    print(f"  Probs: H={pred['home_win_prob']:.3f} D={pred['draw_prob']:.3f} A={pred['away_win_prob']:.3f}")

# Test with non-English teams
match2 = {
    "home_team_name": "FC Barcelona",
    "away_team_name": "Real Madrid CF",
    "league": "PD",
}
r = httpx.post("http://localhost:8000/api/ml/predictions/football", json=match2, timeout=10)
if r.status_code == 200:
    pred = r.json()
    print(f"\nBarcelona vs Real Madrid:")
    print(f"  Outcome: {pred['predicted_outcome']} ({pred['confidence']:.1%})")
    print(f"  Probs: H={pred['home_win_prob']:.3f} D={pred['draw_prob']:.3f} A={pred['away_win_prob']:.3f}")

# Test with German teams
match3 = {
    "home_team_name": "FC Bayern München",
    "away_team_name": "Borussia Dortmund",
    "league": "BL",
}
r = httpx.post("http://localhost:8000/api/ml/predictions/football", json=match3, timeout=10)
if r.status_code == 200:
    pred = r.json()
    print(f"\nBayern vs Dortmund:")
    print(f"  Outcome: {pred['predicted_outcome']} ({pred['confidence']:.1%})")
    print(f"  Probs: H={pred['home_win_prob']:.3f} D={pred['draw_prob']:.3f} A={pred['away_win_prob']:.3f}")

# Test with Italian teams
match4 = {
    "home_team_name": "FC Internazionale Milano",
    "away_team_name": "AC Milan",
    "league": "SA",
}
r = httpx.post("http://localhost:8000/api/ml/predictions/football", json=match4, timeout=10)
if r.status_code == 200:
    pred = r.json()
    print(f"\nInter vs AC Milan:")
    print(f"  Outcome: {pred['predicted_outcome']} ({pred['confidence']:.1%})")
    print(f"  Probs: H={pred['home_win_prob']:.3f} D={pred['draw_prob']:.3f} A={pred['away_win_prob']:.3f}")
