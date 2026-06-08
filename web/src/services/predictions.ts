import axios from 'axios'

const api = axios.create({ baseURL: '/api' })

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token')
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

export const predictionsService = {
  getPredictions: async (params?: { league?: string; date?: string }) => {
    const { data } = await api.get('/predictions', { params })
    return data
  },
  getPredictionById: async (id: string) => {
    const { data } = await api.get(`/predictions/${id}`)
    return data
  },
  getAnalysis: async (matchId: string) => {
    const { data } = await api.get(`/predictions/${matchId}/analysis`)
    return data
  },
}
