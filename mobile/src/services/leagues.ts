import axios from 'axios'
import { API_URL } from '../config'

const api = axios.create({ baseURL: API_URL })

api.interceptors.request.use(async (config) => {
  const AsyncStorage = require('@react-native-async-storage/async-storage').default
  const token = await AsyncStorage.getItem('token')
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
})

export const leaguesService = {
  getLeagues: async () => {
    const { data } = await api.get('/leagues')
    return data.leagues
  },
}
