import { Router, Response, NextFunction } from 'express'
import { authenticate, AuthRequest } from '../middleware/auth'
import { prisma } from '../config/prisma'

const router = Router()

router.get('/overview', authenticate, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const predictions = await prisma.userPrediction.findMany({
      where: { userId: req.userId },
      include: {
        match: { include: { league: true, homeTeam: true, awayTeam: true } },
      },
      orderBy: { createdAt: 'desc' },
    })

    const total = predictions.length
    const resolved = predictions.filter((p) => p.isResolved)
    const wins = resolved.filter((p) => p.result === 'win').length
    const losses = resolved.filter((p) => p.result === 'loss').length
    const pushes = resolved.filter((p) => p.result === 'push').length

    const resolvedStaked = resolved.reduce((sum, p) => sum + (p.stake || 0), 0)
    const resolvedProfit = resolved.reduce((sum, p) => sum + (p.profit || 0), 0)

    const streaks = buildStreaks(resolved)
    const leagueBreakdown = buildLeagueBreakdown(resolved)
    const recentActivity = buildRecentActivity(predictions, 30)

    const winRate = resolved.length > 0 ? wins / resolved.length : 0

    res.json({
      totals: { total, resolved, wins, losses, pushes },
      financial: {
        totalStaked: resolvedStaked,
        totalProfit: resolvedProfit,
        roi: resolvedStaked > 0 ? (resolvedProfit / resolvedStaked) * 100 : 0,
        avgStake: resolved.length > 0 ? resolvedStaked / resolved.length : 0,
      },
      performance: {
        winRate: +winRate.toFixed(4),
        expectedWinRate: 0.4875,
        difference: +(winRate - 0.4875).toFixed(4),
      },
      streaks,
      leagueBreakdown,
      recentActivity,
    })
  } catch (err) {
    next(err)
  }
})

router.get('/history', authenticate, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const page = Math.max(1, parseInt(req.query.page as string) || 1)
    const limit = Math.min(50, Math.max(1, parseInt(req.query.limit as string) || 20))
    const league = req.query.league as string | undefined
    const result = req.query.result as string | undefined

    const where: Record<string, unknown> = { userId: req.userId }
    if (league) where.league = league
    if (result) where.result = result

    const [predictions, total] = await Promise.all([
      prisma.userPrediction.findMany({
        where: { userId: req.userId },
        include: {
          match: { include: { league: true, homeTeam: true, awayTeam: true, aiPrediction: true } },
        },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.userPrediction.count({ where: { userId: req.userId } }),
    ])

    res.json({
      predictions,
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    })
  } catch (err) {
    next(err)
  }
})

router.get('/discipline', authenticate, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const predictions = await prisma.userPrediction.findMany({
      where: { userId: req.userId, isResolved: true },
      orderBy: { createdAt: 'asc' },
    })

    const score = computeDisciplineScore(predictions)
    res.json(score)
  } catch (err) {
    next(err)
  }
})

function buildStreaks(resolved: Array<{ result: string | null; createdAt: Date }>) {
  let currentStreak = 0
  let currentType: 'win' | 'loss' | 'push' | null = null
  let longestWinStreak = 0
  let longestLossStreak = 0
  let tempWin = 0
  let tempLoss = 0

  for (const p of resolved) {
    if (p.result === 'win') {
      tempWin++
      tempLoss = 0
      longestWinStreak = Math.max(longestWinStreak, tempWin)
      if (currentStreak === 0 || currentType === 'win') {
        currentStreak++
        currentType = 'win'
      } else {
        currentStreak = 1
        currentType = 'win'
      }
    } else if (p.result === 'loss') {
      tempLoss++
      tempWin = 0
      longestLossStreak = Math.max(longestLossStreak, tempLoss)
      if (currentStreak === 0 || currentType === 'loss') {
        currentStreak++
        currentType = 'loss'
      } else {
        currentStreak = 1
        currentType = 'loss'
      }
    }
  }

  return {
    current: { type: currentType, count: currentStreak },
    longestWinStreak,
    longestLossStreak,
  }
}

