from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import Optional

router = APIRouter()

class MatchFeatures(BaseModel):
    home_win_rate: float
    away_win_rate: float
    home_avg_goals: float
    away_avg_goals: float
    home_avg_conceded: float
    away_avg_conceded: float
    home_xg: float
    away_xg: float
    home_form_score: float
    away_form_score: float
    h2h_home_wins: int
    h2h_away_wins: int
    h2h_draws: int

class PredictionResult(BaseModel):
    home_win_prob: float
    draw_prob: float
    away_win_prob: float
    predicted_home_goals: float
    predicted_away_goals: float
    confidence: float

@router.post("/predict", response_model=PredictionResult)
async def predict(features: MatchFeatures):
    # Placeholder: model inference will go here
    return PredictionResult(
        home_win_prob=0.45,
        draw_prob=0.25,
        away_win_prob=0.30,
        predicted_home_goals=1.8,
        predicted_away_goals=1.2,
        confidence=0.72,
    )

@router.post("/predict-batch")
async def predict_batch(matches: list[MatchFeatures]):
    return [await predict(m) for m in matches]
