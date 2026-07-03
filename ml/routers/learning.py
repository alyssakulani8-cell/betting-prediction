"""
REST endpoints for continuous learning, prediction logging,
and accuracy tracking.
"""

from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime

from services.continuous_learning import continuous_learner

router = APIRouter()


class PredictionLogRequest(BaseModel):
    match_id: str
    sport: str = "football"
    home_team: str
    away_team: str
    predicted_outcome: str
    predicted_probs: List[float]
    confidence: float


class MatchResultRequest(BaseModel):
    match_id: str
    home_score: int
    away_score: int


@router.post("/log-prediction")
async def log_prediction(req: PredictionLogRequest):
    continuous_learner.logger.log_prediction(
        match_id=req.match_id,
        sport=req.sport,
        home_team=req.home_team,
        away_team=req.away_team,
        predicted_outcome=req.predicted_outcome,
        predicted_probs=req.predicted_probs,
        confidence=req.confidence,
    )
    return {"status": "logged"}


@router.post("/resolve-match")
async def resolve_match(req: MatchResultRequest):
    result = continuous_learner.logger.resolve_match(
        match_id=req.match_id,
        home_score=req.home_score,
        away_score=req.away_score,
    )
    if result is None:
        return {"status": "no_unresolved_prediction", "match_id": req.match_id}
    
    continuous_learner.record_new_match(result.sport)
    return {
        "status": "resolved",
        "match_id": req.match_id,
        "predicted": result.predicted_outcome,
        "actual": result.actual_outcome,
        "was_correct": result.was_correct,
    }


@router.get("/accuracy")
async def accuracy(
    sport: Optional[str] = Query(None, pattern="^(football|basketball)?$"),
    days: Optional[int] = Query(None, ge=1, le=365),
):
    return continuous_learner.logger.get_accuracy(sport=sport, days=days)


@router.post("/retrain")
async def trigger_retraining(sport: str = Query("football", pattern="^(football|basketball)$")):
    result = continuous_learner.train(sport=sport)
    if result is None:
        raise HTTPException(status_code=409, detail="Training already in progress")
    return {
        "status": "training_complete",
        "sport": sport,
        "version": result["version"],
        "metrics": result["metrics"],
        "training_samples": result["training_samples"],
    }


@router.post("/scheduler/start")
async def start_scheduler(interval_seconds: int = Query(3600, ge=300)):
    continuous_learner.start_scheduler(interval_seconds=interval_seconds)
    return {"status": "scheduler_started", "interval_seconds": interval_seconds}


@router.post("/scheduler/stop")
async def stop_scheduler():
    continuous_learner.stop_scheduler()
    return {"status": "scheduler_stopped"}


@router.get("/scheduler/status")
async def scheduler_status():
    return {
        "is_running": continuous_learner._scheduler_running,
        "last_train_time": {
            k: v.isoformat() for k, v in continuous_learner._last_train_time.items()
        },
        "last_csv_fetch_time": continuous_learner._last_csv_fetch_time.isoformat() if continuous_learner._last_csv_fetch_time else None,
        "new_matches_since_train": continuous_learner._new_matches_since_train,
    }


@router.post("/fetch-csv")
async def fetch_csv_data():
    success = continuous_learner._fetch_csv_data()
    return {"status": "completed" if success else "failed"}


@router.post("/train-from-csv")
async def train_from_csv():
    result = continuous_learner.train_from_csv()
    if result is None:
        from fastapi import HTTPException
        raise HTTPException(status_code=409, detail="Training already in progress")
    return {
        "status": "training_complete",
        "version": result["version"],
        "metrics": result["metrics"],
        "training_samples": result["training_samples"],
    }