function buildLeagueBreakdown(resolved: Array<{ result: string | null; match: { league: { name: string } } }>) {
  const byLeague: Record<string, { wins: number; losses: number; pushes: number; total: number }> = {}

  for (const p of resolved) {
    const league = p.match?.league?.name || 'Unknown'
    if (!byLeague[league]) byLeague[league] = { wins: 0, losses: 0, pushes: 0, total: 0 }
    byLeague[league].total++
    if (p.result === 'win') byLeague[league].wins++
    else if (p.result === 'loss') byLeague[league].losses++
    else if (p.result === 'push') byLeague[league].pushes++
  }

  return Object.entries(byLeague)
    .map(([league, stats]) => ({
      league,
      ...stats,
      winRate: stats.total > 0 ? +(stats.wins / stats.total).toFixed(4) : 0,
    }))
    .sort((a, b) => b.total - a.total)
}

function buildRecentActivity(
  predictions: Array<{ createdAt: Date; result: string | null; profit?: number | null }>,
  days: number,
) {
  const now = new Date()
  const cutoff = new Date(now.getTime() - days * 24 * 60 * 60 * 1000)
  const recent = predictions.filter((p) => new Date(p.createdAt) >= cutoff)

  const byDay: Record<string, { bets: number; wins: number; profit: number }> = {}
  for (const p of recent) {
    const day = new Date(p.createdAt).toISOString().split('T')[0]
    if (!byDay[day]) byDay[day] = { bets: 0, wins: 0, profit: 0 }
    byDay[day].bets++
    if (p.result === 'win') byDay[day].wins++
    byDay[day].profit += p.profit || 0
  }

  return Object.entries(byDay)
    .map(([date, stats]) => ({ date, ...stats }))
    .sort((a, b) => a.date.localeCompare(b.date))
}

function computeDisciplineScore(predictions: Array<{ result: string | null; stake: number | null; profit: number | null; createdAt: Date }>) {
  if (predictions.length < 5) {
    return { score: 50, grade: 'N/A - Need more data', factors: {} }
  }

  const stakes = predictions.map((p) => p.stake || 0)
  const profits = predictions.map((p) => p.profit || 0)
  const avgStake = stakes.reduce((a, b) => a + b, 0) / stakes.length

  const stakeConsistency = stakes.length > 1
    ? 1 - (Math.sqrt(stakes.reduce((sum, s) => sum + (s - avgStake) ** 2, 0) / stakes.length) / (avgStake || 1))
    : 0.5

  const winRate = predictions.filter((p) => p.result === 'win').length / predictions.length
  const expectedWinRate = 0.4875
  const performanceVsExpected = Math.max(0, Math.min(1, (winRate - (expectedWinRate - 0.1)) / 0.2))

  let chasingScore = 1
  let lossStreak = 0
  let prevProfit = 0
  for (const p of predictions) {
    if ((p.profit || 0) < 0 && prevProfit < 0) {
      lossStreak++
      if (lossStreak >= 3 && (p.stake || 0) > avgStake * 1.5) {
        chasingScore -= 0.15
      }
    } else {
      lossStreak = 0
    }
    prevProfit = p.profit || 0
  }
  chasingScore = Math.max(0, chasingScore)

  const consecutiveBetsPerDay = checkBingeBetting(predictions)
  const bingeScore = Math.max(0, 1 - consecutiveBetsPerDay * 0.1)

  const score = Math.round(
    (stakeConsistency * 30 + performanceVsExpected * 30 + chasingScore * 20 + bingeScore * 20),
  )

  return {
    score: Math.min(100, Math.max(0, score)),
    grade: score >= 80 ? 'A - Excellent' : score >= 60 ? 'B - Good' : score >= 40 ? 'C - Needs Improvement' : 'D - Warning',
    factors: {
      stakeConsistency: +stakeConsistency.toFixed(2),
      performanceVsExpected: +performanceVsExpected.toFixed(2),
      chasingLosses: +chasingScore.toFixed(2),
      bingeBetting: +bingeScore.toFixed(2),
    },
  }
}

function checkBingeBetting(predictions: Array<{ createdAt: Date }>): number {
  const byDay: Record<string, number> = {}
  for (const p of predictions) {
    const day = new Date(p.createdAt).toISOString().split('T')[0]
    byDay[day] = (byDay[day] || 0) + 1
  }
  const maxPerDay = Math.max(...Object.values(byDay), 0)
  return maxPerDay > 15 ? (maxPerDay - 15) / 10 : 0
}

export default router
