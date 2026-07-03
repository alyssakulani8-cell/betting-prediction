from fastapi import APIRouter, BackgroundTasks, HTTPException, Query
from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime
import threading

from scripts.train_pipeline import TrainingPipeline

router = APIRouter()

_training_status = {
    "is_running": False,
    "sport": None,
    "started_at": None,
    "progress": 0.0,
    "result": None,
    "error": None,
}


class TrainingConfig(BaseModel):
    sport: str = "football"
    leagues: Optional[List[str]] = None
    seasons: Optional[List[str]] = None
    n_trials: int = 30
    source: str = "api"


def _run_training(training_config: TrainingConfig):
    global _training_status
    try:
        _training_status["is_running"] = True
        _training_status["sport"] = training_config.sport
        _training_status["started_at"] = datetime.now().isoformat()
        _training_status["progress"] = 0.0
        _training_status["error"] = None

        pipeline = TrainingPipeline(sport=training_config.sport)
        result = pipeline.run(
            leagues=training_config.leagues,
            seasons=training_config.seasons,
            tune=True,
            n_trials=training_config.n_trials,
            source=training_config.source,
        )
        _training_status["result"] = result
        _training_status["progress"] = 1.0

    except Exception as e:
        _training_status["error"] = str(e)
    finally:
        _training_status["is_running"] = False


@router.post("/train")
async def start_training(config: TrainingConfig, background_tasks: BackgroundTasks):
    if _training_status["is_running"]:
        raise HTTPException(
            status_code=409,
            detail=f"Training already running for {_training_status['sport']} since {_training_status['started_at']}"
        )

    thread = threading.Thread(target=_run_training, args=(config,), daemon=True, name="training-thread")
    thread.start()

    return {
        "status": "training_started",
        "sport": config.sport,
        "message": "Training running in background. Check /status for progress.",
    }


@router.get("/status")
async def training_status():
    status = _training_status.copy()
    if status["result"]:
        status["result"] = {
            "version": status["result"]["version"],
            "sport": status["result"]["sport"],
            "metrics": status["result"]["metrics"],
            "training_samples": status["result"]["training_samples"],
        }
    return status


@router.get("/history")
async def training_history(sport: str = Query("football", pattern="^(football|basketball)$")):
    from models.registry import ModelRegistry
    from config import config
    registry = ModelRegistry(registry_path=config.registry_path)
    history = registry.get_performance_history(f"{sport}_ensemble")
    return {"sport": sport, "history": history}
