export interface User {
  id: string
  email: string
  name: string
}

export interface UserPrediction {
  id: string
  userId: string
  matchId: string
  predictedWinner: 'HOME_WIN' | 'DRAW' | 'AWAY_WIN'
  confidence: number
  result: string | null
  profit: number | null
  createdAt: string
  match: {
    id: string
    homeTeam: { id: string; name: string; short?: string }
    awayTeam: { id: string; name: string; short?: string }
    league: { id: string; name: string; country: string }
    homeScore: number | null
    awayScore: number | null
    status: string
    kickoff: string
    aiPrediction?: {
      homeWinProb: number
      drawProb: number | null
      awayWinProb: number
      confidence: number
    } | null
  }
}

export interface Prediction {
  id: string
  homeTeam: string
  awayTeam: string
  homeWinProb: number
  drawProb: number
  awayWinProb: number
  predictedScore: string
  confidence: number
  league: string
  kickoff: string
}

export interface TeamAnalysis {
  teamId: string
  form: string[]
  avgGoalsScored: number
  avgGoalsConceded: number
  xGPerMatch: number
  xGAPerMatch: number
  possessionAvg: number
  cleanSheetPct: number
  bttsPct: number
}

export interface League {
  id: string
  name: string
  country: string
  logo: string
}

export interface MLFeatures {
  home_win_rate: number
  away_win_rate: number
  home_avg_goals: number
  away_avg_goals: number
  home_avg_conceded: number
  away_avg_conceded: number
  home_xg: number
  away_xg: number
  home_form_score: number
  away_form_score: number
  h2h_home_wins: number
  h2h_away_wins: number
  h2h_draws: number
}

export interface MLPredictionResult {
  home_win_prob: number
  draw_prob: number
  away_win_prob: number
  predicted_home_goals: number
  predicted_away_goals: number
  confidence: number
}
