import { Router, Request, Response, NextFunction } from 'express'
import { authenticate, AuthRequest } from '../middleware/auth'
import { fetchFootballData, fetchLiveMatches, COMPETITIONS } from '../services/dataFetcher'
import { fetchBasketballData } from '../services/basketballFetcher'

const router = Router()

router.get('/competitions', (_req: Request, res: Response) => {
  res.json({ competitions: COMPETITIONS })
})

router.post('/fetch', authenticate, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const result = await fetchFootballData()
    res.json(result)
  } catch (err) {
    next(err)
  }
})

router.post('/live', authenticate, async (_req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const result = await fetchLiveMatches()
    res.json({ updated: result.length, matches: result })
  } catch (err) {
    next(err)
  }
})

router.post('/fetch-basketball', authenticate, async (_req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const result = await fetchBasketballData()
    res.json(result)
  } catch (err) {
    next(err)
  }
})

export default router