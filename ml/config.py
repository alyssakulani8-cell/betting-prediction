import os
from dotenv import load_dotenv

load_dotenv()

class Config:
    api_host: str = os.getenv("ML_API_HOST", "0.0.0.0")
    api_port: int = int(os.getenv("ML_API_PORT", "8000"))
    model_path: str = os.getenv("MODEL_PATH", "models/")
    data_path: str = os.getenv("DATA_PATH", "data/")
    feature_columns: list = [
        "home_win_rate", "away_win_rate",
        "home_avg_goals", "away_avg_goals",
        "home_avg_conceded", "away_avg_conceded",
        "home_xg", "away_xg",
        "home_form_score", "away_form_score",
        "h2h_home_wins", "h2h_away_wins", "h2h_draws",
    ]

config = Config()
