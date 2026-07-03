export const LEAGUES = [
  { id: 'pl', name: 'Premier League', country: 'England', sport: 'football' },
  { id: 'laliga', name: 'La Liga', country: 'Spain', sport: 'football' },
  { id: 'sa', name: 'Serie A', country: 'Italy', sport: 'football' },
  { id: 'bl', name: 'Bundesliga', country: 'Germany', sport: 'football' },
  { id: 'ligue1', name: 'Ligue 1', country: 'France', sport: 'football' },
  { id: 'ucl', name: 'Champions League', country: 'Europe', sport: 'football' },
  { id: 'nba', name: 'NBA', country: 'USA', sport: 'basketball' },
  { id: 'ncaa', name: 'NCAA Basketball', country: 'USA', sport: 'basketball' },
  { id: 'euro', name: 'EuroLeague', country: 'Europe', sport: 'basketball' },
] as const

export const PREDICTION_OUTCOMES = ['HOME_WIN', 'DRAW', 'AWAY_WIN'] as const

export const API_ROUTES = {
  AUTH: {
    LOGIN: '/api/auth/login',
    REGISTER: '/api/auth/register',
    PROFILE: '/api/auth/profile',
  },
  PREDICTIONS: {
    BASE: '/api/predictions',
    BY_ID: (id: string) => `/api/predictions/${id}`,
    ANALYSIS: (id: string) => `/api/predictions/${id}/analysis`,
  },
  LEAGUES: {
    BASE: '/api/leagues',
  },
  ANALYSIS: {
    TEAM: (id: string) => `/api/analysis/team/${id}`,
    HEAD_TO_HEAD: '/api/analysis/head-to-head',
  },
  ML: {
    PREDICT: '/api/ml/predictions/predict',
    BATCH: '/api/ml/predictions/predict-batch',
    TRAIN: '/api/ml/training/train',
    TRAIN_STATUS: '/api/ml/training/status',
  },
  USER_PREDICTIONS: {
    BASE: '/api/user-predictions',
    BY_ID: (id: string) => `/api/user-predictions/${id}`,
  },
} as const

export const APP_NAME = 'BetPredict AI'
export const APP_DESCRIPTION = 'AI-Powered Precision Betting Predictions & Analysis'
