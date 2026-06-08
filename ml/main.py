from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from routers import predictions, training, data

app = FastAPI(title="Betting Prediction ML API", version="1.0.0")

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
    return {"status": "ok", "model_loaded": False}
