import httpx
from pathlib import Path
import sys
sys.path.insert(0, str(Path(__file__).parent.parent))

# Make a prediction with all required fields
match = {
    "home_team_id": "Man City",
    "away_team_id": "Bayern Munich",
    "home_team_name": "Manchester City FC",
    "away_team_name": "FC Bayern München",
    "league": "PL",
}
r = httpx.post("http://localhost:8000/api/ml/predictions/football", json=match, timeout=10)
if r.status_code == 200:
    pred = r.json()
    print(f"Man City vs Bayern:")
    print(f"  Outcome: {pred['predicted_outcome']} ({pred['confidence']:.1%})")
    print(f"  Probs: H={pred['home_win_prob']:.4f} D={pred['draw_prob']:.4f} A={pred['away_win_prob']:.4f}")
    print(f"  Model: {pred['model']}")
else:
    print(f"Error: {r.status_code} {r.text[:200]}")

# Also test Inter vs AC Milan
match2 = {
    "home_team_id": "Inter",
    "away_team_id": "Milan",
    "home_team_name": "FC Internazionale Milano",
    "away_team_name": "AC Milan",
    "league": "SA",
}
r = httpx.post("http://localhost:8000/api/ml/predictions/football", json=match2, timeout=10)
if r.status_code == 200:
    pred = r.json()
    print(f"\nInter vs AC Milan:")
    print(f"  Outcome: {pred['predicted_outcome']} ({pred['confidence']:.1%})")
    print(f"  Probs: H={pred['home_win_prob']:.4f} D={pred['draw_prob']:.4f} A={pred['away_win_prob']:.4f}")

# Verify champion model
from joblib import load
import json

champion = load("models/registry/football_ensemble/champion.pkl")
print(f"\nChampion type: {type(champion).__name__}")
if hasattr(champion, 'n_estimators'):
    print(f"  estimators: {champion.n_estimators}")
if hasattr(champion, 'get_booster'):
    feat_names = champion.get_booster().feature_names
    if feat_names:
        print(f"  features ({len(feat_names)}): {feat_names[:5]}...")

old_path = Path("models/registry/football_ensemble/v20260701_015535.pkl")
if old_path.exists():
    old = load(old_path)
    print(f"\nOld model has {old.n_estimators if hasattr(old, 'n_estimators') else '?'} estimators")
    old_size = old_path.stat().st_size / 1024
    new_size = Path("models/registry/football_ensemble/champion.pkl").stat().st_size / 1024
    print(f"Old: {old_size:.0f} KB, New champion: {new_size:.0f} KB")
else:
    print("\nOld model file not found")
    new_size = Path("models/registry/football_ensemble/champion.pkl").stat().st_size / 1024
    print(f"New champion: {new_size:.0f} KB")

with open("models/registry/football_ensemble/elo_state.json") as f:
    elo = json.load(f)
print(f"\nELO state: {len(elo)} teams")
top5 = sorted(elo.items(), key=lambda x: -x[1])[:5]
for name, rating in top5:
    print(f"  {name}: {rating:.0f}")

# Check if "Man City" is in ELO state
if "Man City" in elo:
    print(f"\nMan City ELO: {elo['Man City']:.0f}")
if "Bayern Munich" in elo:
    print(f"Bayern Munich ELO: {elo['Bayern Munich']:.0f}")
if "Inter" in elo:
    print(f"Inter ELO: {elo['Inter']:.0f}")
if "Milan" in elo:
    print(f"Milan ELO: {elo['Milan']:.0f}")
