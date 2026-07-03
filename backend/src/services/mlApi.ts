import axios from 'axios'
import { config } from '../config'

export interface PredictionRequest {
  home_team: string
  away_team: string
  league?: string
  features?: Record<string, number>
}

export interface PredictionResponse {
  home_win_prob: number
  draw_prob: number
  away_win_prob: number
  predicted_home_goals: number
  predicted_away_goals: number
  confidence: number
  over_25_prob?: number
  under_25_prob?: number
  btts_prob?: number
  most_likely_score?: string
}

const client = axios.create({
  baseURL: config.ml.apiUrl,
  timeout: 15000,
  headers: { 'Content-Type': 'application/json' },
})

export async function predictFootball(match: PredictionRequest): Promise<PredictionResponse> {
  const payload = {
    home_team_id: match.home_team.toLowerCase().replace(/\s+/g, '_'),
    away_team_id: match.away_team.toLowerCase().replace(/\s+/g, '_'),
    home_team_name: match.home_team,
    away_team_name: match.away_team,
    league: match.league || 'PL',
    season: '2024',
  }
  const { data } = await client.post('/predictions/football', payload)
  return mapMlResponse(data)
}

export async function predictBasketball(match: PredictionRequest): Promise<PredictionResponse> {
  const payload = {
    home_team_id: match.home_team.toLowerCase().replace(/\s+/g, '_'),
    away_team_id: match.away_team.toLowerCase().replace(/\s+/g, '_'),
    home_team_name: match.home_team,
    away_team_name: match.away_team,
  }
  const { data } = await client.post('/predictions/basketball', payload)
  return mapMlResponse(data)
}

export async function predictFootballBatch(matches: PredictionRequest[]): Promise<PredictionResponse[]> {
  const payload = matches.map((m) => ({
    home_team_id: m.home_team.toLowerCase().replace(/\s+/g, '_'),
    away_team_id: m.away_team.toLowerCase().replace(/\s+/g, '_'),
    home_team_name: m.home_team,
    away_team_name: m.away_team,
    league: m.league || 'PL',
    season: '2024',
  }))
  const { data } = await client.post('/predictions/football/batch', payload)
  return (data as any[]).map(mapMlResponse)
}

export async function predictBasketballBatch(matches: PredictionRequest[]): Promise<PredictionResponse[]> {
  const payload = matches.map((m) => ({
    home_team_id: m.home_team.toLowerCase().replace(/\s+/g, '_'),
    away_team_id: m.away_team.toLowerCase().replace(/\s+/g, '_'),
    home_team_name: m.home_team,
    away_team_name: m.away_team,
  }))
  const { data } = await client.post('/predictions/basketball/batch', payload)
  return (data as any[]).map(mapMlResponse)
}

export async function getModelInfo(): Promise<Record<string, unknown>> {
  const { data } = await client.get('/predictions/model-info')
  return data
}

export async function getTrainingStatus(): Promise<Record<string, unknown>> {
  const { data } = await client.get('/training/status')
  return data
}

function mapMlResponse(r: any): PredictionResponse {
  return {
    home_win_prob: r.home_win_prob ?? 0.33,
    draw_prob: r.draw_prob ?? 0.34,
    away_win_prob: r.away_win_prob ?? 0.33,
    predicted_home_goals: r.predicted_home_goals ?? Math.round((r.home_win_prob ?? 0.33) * 3),
    predicted_away_goals: r.predicted_away_goals ?? Math.round((r.away_win_prob ?? 0.33) * 3),
    confidence: r.confidence ?? 0.5,
    over_25_prob: r.over_25_prob,
    under_25_prob: r.under_25_prob,
    btts_prob: r.btts_prob,
    most_likely_score: r.most_likely_score,
  }
}
