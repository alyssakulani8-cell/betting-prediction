import axios from 'axios'

const api = axios.create({ baseURL: '/api' })
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token')
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
})

export const matchesService = {
  getGrouped: async (tab?: string, sport?: string) => {
    const params: Record<string, string> = {}
    if (tab) params.tab = tab
    if (sport) params.sport = sport
    const { data } = await api.get('/matches/grouped', { params })
    return data
  },
  getAll: async (params?: { league?: string; status?: string; date?: string; tab?: string; sport?: string }) => {
    const { data } = await api.get('/matches', { params })
    return data
  },
  analyzeAll: async () => {
    const { data } = await api.post('/matches/analyze')
    return data
  },
}
