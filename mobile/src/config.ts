import { Platform } from 'react-native'

const DEV_API_URL = 'http://localhost:5000/api'
const PROD_API_URL = 'https://your-production-url.com/api'

const isAndroid = Platform.OS === 'android'

export const API_URL = __DEV__
  ? (isAndroid ? 'http://10.0.2.2:5000/api' : DEV_API_URL)
  : PROD_API_URL

export const config = {
  apiUrl: API_URL,
}
