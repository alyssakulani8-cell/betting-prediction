import { Router, Request, Response, NextFunction } from 'express'
import { authenticate } from '../middleware/auth'
import { prisma } from '../config/prisma'
import { AppError } from '../middleware/errorHandler'
import {
  predictFootballBatch,
} from '../services/mlApi'

const router = Router()

router.get('/', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const league = req.query.league as string | undefined
    const status = req.query.status as string | undefined
    const date = req.query.date as string | undefined
    const tab = req.query.tab as string | undefined
    const sport = req.query.sport as string | undefined

    const where: Record<string, unknown> = {}

    if (league) where.leagueId = league
    if (sport) {
      const sportLeagues = await prisma.league.findMany({ where: { sport }, select: { id: true } })
      where.leagueId = { in: sportLeagues.map((l) => l.id) }
    }

    const now = new Date()
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
    const tomorrow = new Date(today.getTime() + 86400000)

    if (tab === 'live') {
      where.status = 'LIVE'
    } else if (tab === 'today') {
      where.kickoff = { gte: today, lt: tomorrow }
      where.status = 'SCHEDULED'
    } else if (tab === 'upcoming') {
      where.kickoff = { gte: tomorrow }
      where.status = 'SCHEDULED'
    } else {
      if (status) where.status = status
      if (date) {
        const dayStart = new Date(date)
        const dayEnd = new Date(dayStart.getTime() + 86400000)
        where.kickoff = { gte: dayStart, lt: dayEnd }
      }
    }

    const matches = await prisma.match.findMany({
      where,
      include: {
        homeTeam: true,
        awayTeam: true,
        league: true,
        odds: true,
        aiPrediction: true,
      },
      orderBy: [{ kickoff: 'asc' }],
      take: 100,
    })

    res.json({ matches })
  } catch (err) {
    next(err)
  }
})

router.get('/leagues', authenticate, async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const leagues = await prisma.league.findMany({
      include: { _count: { select: { matches: true } } },
      orderBy: { name: 'asc' },
    })
    res.json({ leagues })
  } catch (err) {
    next(err)
  }
})

router.get('/grouped', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const tab = req.query.tab as string | undefined
    const sport = req.query.sport as string | undefined
    const now = new Date()
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
    const tomorrow = new Date(today.getTime() + 86400000)

    let matchFilter: Record<string, unknown> = {}

    if (tab === 'live') {
      matchFilter.status = 'LIVE'
    } else if (tab === 'upcoming') {
      matchFilter.kickoff = { gte: tomorrow }
      matchFilter.status = 'SCHEDULED'
    } else {
      matchFilter.kickoff = { gte: today, lt: tomorrow }
      matchFilter.status = 'SCHEDULED'
    }
    const leagues = await prisma.league.findMany({
      where: sport ? { sport } : {},
      include: {
        matches: {
          where: matchFilter,
          include: {
            homeTeam: true,
            awayTeam: true,
            odds: true,
            aiPrediction: true,
          },
          orderBy: { kickoff: 'asc' },
          take: 20,
        },
      },
      orderBy: { name: 'asc' },
    })

    const grouped = leagues
      .filter((l) => l.matches.length > 0)
      .map((l) => ({
        id: l.id,
        name: l.name,
        country: l.country,
        sport: l.sport,
        matchCount: l.matches.length,
        matches: l.matches,
      }))

    const totalCount = grouped.reduce((s, g) => s + g.matchCount, 0)

    res.json({ leagues: grouped, totalCount })
  } catch (err) {
    next(err)
  }
})

router.post('/resolve', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { matchId, homeScore, awayScore } = req.body
    if (!matchId || homeScore === undefined || awayScore === undefined) {
      throw new AppError('matchId, homeScore, awayScore required', 400)
    }

    const match = await prisma.match.findUnique({ where: { id: matchId } })
    if (!match) {
      throw new AppError('Match not found', 404)
    }

    const updated = await prisma.match.update({
      where: { id: matchId },
      data: { homeScore, awayScore, status: 'FINISHED' },
    })

    const winner = homeScore > awayScore ? match.homeTeamId : homeScore < awayScore ? match.awayTeamId : null

    const userPredictions = await prisma.userPrediction.findMany({ where: { matchId } })
    for (const up of userPredictions) {
      const isCorrect =
        (up.predictedWinner === 'HOME_WIN' && winner === match.homeTeamId) ||
        (up.predictedWinner === 'AWAY_WIN' && winner === match.awayTeamId) ||
        (up.predictedWinner === 'DRAW' && winner === null)
      await prisma.userPrediction.update({
        where: { id: up.id },
        data: { result: isCorrect ? 'correct' : 'incorrect' },
      })
    }

    try {
      const axios = require('axios')
      await axios.post(
        `${process.env.ML_API_URL || 'http://localhost:8000'}/api/ml/learning/resolve-match`,
        { match_id: matchId, home_score: homeScore, away_score: awayScore },
      )
    } catch { }

    res.json({ match: updated, predictionsResolved: userPredictions.length })
  } catch (err) {
    next(err)
  }
})

router.post('/analyze', authenticate, async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const now = new Date()
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
    const tomorrow = new Date(today.getTime() + 86400000)

    const matches = await prisma.match.findMany({
      where: {
        kickoff: { gte: today, lt: tomorrow },
        status: 'SCHEDULED',
      },
      include: {
        homeTeam: true,
        awayTeam: true,
        league: true,
        odds: true,
        aiPrediction: true,
      },
      orderBy: { kickoff: 'asc' },
    })

    const mlInputs = matches.map((m) => ({
      home_team: m.homeTeam.name,
      away_team: m.awayTeam.name,
      league: m.leagueId,
    }))

    let mlResults: any[] | null = null
    try {
      mlResults = await predictFootballBatch(mlInputs)
    } catch {
      // fallback handled in service
    }

    const analyzed = matches.map((m, i) => {
      const ml = mlResults?.[i]
      const aiPrediction = m.aiPrediction
      return {
        id: m.id,
        homeTeam: m.homeTeam.name,
        awayTeam: m.awayTeam.name,
        league: m.league.name,
        kickoff: m.kickoff.toISOString(),
        status: m.status,
        odds: m.odds
          ? {
              homeWin: m.odds.homeWin,
              draw: m.odds.draw,
              awayWin: m.odds.awayWin,
              overUnder: m.odds.overUnder,
              overPrice: m.odds.overPrice,
              underPrice: m.odds.underPrice,
              bttsYes: m.odds.bttsYes,
              bttsNo: m.odds.bttsNo,
            }
          : null,
        prediction: ml
          ? {
              homeWinProb: ml.home_win_prob,
              drawProb: ml.draw_prob,
              awayWinProb: ml.away_win_prob,
              confidence: ml.confidence,
              source: 'ml_model',
            }
          : aiPrediction
            ? {
                homeWinProb: aiPrediction.homeWinProb,
                drawProb: aiPrediction.drawProb,
                awayWinProb: aiPrediction.awayWinProb,
                confidence: aiPrediction.confidence,
                source: 'database',
              }
            : null,
      }
    })

    res.json({
      total: analyzed.length,
      matches: analyzed,
      timestamp: new Date().toISOString(),
    })
  } catch (err) {
    next(err)
  }
})

export default router
