import axios from 'axios'

const api = axios.create({ baseURL: '/api' })
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token')
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
})

export const analysisService = {
  getTeamAnalysis: async (teamId: string) => {
    const { data } = await api.get(`/analysis/team/${teamId}`)
    return data
  },
  getHeadToHead: async (team1: string, team2: string) => {
    const { data } = await api.get('/analysis/head-to-head', { params: { team1, team2 } })
    return data
  },
}
