from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel
from typing import Optional, List, Dict
import pandas as pd

from services.model_service import model_service
from services.personalization import UserContext, adjust_probabilities

router = APIRouter()


class UserContextInput(BaseModel):
    user_id: Optional[str] = None
    favorite_teams: Optional[List[str]] = None
    risk_tolerance: str = "medium"
    league_accuracy: Optional[Dict[str, float]] = None
    league_sample_size: Optional[Dict[str, int]] = None
    preferred_bet_types: Optional[List[str]] = None


class FootballMatchInput(BaseModel):
    home_team_id: str
    away_team_id: str
    home_team_name: str
    away_team_name: str
    league: Optional[str] = "PL"
    season: Optional[str] = None
    utc_date: Optional[str] = None
    odds_home: Optional[float] = None
    odds_draw: Optional[float] = None
    odds_away: Optional[float] = None
    home_injury_index: Optional[float] = 0.0
    away_injury_index: Optional[float] = 0.0
    user_context: Optional[UserContextInput] = None


class BasketballMatchInput(BaseModel):
    home_team_id: str
    away_team_id: str
    home_team_name: str
    away_team_name: str
    odds_home: Optional[float] = None
    odds_away: Optional[float] = None
    total_line: Optional[float] = None
    home_injury_index: Optional[float] = 0.0
    away_injury_index: Optional[float] = 0.0
    user_context: Optional[UserContextInput] = None


class PredictionResponse(BaseModel):
    prediction: int
    confidence: float
    predicted_outcome: str
    home_win_prob: float
    draw_prob: Optional[float] = None
    away_win_prob: float
    probabilities: List[float]
    model: str
    timestamp: str
    personalized: Optional[bool] = None
    adjustment_factors: Optional[Dict[str, float]] = None
    predicted_home_goals: Optional[float] = None
    predicted_away_goals: Optional[float] = None
    over_25_prob: Optional[float] = None
    under_25_prob: Optional[float] = None
    btts_prob: Optional[float] = None
    most_likely_score: Optional[str] = None


def _build_user_context(ctx: Optional[UserContextInput]) -> Optional[UserContext]:
    if ctx is None:
        return None
    user = UserContext()
    user.user_id = ctx.user_id
    user.favorite_teams = ctx.favorite_teams
    user.risk_tolerance = ctx.risk_tolerance
    user.league_accuracy = ctx.league_accuracy
    user.league_sample_size = ctx.league_sample_size
    user.preferred_bet_types = ctx.preferred_bet_types
    return user


@router.post("/football", response_model=PredictionResponse)
async def predict_football(match: FootballMatchInput):
    try:
        result = model_service.predict_football(match.model_dump())
        user = _build_user_context(match.user_context)
        if user:
            adjusted_probs, factors = adjust_probabilities(
                result["probabilities"],
                home_team=match.home_team_name,
                away_team=match.away_team_name,
                league=match.league,
                user=user,
            )
            result["probabilities"] = adjusted_probs
            result["home_win_prob"] = adjusted_probs[0]
            if len(adjusted_probs) > 2:
                result["draw_prob"] = adjusted_probs[1]
                result["away_win_prob"] = adjusted_probs[2]
            else:
                result["away_win_prob"] = adjusted_probs[1]
            result["prediction"] = int(max(range(len(adjusted_probs)), key=lambda i: adjusted_probs[i]))
            result["confidence"] = float(max(adjusted_probs))
            result["predicted_outcome"] = ["Home Win", "Draw", "Away Win"][result["prediction"]]
            result["personalized"] = True
            result["adjustment_factors"] = factors
        return PredictionResponse(**result)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/basketball", response_model=PredictionResponse)
async def predict_basketball(match: BasketballMatchInput):
    try:
        result = model_service.predict_basketball(match.model_dump())
        user = _build_user_context(match.user_context)
        if user:
            adjusted_probs, factors = adjust_probabilities(
                result["probabilities"],
                home_team=match.home_team_name,
                away_team=match.away_team_name,
                user=user,
            )
            result["probabilities"] = adjusted_probs
            result["home_win_prob"] = adjusted_probs[1]
            result["away_win_prob"] = adjusted_probs[0]
            result["prediction"] = 1 if adjusted_probs[1] > adjusted_probs[0] else 0
            result["predicted_outcome"] = "Home Win" if result["prediction"] == 1 else "Away Win"
            result["confidence"] = float(max(adjusted_probs))
            result["personalized"] = True
            result["adjustment_factors"] = factors
        return PredictionResponse(**result)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/football/batch")
async def predict_football_batch(matches: List[FootballMatchInput]):
    results = []
    for m in matches:
        result = model_service.predict_football(m.model_dump())
        user = _build_user_context(m.user_context)
        if user:
            adjusted_probs, factors = adjust_probabilities(
                result["probabilities"],
                home_team=m.home_team_name,
                away_team=m.away_team_name,
                league=m.league,
                user=user,
            )
            result["probabilities"] = adjusted_probs
            result["home_win_prob"] = adjusted_probs[0]
            result["draw_prob"] = adjusted_probs[1]
            result["away_win_prob"] = adjusted_probs[2]
            result["prediction"] = int(max(range(3), key=lambda i: adjusted_probs[i]))
            result["confidence"] = float(max(adjusted_probs))
            result["predicted_outcome"] = ["Home Win", "Draw", "Away Win"][result["prediction"]]
            result["personalized"] = True
        results.append(result)
    return results


@router.post("/basketball/batch")
async def predict_basketball_batch(matches: List[BasketballMatchInput]):
    results = []
    for m in matches:
        result = model_service.predict_basketball(m.model_dump())
        user = _build_user_context(m.user_context)
        if user:
            adjusted_probs, factors = adjust_probabilities(
                result["probabilities"],
                home_team=m.home_team_name,
                away_team=m.away_team_name,
                user=user,
            )
            result["probabilities"] = adjusted_probs
            result["home_win_prob"] = adjusted_probs[1]
            result["away_win_prob"] = adjusted_probs[0]
            result["prediction"] = 1 if adjusted_probs[1] > adjusted_probs[0] else 0
            result["predicted_outcome"] = "Home Win" if result["prediction"] == 1 else "Away Win"
            result["confidence"] = float(max(adjusted_probs))
            result["personalized"] = True
        results.append(result)
    return results


@router.get("/model-info")
async def model_info(sport: str = Query("football", pattern="^(football|basketball)$")):
    info = model_service.get_champion_info(sport)
    if info is None:
        raise HTTPException(status_code=404, detail=f"No champion model for {sport}")
    return info


@router.post("/reload")
async def reload_models():
    model_service.registry.refresh_manifest()
    football = model_service.load_champion("football")
    basketball = model_service.load_champion("basketball")
    return {
        "football_champion_loaded": football,
        "basketball_champion_loaded": basketball,
    }
