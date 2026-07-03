import { Router, Request, Response, NextFunction } from 'express'
import { authenticate } from '../middleware/auth'
import { prisma } from '../config/prisma'
import { AppError } from '../middleware/errorHandler'
import { cacheWrap, teamAnalysisCacheKey } from '../services/cache'

const router = Router()

router.get('/team/:teamId', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await cacheWrap(
      teamAnalysisCacheKey(req.params.teamId),
      async () => {
        const team = await prisma.team.findUnique({ where: { id: req.params.teamId } })
        if (!team) {
          throw new AppError('Team not found', 404)
        }

        const recentMatches = await prisma.match.findMany({
          where: {
            OR: [{ homeTeamId: team.id }, { awayTeamId: team.id }],
            status: 'FINISHED',
          },
          include: { homeTeam: true, awayTeam: true },
          orderBy: { kickoff: 'desc' },
          take: 10,
        })

        const form: string[] = recentMatches.slice(0, 5).map((m) => {
          if (m.homeScore === null || m.awayScore === null) return 'D'
          if (m.homeTeamId === team.id) {
            return m.homeScore > m.awayScore ? 'W' : m.homeScore < m.awayScore ? 'L' : 'D'
          }
          return m.awayScore > m.homeScore ? 'W' : m.awayScore < m.homeScore ? 'L' : 'D'
        })

        const totalGoals = recentMatches.reduce((sum, m) => sum + (m.homeScore || 0) + (m.awayScore || 0), 0)
        const totalConceded = recentMatches.reduce(
          (sum, m) =>
            sum +
            (m.homeTeamId === team.id ? m.awayScore || 0 : m.homeScore || 0),
          0,
        )
        const totalPlayed = recentMatches.length || 1
        const cleanSheets = recentMatches.filter(
          (m) => (m.homeTeamId === team.id && m.awayScore === 0) || (m.awayTeamId === team.id && m.homeScore === 0),
        ).length
        const btts = recentMatches.filter(
          (m) => m.homeScore !== null && m.awayScore !== null && m.homeScore > 0 && m.awayScore > 0,
        ).length

        return {
          team: team.id,
          name: team.name,
          form: form.join('-'),
          avgGoalsScored: +(totalGoals / totalPlayed).toFixed(2),
          avgGoalsConceded: +(totalConceded / totalPlayed).toFixed(2),
          xGPerMatch: +(totalGoals / totalPlayed).toFixed(2),
          xGAPerMatch: +(totalConceded / totalPlayed).toFixed(2),
          possessionAvg: 50,
          cleanSheetPct: +(cleanSheets / totalPlayed).toFixed(2),
          bttsPct: +(btts / totalPlayed).toFixed(2),
        }
      },
      600,
    )

    res.json(result)
  } catch (err) {
    next(err)
  }
})

router.get('/head-to-head', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { team1, team2 } = req.query as { team1?: string; team2?: string }
    if (!team1 || !team2) {
      throw new AppError('team1 and team2 query params required', 400)
    }

    const matches = await prisma.match.findMany({
      where: {
        OR: [
          { homeTeamId: team1, awayTeamId: team2 },
          { homeTeamId: team2, awayTeamId: team1 },
        ],
        status: 'FINISHED',
      },
      include: { homeTeam: true, awayTeam: true },
      orderBy: { kickoff: 'desc' },
    })

    const team1Wins = matches.filter(
      (m) =>
        (m.homeTeamId === team1 && m.homeScore !== null && m.awayScore !== null && m.homeScore > m.awayScore) ||
        (m.awayTeamId === team1 && m.homeScore !== null && m.awayScore !== null && m.awayScore > m.homeScore),
    ).length
    const team2Wins = matches.filter(
      (m) =>
        (m.homeTeamId === team2 && m.homeScore !== null && m.awayScore !== null && m.homeScore > m.awayScore) ||
        (m.awayTeamId === team2 && m.homeScore !== null && m.awayScore !== null && m.awayScore > m.homeScore),
    ).length
    const draws = matches.length - team1Wins - team2Wins

    res.json({
      team1,
      team2,
      totalMeetings: matches.length,
      team1Wins,
      draws,
      team2Wins,
      lastMeetings: matches.slice(0, 5).map((m) => ({
        date: m.kickoff.toISOString().split('T')[0],
        score: `${m.homeScore ?? '?'}-${m.awayScore ?? '?'}`,
        winner: m.homeScore !== null && m.awayScore !== null
          ? m.homeScore > m.awayScore ? m.homeTeamId : m.awayScore > m.homeScore ? m.awayTeamId : null
          : null,
      })),
    })
  } catch (err) {
    next(err)
  }
})

export default router
