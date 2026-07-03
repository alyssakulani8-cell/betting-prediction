"""
Personalization module that adjusts model predictions based on
user-specific context: historical accuracy, favorite teams,
risk tolerance, and betting patterns.

This is applied as a post-processing step on raw model probabilities.
"""

from typing import Optional, Dict, List, Tuple


class UserContext:
    user_id: Optional[str] = None
    favorite_teams: Optional[List[str]] = None
    risk_tolerance: str = "medium"  # low, medium, high
    league_accuracy: Optional[Dict[str, float]] = None  # league -> win rate
    league_sample_size: Optional[Dict[str, int]] = None  # league -> bets placed
    preferred_bet_types: Optional[List[str]] = None


def adjust_probabilities(
    probs: List[float],
    home_team: str,
    away_team: str,
    league: Optional[str] = None,
    user: Optional[UserContext] = None,
) -> Tuple[List[float], Dict[str, float]]:
    """
    Adjust model probabilities based on user context.

    Args:
        probs: Raw model probabilities [home_win, draw, away_win]
        home_team: Home team name
        away_team: Away team name
        league: League identifier
        user: User context with personalization data

    Returns:
        Tuple of (adjusted_probabilities, adjustment_factors)
    """
    if user is None:
        return probs, {}

    adjusted = list(probs)
    factors: Dict[str, float] = {}

    favorite_team_bias = _apply_favorite_team_bias(
        adjusted, home_team, away_team, user.favorite_teams
    )
    if favorite_team_bias:
        adjusted = favorite_team_bias
        factors["favorite_team_bias"] = 1.0

    league_adjustment = _apply_league_accuracy_bias(
        adjusted, league, user.league_accuracy, user.league_sample_size
    )
    if league_adjustment:
        adjusted = league_adjustment
        factors["league_accuracy"] = 1.0

    risk_adjustment = _apply_risk_tolerance(
        adjusted, user.risk_tolerance
    )
    if risk_adjustment:
        adjusted = risk_adjustment
        factors["risk_tolerance"] = 1.0

    total = sum(adjusted)
    if abs(total - 1.0) > 0.001:
        adjusted = [p / total for p in adjusted]

    return adjusted, factors


def _apply_favorite_team_bias(
    probs: List[float],
    home_team: str,
    away_team: str,
    favorite_teams: Optional[List[str]],
) -> Optional[List[float]]:
    """Reduce confidence when user bets on their favorite team (known bias)."""
    if not favorite_teams:
        return None

    home_lower = home_team.lower()
    away_lower = away_team.lower()
    faves_lower = [t.lower() for t in favorite_teams]

    home_is_fave = any(f in home_lower for f in faves_lower)
    away_is_fave = any(f in away_lower for f in faves_lower)

    if not home_is_fave and not away_is_fave:
        return None

    adjusted = list(probs)

    if home_is_fave:
        overconfidence = adjusted[0] - 1/3
        if overconfidence > 0.05:
            discount = overconfidence * 0.15
            adjusted[0] -= discount
            adjusted[1] += discount * 0.6
            adjusted[2] += discount * 0.4

    if away_is_fave:
        overconfidence = adjusted[2] - 1/3
        if overconfidence > 0.05:
            discount = overconfidence * 0.15
            adjusted[2] -= discount
            adjusted[1] += discount * 0.6
            adjusted[0] += discount * 0.4

    return adjusted


def _apply_league_accuracy_bias(
    probs: List[float],
    league: Optional[str],
    league_accuracy: Optional[Dict[str, float]],
    league_sample_size: Optional[Dict[str, int]],
) -> Optional[List[float]]:
    """
    Adjust confidence based on user's historical accuracy in this league.
    If user performs poorly in a league, slightly reduce confidence spread.
    """
    if not league or not league_accuracy:
        return None

    accuracy = league_accuracy.get(league)
    samples = league_sample_size.get(league, 0) if league_sample_size else 0

    if accuracy is None or samples < 5:
        return None

    expected = 0.4875
    deviation = accuracy - expected

    if abs(deviation) < 0.03:
        return None

    adjustment = deviation * 0.1
    adjustment = max(-0.03, min(0.03, adjustment))

    adjusted = list(probs)
    if deviation > 0:
        best_idx = int(adjusted.index(max(adjusted)))
        adjusted[best_idx] = min(0.95, adjusted[best_idx] + adjustment)
    else:
        spread = max(adjusted) - min(adjusted)
        reduction = spread * 0.05
        max_idx = int(adjusted.index(max(adjusted)))
        adjusted[max_idx] -= reduction
        others_total = sum(adjusted[i] for i in range(3) if i != max_idx)
        for i in range(3):
            if i != max_idx:
                adjusted[i] += reduction * (adjusted[i] / max(others_total, 0.001))

    return adjusted


def _apply_risk_tolerance(
    probs: List[float],
    risk_tolerance: str,
) -> Optional[List[float]]:
    """
    Adjust probability spread based on user risk tolerance.
    Low risk: flatten probabilities (more cautious)
    High risk: sharpen probabilities (more aggressive)
    """
    if risk_tolerance == "medium":
        return None

    adjusted = list(probs)
    max_idx = int(adjusted.index(max(adjusted)))
    max_val = adjusted[max_idx]

    if risk_tolerance == "low":
        dampen = 0.08 * max_val
        adjusted[max_idx] = max(0.4, adjusted[max_idx] - dampen)
    elif risk_tolerance == "high":
        amplify = 0.10 * (1 - max_val)
        adjusted[max_idx] = min(0.95, adjusted[max_idx] + amplify)

    total = sum(adjusted)
    return [p / total for p in adjusted]
