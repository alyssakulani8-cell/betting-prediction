"""
Integration tests for the FastAPI endpoints.
Run with the ML API running: uvicorn main:app
Then: pytest scripts/tests/test_api.py -v
"""

import sys
from pathlib import Path
sys.path.append(str(Path(__file__).parent.parent.parent))

import pytest
from httpx import AsyncClient, ASGITransport
from main import app


@pytest.fixture
def client():
    transport = ASGITransport(app=app)
    return AsyncClient(transport=transport, base_url="http://test")


@pytest.mark.asyncio
async def test_health_endpoint(client):
    response = await client.get("/api/ml/health")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "ok"


@pytest.mark.asyncio
async def test_football_prediction(client):
    payload = {
        "home_team_id": "66",
        "away_team_id": "57",
        "home_team_name": "Manchester City",
        "away_team_name": "Arsenal",
        "league": "PL",
        "odds_home": 1.8,
        "odds_draw": 3.5,
        "odds_away": 4.5,
    }
    response = await client.post("/api/ml/predictions/football", json=payload)
    assert response.status_code == 200
    data = response.json()
    assert "prediction" in data
    assert "confidence" in data
    assert "home_win_prob" in data


@pytest.mark.asyncio
async def test_basketball_prediction(client):
    payload = {
        "home_team_id": "1",
        "away_team_id": "2",
        "home_team_name": "Boston Celtics",
        "away_team_name": "Los Angeles Lakers",
        "odds_home": 1.6,
        "odds_away": 2.4,
    }
    response = await client.post("/api/ml/predictions/basketball", json=payload)
    assert response.status_code == 200
    data = response.json()
    assert "prediction" in data
    assert "home_win_prob" in data
    assert "away_win_prob" in data


@pytest.mark.asyncio
async def test_prediction_batch(client):
    matches = [
        {"home_team_id": "66", "away_team_id": "57", "home_team_name": "Man City", "away_team_name": "Arsenal"},
        {"home_team_id": "73", "away_team_id": "61", "home_team_name": "Chelsea", "away_team_name": "Liverpool"},
    ]
    response = await client.post("/api/ml/predictions/football/batch", json=matches)
    assert response.status_code == 200
    data = response.json()
    assert len(data) == 2


@pytest.mark.asyncio
async def test_model_info(client):
    response = await client.get("/api/ml/predictions/model-info?sport=football")
    assert response.status_code in (200, 404)


@pytest.mark.asyncio
async def test_training_status(client):
    response = await client.get("/api/ml/training/status")
    assert response.status_code == 200


@pytest.mark.asyncio
async def test_feature_list(client):
    response = await client.get("/api/ml/data/features?sport=football")
    assert response.status_code == 200
    data = response.json()
    assert "features" in data
    assert len(data["features"]) > 0
