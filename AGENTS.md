# Betting Prediction AI - Project Map

## Overview
Monorepo for a personalized AI betting assistant: ML predictions → backend API → web/mobile frontends. Users get match predictions, coaching insights, responsible gambling tools, and CLV/EV analytics.

## Architecture
```
user → web (React/Vite) → backend (Express/Prisma/SQLite) → ml_api (FastAPI/XGBoost)
                                                    ↕
                                        CSV scraper (football-data.co.uk)
```

## Directory Structure
```
betting-prediction/
├── AGENTS.md              ← YOU ARE HERE
├── shared/                # Shared TypeScript types/constants
├── backend/               # Express + Prisma + SQLite
│   ├── prisma/schema.prisma   # Database schema (12 models)
│   └── src/
│       ├── index.ts           # Express app, route registration
│       ├── config/index.ts    # Env vars, ML API URL, JWT secret
│       ├── routes/
│       │   ├── predictions.ts     # GET /predictions, GET /predictions/:id
│       │   ├── auth.ts            # JWT login/register
│       │   ├── userPredictions.ts # CRUD user picks
│       │   ├── userAnalytics.ts   # GET /analytics/overview|discipline|history
│       │   ├── profile.ts         # Preferences, limits, cool-off, sessions
│       │   ├── coaching.ts        # GET /coaching/insights|tip
│       │   ├── clvEv.ts           # GET /analytics/clv|ev|ev/summary
│       │   ├── analysis.ts        # Team analysis, head-to-head
│       │   ├── matches.ts         # Match listings
│       │   ├── leagues.ts         # League data
│       │   └── data.ts            # Data endpoints
│       └── services/
│           ├── mlApi.ts           # Proxy to ML API (port 8000)
│           └── cache.ts           # Redis (graceful 3s timeout fallback)
├── web/                   # React + Vite + Tailwind + Recharts
│   └── src/
│       ├── App.tsx              # Routes (15 pages)
│       ├── components/          # Layout, Sidebar, Header, Charts
│       ├── pages/
│       │   ├── HomePage.tsx          # Live scores + today's matches
│       │   ├── PredictionsPage.tsx   # Match list with prediction bars
│       │   ├── MatchDetailPage.tsx   # /match/:id - score pred + pick UI
│       │   ├── AnalyticsDashboardPage.tsx  # /analytics - P&L, CLV/EV, streaks
│       │   ├── CoachingPage.tsx      # /coaching - insights + tips
│       │   ├── SessionsPage.tsx      # /sessions - betting session tracker
│       │   ├── MyPredictionsPage.tsx # User's saved picks
│       │   ├── AnalysisPage.tsx      # Team search + form analysis
│       │   ├── AccuracyPage.tsx      # ML model accuracy tracking
│       │   └── ...
│       └── services/
│           ├── analytics.ts      # All analytics + coaching + CLV/EV API calls
│           ├── auth.ts           # Auth API + token management
│           ├── userPredictions.ts # User prediction CRUD
│           └── ...
├── ml/                    # Python FastAPI + XGBoost
│   ├── main.py                # FastAPI app, lifespan, CORS
│   ├── config.py              # Dataclass config, feature column lists
│   ├── models/
│   │   └── registry.py        # ModelRegistry: champion loading, manifest
│   ├── services/
│   │   ├── model_service.py    # Singleton: predict, ELO, fallback, POISSON SCORE
│   │   ├── feature_engineering.py  # FootballFeatureEngineer + Basketball
│   │   ├── personalization.py      # User context adjustment (favorite team, league, risk)
│   │   ├── continuous_learning.py  # Background retraining + CSV data refresh
│   │   └── team_names.py           # 117 backend→canonical name mappings
│   ├── routers/
│   │   ├── predictions.py     # POST /football[/batch], /basketball[/batch], /reload
│   │   ├── training.py        # POST /train, GET /status|history
│   │   ├── learning.py        # POST /log-prediction, /resolve-match, /fetch-csv
│   │   └── data.py            # GET /football/matches, /upload
│   ├── data/
│   │   ├── orchestrator.py    # DataOrchestrator, fetch_football_uk_dataset()
│   │   └── sources/
│   │       ├── football_data_uk.py  # Free CSV scraper (19 leagues)
│   │       └── backend_db.py        # DB-to-DataFrame bridge
│   └── scripts/
│       ├── train_from_csv.py  # O(n) training script
│       ├── train_pipeline.py  # TrainingPipeline class
│       └── _scratch/          # Temp/debug scripts (safe to ignore)
└── mobile/                # React Native (not actively developed)
```

## Database (SQLite, Prisma)
12 models in `backend/prisma/schema.prisma`:
- `User`, `UserPreference`, `GamblingLimit`, `BettingSession`  — users & limits
- `League`, `Team`, `Match`, `MatchOdds`, `AiPrediction`       — match data
- `UserPrediction` — user picks with stake, odds, betType, CLV/EV fields
- `ModelRecord`, `PredictionCache`   — ML model tracking

