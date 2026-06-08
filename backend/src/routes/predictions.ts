import { Router, Request, Response } from 'express'
import { authenticate } from '../middleware/auth'

const router = Router()

router.get('/', authenticate, async (_req: Request, res: Response) => {
  res.json({
    predictions: [
      {
        id: '1',
        homeTeam: 'Manchester City',
        awayTeam: 'Arsenal',
        homeWinProb: 0.52,
        drawProb: 0.25,
        awayWinProb: 0.23,
        predictedScore: '2-1',
        confidence: 0.78,
        league: 'Premier League',
        kickoff: '2026-06-10T15:00:00Z',
      },
    ],
  })
})

router.get('/:id', authenticate, async (req: Request, res: Response) => {
  res.json({
    id: req.params.id,
    homeTeam: 'Manchester City',
    awayTeam: 'Arsenal',
    homeWinProb: 0.52,
    drawProb: 0.25,
    awayWinProb: 0.23,
    predictedScore: '2-1',
    confidence: 0.78,
    analysis: {
      homeForm: 'W-W-D-W-W',
      awayForm: 'W-W-W-D-W',
      homexG: 2.1,
      awayxG: 1.4,
      h2h: 'MC 4-2 ARS',
    },
  })
})

export default router
