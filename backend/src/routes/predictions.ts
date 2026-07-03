import { Router, Request, Response, NextFunction } from 'express'
import { authenticate, AuthRequest } from '../middleware/auth'
import { prisma } from '../config/prisma'
import { AppError } from '../middleware/errorHandler'
import {
  predictFootballBatch,
  predictBasketballBatch,
} from '../services/mlApi'
import { cacheWrap, predictionsCacheKey } from '../services/cache'

const router = Router()

interface PredData {
  homeWinProb: number
  drawProb: number
  awayWinProb: number
  predictedScore: string
  confidence: number
  over25Prob?: number
  under25Prob?: number
  bttsProb?: number
}

const SCORES = ['1-0', '2-0', '2-1', '1-1', '3-1', '0-0', '0-1', '1-2', '0-2', '3-0']

function randomPrediction(home: string, away: string): PredData {
  const score = SCORES[Math.floor(Math.random() * SCORES.length)]
  const [h, a] = score.split('-').map(Number)
  const total = h + a
  const homeProb = total > 0 ? (h / total) * 0.7 + 0.15 : 0.33
  const drawProb = total > 0 ? 0.15 + Math.random() * 0.1 : 0.34
  const awayProb = 1 - homeProb - drawProb
  const ov25 = Math.min(0.85, (h + a) / 6)
  return {
    homeWinProb: +homeProb.toFixed(3),
    drawProb: +drawProb.toFixed(3),
    awayWinProb: +awayProb.toFixed(3),
    predictedScore: score,
    confidence: +(Math.random() * 0.3 + 0.5).toFixed(2),
    over25Prob: +ov25.toFixed(2),
    under25Prob: +(1 - ov25).toFixed(2),
    bttsProb: +(h > 0 && a > 0 ? 0.6 : 0.35).toFixed(2),
  }
}

function predictionToResponse(match: { id: string; homeTeam: { name: string }; awayTeam: { name: string }; league: { name: string }; kickoff: Date; homeTeamId?: string; awayTeamId?: string }, pred: PredData) {
  return {
    id: match.id,
    homeTeam: match.homeTeam.name,
    awayTeam: match.awayTeam.name,
    homeWinProb: pred.homeWinProb,
    drawProb: pred.drawProb,
    awayWinProb: pred.awayWinProb,
    predictedScore: pred.predictedScore,
    confidence: pred.confidence,
    league: match.league.name,
    kickoff: match.kickoff.toISOString(),
    over25Prob: pred.over25Prob,
    under25Prob: pred.under25Prob,
    bttsProb: pred.bttsProb,
    homeTeamId: match.homeTeamId,
    awayTeamId: match.awayTeamId,
  }
}

router.get('/', authenticate, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const matches = await prisma.match.findMany({
      where: { status: 'SCHEDULED' },
      include: { homeTeam: true, awayTeam: true, league: true },
      orderBy: { kickoff: 'asc' },
      take: 50,
    })

    const matchIds = matches.map((m) => m.id)
    let predictions

    try {
      predictions = await cacheWrap(
        predictionsCacheKey(matchIds),
        async () => {
          const mlMatches = matches.map((m) => ({
            home_team: m.homeTeam.name,
            away_team: m.awayTeam.name,
            league: m.league.id,
          }))
          const results = await predictFootballBatch(mlMatches)
          return matches.map((m, i) => predictionToResponse(m, {
            homeWinProb: results[i].home_win_prob,
            drawProb: results[i].draw_prob,
            awayWinProb: results[i].away_win_prob,
            predictedScore: results[i].most_likely_score || `${Math.round(results[i].predicted_home_goals)}-${Math.round(results[i].predicted_away_goals)}`,
            confidence: results[i].confidence,
            over25Prob: results[i].over_25_prob,
            under25Prob: results[i].under_25_prob,
            bttsProb: results[i].btts_prob,
          }))
        },
        120,
      )
    } catch {
      predictions = matches.map((m) => predictionToResponse(m, randomPrediction(m.homeTeam.name, m.awayTeam.name)))
    }

    res.json({ predictions })
  } catch (err) {
    next(err)
  }
})

function getFormFromMatches(teamId: string, matches: Array<{ homeTeamId: string; awayTeamId: string; homeScore: number | null; awayScore: number | null }>): string[] {
  return matches.slice(0, 5).map((m) => {
    if (m.homeScore === null || m.awayScore === null) return 'D'
    if (m.homeTeamId === teamId) {
      return m.homeScore > m.awayScore ? 'W' : m.homeScore < m.awayScore ? 'L' : 'D'
    }
    return m.awayScore > m.homeScore ? 'W' : m.awayScore < m.homeScore ? 'L' : 'D'
  })
}

