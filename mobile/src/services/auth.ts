import axios from 'axios'
import { API_URL } from '../config'

const api = axios.create({ baseURL: API_URL })

export const authService = {
  login: async (email: string, password: string) => {
    const { data } = await api.post('/auth/login', { email, password })
    return data
  },
  register: async (name: string, email: string, password: string) => {
    const { data } = await api.post('/auth/register', { name, email, password })
    return data
  },
  getProfile: async (token: string) => {
    const { data } = await api.get('/auth/profile', {
      headers: { Authorization: `Bearer ${token}` },
    })
    return data
  },
}
