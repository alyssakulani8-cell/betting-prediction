from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager
from routers import predictions, training, data
from services.model_service import model_service


@asynccontextmanager
async def lifespan(app: FastAPI):
    model_service.load_champion("football")
    model_service.load_champion("basketball")
    yield


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


@app.get("/api/ml/health")
def health():
    return {
        "status": "ok",
        "football_model": model_service.get_champion_info("football") is not None,
        "basketball_model": model_service.get_champion_info("basketball") is not None,
        "version": "2.0.0",
    }
