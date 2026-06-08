from fastapi import APIRouter, UploadFile, File, HTTPException, Query
from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime

from data.orchestrator import DataOrchestrator

router = APIRouter()
orchestrator = DataOrchestrator()


@router.get("/football/matches")
async def get_football_matches(
    leagues: str = Query("PL,PD,SA,BL,FL"),
    seasons: str = Query("2024,2025"),
    limit: int = Query(100, le=5000),
):
    league_list = [l.strip() for l in leagues.split(",")]
    season_list = [s.strip() for s in seasons.split(",")]
    try:
        df = orchestrator.fetch_football_dataset(leagues=league_list, seasons=season_list)
        return {
            "total_matches": len(df),
            "matches": df.tail(limit).to_dict(orient="records"),
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/basketball/games")
async def get_basketball_games(
    season: str = "2025",
    limit: int = Query(100, le=5000),
):
    try:
        df = orchestrator.fetch_basketball_dataset(season=season)
        return {
            "total_games": len(df),
            "games": df.tail(limit).to_dict(orient="records"),
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/football/standings")
async def get_standings(league: str = "PL", season: str = "2024"):
    if not orchestrator.football:
        raise HTTPException(status_code=503, detail="Football API not configured")
    try:
        standings = orchestrator.football.fetch_standings(league, season)
        return {"league": league, "season": season, "standings": standings}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


class DataUploadResponse(BaseModel):
    filename: str
    rows: int
    columns: List[str]
    status: str


@router.post("/upload", response_model=DataUploadResponse)
async def upload_data(file: UploadFile = File(...)):
    import pandas as pd
    import io

    content = await file.read()
    if file.filename.endswith(".csv"):
        df = pd.read_csv(io.BytesIO(content))
    elif file.filename.endswith((".xls", ".xlsx")):
        df = pd.read_excel(io.BytesIO(content))
    else:
        raise HTTPException(status_code=400, detail="Unsupported format. Use CSV or Excel.")

    return DataUploadResponse(
        filename=file.filename,
        rows=len(df),
        columns=df.columns.tolist(),
        status="uploaded",
    )


@router.get("/features")
async def get_feature_columns(sport: str = Query("football", regex="^(football|basketball)$")):
    from config import config
    cols = config.football_feature_columns if sport == "football" else config.basketball_feature_columns
    return {"sport": sport, "features": cols, "count": len(cols)}
