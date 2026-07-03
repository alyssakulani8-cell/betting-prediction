import axios from 'axios'

const api = axios.create({ baseURL: '/api' })
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token')
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
})

export const leaguesService = {
  getLeagues: async () => {
    const { data } = await api.get('/leagues')
    return data.leagues
  },
}
