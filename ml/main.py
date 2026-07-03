from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager
from routers import predictions, training, data, learning
from services.model_service import model_service
from services.continuous_learning import continuous_learner
from data.sources.backend_db import compute_elo_from_backend


def preload_elo(sport: str = "football"):
    try:
        existing_state = model_service._elo_states.get(sport, {})
        if len(existing_state) >= 200:
            print(f"[startup] Using existing ELO state from training: {len(existing_state)} teams")
            return

        df = compute_elo_from_backend()
        if df is not None and len(df) > 0:
            from services.feature_engineering import FootballFeatureEngineer
            from services.team_names import normalize
            engineer = FootballFeatureEngineer()
            if existing_state:
                engineer.set_elo_state(existing_state)
            for i in range(len(df)):
                row = df.iloc[i]
                history = df.iloc[:i]
                home_name = normalize(str(row["home_team_name"]))
                away_name = normalize(str(row["away_team_name"]))
                engineer._compute_match_features(
                    row, history, home_name, away_name, 0,
                )
            elo_state = engineer.get_elo_state()
            print(f"[startup] Backend update: {len(elo_state)} teams total (was {len(existing_state)} from training)")
            model_service._elo_states[sport] = elo_state
            model_service._save_elo_state(sport)
            if sport in model_service._feature_engineers:
                model_service._feature_engineers[sport].set_elo_state(elo_state)
            top5 = sorted(elo_state.items(), key=lambda x: -x[1])[:5]
            for name, rating in top5:
                print(f"[startup]   {name}: {rating:.0f}")
    except Exception as e:
        print(f"[startup] Could not pre-load ELO: {e}")


@asynccontextmanager
async def lifespan(app: FastAPI):
    model_service.load_champion("football")
    model_service.load_champion("basketball")
    preload_elo("football")
    continuous_learner.start_scheduler(interval_seconds=3600)
    yield
    continuous_learner.stop_scheduler()


app = FastAPI(
    title="Betting Prediction ML API",
    version="2.0.0",
    lifespan=lifespan,
    docs_url="/api/ml/docs",
    openapi_url="/api/ml/openapi.json",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(predictions.router, prefix="/api/ml/predictions", tags=["predictions"])
app.include_router(training.router, prefix="/api/ml/training", tags=["training"])
app.include_router(data.router, prefix="/api/ml/data", tags=["data"])
app.include_router(learning.router, prefix="/api/ml/learning", tags=["learning"])


@app.get("/api/ml/health")
def health():
    return {
        "status": "ok",
        "football_model": model_service.get_champion_info("football") is not None,
        "basketball_model": model_service.get_champion_info("basketball") is not None,
        "version": "2.0.0",
    }
