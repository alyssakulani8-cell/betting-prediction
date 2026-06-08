import dotenv from 'dotenv'
dotenv.config()

export const config = {
  port: parseInt(process.env.PORT || '5000', 10),
  nodeEnv: process.env.NODE_ENV || 'development',
  jwt: {
    secret: process.env.JWT_SECRET || 'fallback-secret',
    expiresIn: process.env.JWT_EXPIRES_IN || '7d',
  },
  redis: {
    url: process.env.REDIS_URL || 'redis://localhost:6379',
  },
  ml: {
    apiUrl: process.env.ML_API_URL || 'http://localhost:8000',
  },
  apis: {
    footballData: process.env.FOOTBALL_DATA_API_KEY,
    odds: process.env.ODDS_API_KEY,
  },
}
