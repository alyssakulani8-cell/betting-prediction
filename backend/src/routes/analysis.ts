import { Router, Request, Response } from 'express'
import { authenticate } from '../middleware/auth'

const router = Router()

router.get('/team/:teamId', authenticate, async (req: Request, res: Response) => {
  res.json({
    team: req.params.teamId,
    form: ['W', 'W', 'D', 'W', 'L'],
    avgGoalsScored: 1.8,
    avgGoalsConceded: 0.9,
    xGPerMatch: 2.1,
    xGAPerMatch: 1.1,
    possessionAvg: 58,
    cleanSheetPct: 0.35,
    bttsPct: 0.55,
  })
})

router.get('/head-to-head', authenticate, async (req: Request, res: Response) => {
  const { team1, team2 } = req.query
  res.json({
    team1,
    team2,
    totalMeetings: 24,
    team1Wins: 12,
    draws: 5,
    team2Wins: 7,
    lastMeetings: [
      { date: '2026-03-15', score: '2-1', winner: team1 },
      { date: '2025-11-20', score: '1-1', winner: null },
    ],
  })
})

export default router
