import axios from 'axios'

const api = axios.create({ baseURL: '/api' })
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token')
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
})

export interface AnalyticsOverview {
  totals: { total: number; resolved: number; wins: number; losses: number; pushes: number }
  financial: { totalStaked: number; totalProfit: number; roi: number; avgStake: number }
  performance: { winRate: number; expectedWinRate: number; difference: number }
  streaks: { current: { type: string | null; count: number }; longestWinStreak: number; longestLossStreak: number }
  leagueBreakdown: Array<{ league: string; wins: number; losses: number; pushes: number; total: number; winRate: number }>
  recentActivity: Array<{ date: string; bets: number; wins: number; profit: number }>
}

export interface DisciplineScore {
  score: number
  grade: string
  factors: { stakeConsistency: number; performanceVsExpected: number; chasingLosses: number; bingeBetting: number }
}

export interface CoachingInsight {
  type: string
  severity: 'positive' | 'info' | 'warning' | 'danger'
  title: string
  message: string
}

export interface ClvSummary {
  clv: { avgClv: number; sampleSize: number; totalClv: number }
  ev: {
    avgEv: number; sampleSize: number; totalEv: number
    positiveEvAccuracy: number; negativeEvAccuracy: number
    positiveEvCount: number; negativeEvCount: number
  }
}

export interface PreferenceUpdate {
  notificationLevel?: string
  favoriteLeagues?: string[]
  favoriteTeams?: string[]
  preferredBetTypes?: string[]
  riskTolerance?: string
  maxStake?: number | null
  monthlyBudget?: number | null
  maxDailyBets?: number | null
}

export interface GamblingLimitUpdate {
  dailyLossLimit?: number | null
  weeklyLossLimit?: number | null
  monthlyDepositLimit?: number | null
  maxStakePerBet?: number | null
}

export interface SessionData {
  id: string
  startTime: string
  endTime: string | null
  betsPlaced: number
  totalStake: number
  netProfit: number
  status: string
}

export const analyticsService = {
  getOverview: async () => {
    const { data } = await api.get<AnalyticsOverview>('/analytics/overview')
    return data
  },
  getDiscipline: async () => {
    const { data } = await api.get<DisciplineScore>('/analytics/discipline')
    return data
  },
  getHistory: async (page = 1, limit = 20, league?: string, result?: string) => {
    const params: Record<string, string | number> = { page, limit }
    if (league) params.league = league
    if (result) params.result = result
    const { data } = await api.get('/analytics/history', { params })
    return data
  },
  getCoachingInsights: async () => {
    const { data } = await api.get<{ insights: CoachingInsight[] }>('/coaching/insights')
    return data.insights
  },
  getCoachingTip: async () => {
    const { data } = await api.get<{ tip: { text: string; category: string } }>('/coaching/tip')
    return data.tip
  },
  getClvSummary: async () => {
    const { data } = await api.get<ClvSummary>('/analytics/clv')
    return data
  },
  getEvSummary: async () => {
    const { data } = await api.get('/analytics/ev')
    return data
  },
  getEvOverall: async () => {
    const { data } = await api.get<ClvSummary>('/analytics/ev/summary')
    return data
  },
  getPreferences: async () => {
    const { data } = await api.get('/profile/preferences')
    return data
  },
  updatePreferences: async (updates: PreferenceUpdate) => {
    const { data } = await api.put('/profile/preferences', updates)
    return data
  },
  updateLimits: async (updates: GamblingLimitUpdate) => {
    const { data } = await api.put('/profile/limits', updates)
    return data
  },
  getLimitsStatus: async () => {
    const { data } = await api.get('/profile/limits/status')
    return data
  },
  startCoolOff: async (hours: number) => {
    const { data } = await api.post('/profile/cool-off', { hours })
    return data
  },
  endCoolOff: async () => {
    const { data } = await api.delete('/profile/cool-off')
    return data
  },
  startSession: async () => {
    const { data } = await api.post('/profile/session/start')
    return data
  },
  endSession: async () => {
    const { data } = await api.post('/profile/session/end')
    return data
  },
  getSessions: async () => {
    const { data } = await api.get<{ sessions: SessionData[] }>('/profile/sessions')
    return data.sessions
  },
}
