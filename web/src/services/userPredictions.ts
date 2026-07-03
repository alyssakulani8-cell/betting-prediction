import axios from 'axios'

const api = axios.create({ baseURL: '/api' })
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token')
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
})

export const userPredictionsService = {
  getAll: async () => {
    const { data } = await api.get('/user-predictions')
    return data
  },
  getById: async (id: string) => {
    const { data } = await api.get(`/user-predictions/${id}`)
    return data
  },
  create: async (matchId: string, predictedWinner: string, confidence: number) => {
    const { data } = await api.post('/user-predictions', { matchId, predictedWinner, confidence })
    return data
  },
  update: async (id: string, updates: { predictedWinner?: string; confidence?: number }) => {
    const { data } = await api.patch(`/user-predictions/${id}`, updates)
    return data
  },
  delete: async (id: string) => {
    const { data } = await api.delete(`/user-predictions/${id}`)
    return data
  },
}