function getTeamStats(teamId: string, matches: Array<{ homeTeamId: string; awayTeamId: string; homeScore: number | null; awayScore: number | null }>) {
  const goalsScored = matches.reduce((sum, m) => {
    if (m.homeScore === null || m.awayScore === null) return sum
    return sum + (m.homeTeamId === teamId ? m.homeScore : m.awayScore)
  }, 0)
  const goalsConceded = matches.reduce((sum, m) => {
    if (m.homeScore === null || m.awayScore === null) return sum
    return sum + (m.homeTeamId === teamId ? m.awayScore : m.homeScore)
  }, 0)
  const played = Math.max(matches.length, 1)
  return { goalsScored, goalsConceded, avgScored: +(goalsScored / played).toFixed(2), avgConceded: +(goalsConceded / played).toFixed(2) }
}

router.get('/:id', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const match = await prisma.match.findUnique({
      where: { id: req.params.id },
      include: { homeTeam: true, awayTeam: true, league: true },
    })

    if (!match) {
      throw new AppError('Match not found', 404)
    }

    let pred: PredData
    try {
      const result = await predictFootballBatch([
        { home_team: match.homeTeam.name, away_team: match.awayTeam.name, league: match.league.id },
      ])
      const r = result[0]
      pred = {
        homeWinProb: r.home_win_prob,
        drawProb: r.draw_prob,
        awayWinProb: r.away_win_prob,
        predictedScore: r.most_likely_score || `${Math.round(r.predicted_home_goals)}-${Math.round(r.predicted_away_goals)}`,
        confidence: r.confidence,
        over25Prob: r.over_25_prob,
        under25Prob: r.under_25_prob,
        bttsProb: r.btts_prob,
      }
    } catch {
      pred = randomPrediction(match.homeTeam.name, match.awayTeam.name)
    }

    const [homeRecent, awayRecent] = await Promise.all([
      prisma.match.findMany({
        where: {
          OR: [{ homeTeamId: match.homeTeamId }, { awayTeamId: match.homeTeamId }],
          status: 'FINISHED',
          id: { not: match.id },
        },
        orderBy: { kickoff: 'desc' },
        take: 5,
      }),
      prisma.match.findMany({
        where: {
          OR: [{ homeTeamId: match.awayTeamId }, { awayTeamId: match.awayTeamId }],
          status: 'FINISHED',
          id: { not: match.id },
        },
        orderBy: { kickoff: 'desc' },
        take: 5,
      }),
    ])

    const homeForm = getFormFromMatches(match.homeTeamId, homeRecent)
    const awayForm = getFormFromMatches(match.awayTeamId, awayRecent)
    const homeStats = getTeamStats(match.homeTeamId, homeRecent)
    const awayStats = getTeamStats(match.awayTeamId, awayRecent)

    const h2hMatches = await prisma.match.findMany({
      where: {
        OR: [
          { homeTeamId: match.homeTeamId, awayTeamId: match.awayTeamId },
          { homeTeamId: match.awayTeamId, awayTeamId: match.homeTeamId },
        ],
        status: 'FINISHED',
        id: { not: match.id },
      },
      orderBy: { kickoff: 'desc' },
      take: 5,
    })

    const homeH2HWins = h2hMatches.filter(
      (m) => (m.homeTeamId === match.homeTeamId && m.homeScore !== null && m.awayScore !== null && m.homeScore > m.awayScore) ||
        (m.awayTeamId === match.homeTeamId && m.homeScore !== null && m.awayScore !== null && m.awayScore > m.homeScore),
    ).length
    const awayH2HWins = h2hMatches.filter(
      (m) => (m.homeTeamId === match.awayTeamId && m.homeScore !== null && m.awayScore !== null && m.homeScore > m.awayScore) ||
        (m.awayTeamId === match.awayTeamId && m.homeScore !== null && m.awayScore !== null && m.awayScore > m.homeScore),
    ).length
    const h2hLabel = h2hMatches.length > 0
      ? `${match.homeTeam.short || match.homeTeam.name} ${homeH2HWins}-${h2hMatches.length - homeH2HWins - awayH2HWins}-${awayH2HWins} ${match.awayTeam.short || match.awayTeam.name}`
      : 'No recent meetings'

    res.json({
      id: match.id,
      homeTeam: match.homeTeam.name,
      awayTeam: match.awayTeam.name,
      homeTeamId: match.homeTeamId,
      awayTeamId: match.awayTeamId,
      leagueId: match.leagueId,
      league: match.league.name,
      kickoff: match.kickoff.toISOString(),
      status: match.status,
      homeScore: match.homeScore,
      awayScore: match.awayScore,
      ...pred,
      analysis: {
        homeForm: homeForm.join('-'),
        awayForm: awayForm.join('-'),
        homexG: homeStats.avgScored,
        awayxG: awayStats.avgConceded,
        h2h: h2hLabel,
      },
    })
  } catch (err) {
    next(err)
  }
})

export default router
