import axios from 'axios'

const api = axios.create({ baseURL: '/api' })

export const authService = {
  login: async (email: string, password: string) => {
    const { data } = await api.post('/auth/login', { email, password })
    return data
  },
  register: async (name: string, email: string, password: string) => {
    const { data } = await api.post('/auth/register', { name, email, password })
    return data
  },
  getProfile: async () => {
    const token = localStorage.getItem('token')
    const { data } = await api.get('/auth/profile', {
      headers: { Authorization: `Bearer ${token}` },
    })
    return data
  },
}
