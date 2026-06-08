import express from 'express'
import cors from 'cors'
import helmet from 'helmet'
import morgan from 'morgan'
import { config } from './config'
import { errorHandler } from './middleware/errorHandler'
import authRoutes from './routes/auth'
import predictionRoutes from './routes/predictions'
import leagueRoutes from './routes/leagues'
import analysisRoutes from './routes/analysis'

const app = express()

app.use(helmet())
app.use(cors({ origin: ['http://localhost:3000'], credentials: true }))
app.use(morgan('dev'))
app.use(express.json())

app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() })
})

app.use('/api/auth', authRoutes)
app.use('/api/predictions', predictionRoutes)
app.use('/api/leagues', leagueRoutes)
app.use('/api/analysis', analysisRoutes)

app.use(errorHandler)

app.listen(config.port, () => {
  console.log(`Server running on port ${config.port}`)
})

export default app
