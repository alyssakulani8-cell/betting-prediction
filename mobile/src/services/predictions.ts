import axios from 'axios'
import { API_URL } from '../config'

const api = axios.create({ baseURL: API_URL })

api.interceptors.request.use(async (config) => {
  const AsyncStorage = require('@react-native-async-storage/async-storage').default
  const token = await AsyncStorage.getItem('token')
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
})

export const predictionsService = {
  getPredictions: async () => {
    const { data } = await api.get('/predictions')
    return data.predictions
  },
  getPredictionById: async (id: string) => {
    const { data } = await api.get(`/predictions/${id}`)
    return data
  },
}
