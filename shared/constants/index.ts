export const LEAGUES = [
  { id: 'pl', name: 'Premier League', country: 'England' },
  { id: 'laliga', name: 'La Liga', country: 'Spain' },
  { id: 'sa', name: 'Serie A', country: 'Italy' },
  { id: 'bl', name: 'Bundesliga', country: 'Germany' },
  { id: 'ligue1', name: 'Ligue 1', country: 'France' },
  { id: 'ucl', name: 'Champions League', country: 'Europe' },
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
} as const

export const APP_NAME = 'BetPredict AI'
export const APP_DESCRIPTION = 'AI-Powered Precision Betting Predictions & Analysis'
