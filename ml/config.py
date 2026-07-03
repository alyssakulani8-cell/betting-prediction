import os
from dotenv import load_dotenv
from dataclasses import dataclass, field
from typing import List

load_dotenv()


@dataclass
class Config:
    api_host: str = os.getenv("ML_API_HOST", "0.0.0.0")
    api_port: int = int(os.getenv("ML_API_PORT", "8000"))

    model_path: str = os.getenv("MODEL_PATH", "models/")
    data_path: str = os.getenv("DATA_PATH", "data/")
    cache_path: str = os.getenv("CACHE_PATH", "data/cache/")
    registry_path: str = os.getenv("REGISTRY_PATH", "models/registry/")

    football_api_key: str = os.getenv("FOOTBALL_DATA_API_KEY", "")
    odds_api_key: str = os.getenv("ODDS_API_KEY", "")
    basketball_api_key: str = os.getenv("BASKETBALL_API_KEY", "")
    backend_db_path: str = os.getenv("BACKEND_DB_PATH", "")

    football_base_url: str = "https://api.football-data.org/v4/"
    odds_base_url: str = "https://api.the-odds-api.com/v4/"
    basketball_base_url: str = "https://api.balldontlie.io/v1/"

    n_folds: int = int(os.getenv("N_FOLDS", "5"))
    cv_strategy: str = os.getenv("CV_STRATEGY", "time_series")
    test_size: float = float(os.getenv("TEST_SIZE", "0.15"))
    val_size: float = float(os.getenv("VAL_SIZE", "0.10"))

    optuna_trials: int = int(os.getenv("OPTUNA_TRIALS", "50"))
    optuna_timeout: int = int(os.getenv("OPTUNA_TIMEOUT", "3600"))

    min_training_samples: int = int(os.getenv("MIN_TRAINING_SAMPLES", "500"))
    retrain_frequency_days: int = int(os.getenv("RETRAIN_FREQUENCY_DAYS", "7"))

    football_feature_columns: List[str] = field(default_factory=lambda: [
        "elo_home", "elo_away", "elo_diff",
        "home_win_rate_10", "away_win_rate_10",
        "home_win_rate_38", "away_win_rate_38",
        "home_avg_goals_scored_10", "away_avg_goals_scored_10",
        "home_avg_goals_conceded_10", "away_avg_goals_conceded_10",
        "home_xg_avg_10", "away_xg_avg_10",
        "home_xga_avg_10", "away_xga_avg_10",
        "home_form_decay", "away_form_decay",
        "home_strength_of_schedule", "away_strength_of_schedule",
        "h2h_home_win_rate", "h2h_total_meetings",
        "home_rest_days", "away_rest_days",
        "home_injury_index", "away_injury_index",
        "home_cup_motivation", "away_cup_motivation",
        "is_derby", "is_promotion_relegation",
        "home_travel_distance", "away_travel_distance",
        "odds_home", "odds_draw", "odds_away",
        "odds_movement_home", "odds_movement_draw", "odds_movement_away",
        "market_volume",
    ])

    basketball_feature_columns: List[str] = field(default_factory=lambda: [
        "elo_home", "elo_away", "elo_diff",
        "home_win_rate_10", "away_win_rate_10",
        "home_ats_cover_rate_10", "away_ats_cover_rate_10",
        "home_avg_points_scored_10", "away_avg_points_scored_10",
        "home_avg_points_conceded_10", "away_avg_points_conceded_10",
        "home_avg_rebounds_10", "away_avg_rebounds_10",
        "home_avg_assists_10", "away_avg_assists_10",
        "home_avg_turnovers_10", "away_avg_turnovers_10",
        "home_form_decay", "away_form_decay",
        "home_pace_10", "away_pace_10",
        "home_offensive_rating_10", "away_offensive_rating_10",
        "home_defensive_rating_10", "away_defensive_rating_10",
        "h2h_home_win_rate", "h2h_total_meetings",
        "home_rest_days", "away_rest_days",
        "home_injury_index", "away_injury_index",
        "home_back_to_back", "away_back_to_back",
        "home_travel_distance", "away_travel_distance",
        "odds_home", "odds_away",
        "odds_movement_home", "odds_movement_away",
        "total_line", "market_volume",
    ])


config = Config()
