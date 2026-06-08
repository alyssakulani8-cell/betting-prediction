from fastapi import APIRouter, UploadFile, File
from pydantic import BaseModel

router = APIRouter()

class DatasetInfo(BaseModel):
    rows: int
    columns: list[str]
    missing_values: dict
    summary: dict

@router.post("/upload")
async def upload_data(file: UploadFile = File(...)):
    return {
        "filename": file.filename,
        "size": file.size,
        "status": "uploaded",
        "message": "Data uploaded successfully",
    }

@router.get("/features")
async def get_feature_columns():
    return {
        "features": [
            "home_win_rate", "away_win_rate",
            "home_avg_goals", "away_avg_goals",
            "home_avg_conceded", "away_avg_conceded",
            "home_xg", "away_xg",
            "home_form_score", "away_form_score",
            "h2h_home_wins", "h2h_away_wins", "h2h_draws",
        ]
    }
