from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel
from typing import Optional, List
import pandas as pd

from services.model_service import model_service

router = APIRouter()


class FootballMatchInput(BaseModel):
    home_team_id: str
    away_team_id: str
    home_team_name: str
    away_team_name: str
    league: Optional[str] = "PL"
    season: Optional[str] = None
    odds_home: Optional[float] = None
    odds_draw: Optional[float] = None
    odds_away: Optional[float] = None
    home_injury_index: Optional[float] = 0.0
    away_injury_index: Optional[float] = 0.0


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


@router.post("/football", response_model=PredictionResponse)
async def predict_football(match: FootballMatchInput):
    try:
        result = model_service.predict_football(match.model_dump())
        return PredictionResponse(**result)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/basketball", response_model=PredictionResponse)
async def predict_basketball(match: BasketballMatchInput):
    try:
        result = model_service.predict_basketball(match.model_dump())
        return PredictionResponse(**result)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/football/batch")
async def predict_football_batch(matches: List[FootballMatchInput]):
    return [model_service.predict_football(m.model_dump()) for m in matches]


@router.post("/basketball/batch")
async def predict_basketball_batch(matches: List[BasketballMatchInput]):
    return [model_service.predict_basketball(m.model_dump()) for m in matches]


@router.get("/model-info")
async def model_info(sport: str = Query("football", regex="^(football|basketball)$")):
    info = model_service.get_champion_info(sport)
    if info is None:
        raise HTTPException(status_code=404, detail=f"No champion model for {sport}")
    return info


@router.post("/reload")
async def reload_models():
    football = model_service.load_champion("football")
    basketball = model_service.load_champion("basketball")
    return {
        "football_champion_loaded": football,
        "basketball_champion_loaded": basketball,
    }