## Running the Project
```bash
# Backend (port 5000)
cd backend && npm run dev

# ML API (port 8000)
cd ml && python -m uvicorn main:app --host 0.0.0.0 --port 8000

# Frontend (port 3000, proxies /api → :5000)
cd web && npm run dev
```

## Key Data Flows
1. **Prediction**: web → GET /api/predictions → backend → POST /api/ml/predictions/football/batch → XGBoost → probabilities + POISSON score → response
2. **Personalized Prediction**: same + user_context (favorite_teams, risk_tolerance, league_accuracy) → adjust_probabilities() post-processing
3. **Analytics**: web → GET /api/analytics/overview → Prisma aggregation of UserPrediction
4. **Coaching**: GET /api/coaching/insights → prism query → generateInsights() + detectPsychologicalPatterns()
5. **CLV/EV**: GET /api/analytics/ev/summary → compares user's taken odds vs closing odds + ML probability × odds - 1

## ML Model
- **Champion**: v20260701_183243, XGBoost 800 estimators, 48.75% CV accuracy
- **Training**: 49,898 matches (48,665 CSV + 1,233 backend), 469 teams, 19 competitions
- **Features** (11 used): elo_home, elo_away, elo_diff, home/away_win_rate_10/38, home/away_avg_goals_scored/conceded_10
- **ELO**: 469 teams persisted in models/registry/football_ensemble/elo_state.json
- **Score Prediction**: Poisson from rolling goal averages (not ML - separate statistical estimation)
- **Personalization**: Post-processing on probabilities — favorite team bias, league accuracy, risk tolerance

## API Endpoints
| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | /api/auth/register | - | Create account |
| POST | /api/auth/login | - | JWT token |
| GET | /api/predictions | JWT | Upcoming matches with predictions |
| GET | /api/predictions/:id | JWT | Match detail + analysis + score pred |
| GET/PUT | /api/profile/preferences | JWT | Betting preferences |
| PUT | /api/profile/limits | JWT | Gambling limits |
| POST/DELETE | /api/profile/cool-off | JWT | Cool-off period mgmt |
| GET | /api/profile/limits/status | JWT | Real-time limit check |
| POST | /api/profile/session/start|end | JWT | Session tracking |
| GET | /api/profile/sessions | JWT | Session history |
| GET | /api/analytics/overview | JWT | P&L, ROI, streaks, leagues |
| GET | /api/analytics/discipline | JWT | Composite 0-100 score |
| GET | /api/analytics/clv | JWT | Closing Line Value breakdown |
| GET | /api/analytics/ev | JWT | Expected Value per bet |
| GET | /api/analytics/ev/summary | JWT | Aggregated CLV + EV stats |
| GET | /api/coaching/insights | JWT | 10 personalized insights |
| GET | /api/coaching/tip | JWT | Random coaching tip |
| POST | /api/ml/predictions/football | - | ML prediction (+ optional user_context) |
| POST | /api/ml/predictions/football/batch | - | Batch predictions |
| GET | /api/ml/predictions/model-info | - | Champion model metadata |

## Psychological Patterns (Coaching)
- Late-night betting (>30% between 11pm-6am)
- Stake escalation (>50% increase over time)
- Tilt betting (upped stakes after losses)
- Binge betting (≥10 bets/day)
- Round-the-clock betting (18+ active hours)
- Loss chasing escalation (rising loss rate + rising stakes)

## Conventions
- **TypeScript**: Interfaces over types, `import type` where applicable
- **Python**: Type hints everywhere, dataclasses for config, snake_case
- **React**: Functional components, hooks, no class components
- **Tailwind**: Utility classes, custom theme in tailwind.config.js
- **NPM workspaces**: `shared/` package for cross-project types
- **Error handling**: Backend uses AppError class + errorHandler middleware
- **Auth**: JWT in localStorage, Authorization Bearer header, ProtectedRoute wrapper

## Files Created Recently (this session)
- `ml/services/personalization.py` — User context → probability adjustment
- `backend/src/routes/clvEv.ts` — CLV + EV tracking endpoints
- `web/src/services/analytics.ts` — Frontend analytics API service
- `web/src/pages/AnalyticsDashboardPage.tsx` — Performance dashboard
- `web/src/pages/CoachingPage.tsx` — Coaching insights UI
- `web/src/pages/SessionsPage.tsx` — Session tracker UI
- `web/src/pages/MatchDetailPage.tsx` — Match detail + pick UI

## Important Gotchas
- SQLite (not PostgreSQL) — use `prisma db push`, not `migrate`
- Redis not always available — 3s socket timeout, degrades gracefully
- ML model predicts 1X2 only; score/O/U/BTTS are Poisson estimates from rolling averages
- Team name normalization: `ml/services/team_names.py` maps 117 backend names → canonical
- ELO state preserved across restarts — 469 teams in elo_state.json
