import { Router, Response, NextFunction } from 'express'
import { authenticate, AuthRequest } from '../middleware/auth'
import { prisma } from '../config/prisma'

const router = Router()

router.get('/insights', authenticate, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const predictions = await prisma.userPrediction.findMany({
      where: { userId: req.userId, isResolved: true },
      include: {
        match: { include: { league: true, homeTeam: true, awayTeam: true, aiPrediction: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: 200,
    })

    const preferences = await prisma.userPreference.findUnique({ where: { userId: req.userId } })
    const gamblingLimit = await prisma.gamblingLimit.findUnique({ where: { userId: req.userId } })

    const insights = generateInsights(predictions, preferences, gamblingLimit)
    res.json({ insights })
  } catch (err) {
    next(err)
  }
})

router.get('/tip', authenticate, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const recent = await prisma.userPrediction.findMany({
      where: { userId: req.userId, isResolved: true },
      include: {
        match: { include: { league: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: 50,
    })

    const tip = generateTip(recent)
    res.json({ tip })
  } catch (err) {
    next(err)
  }
})

function generateInsights(
  predictions: Array<{
    id?: string
    result: string | null
    stake: number | null
    profit: number | null
    createdAt: Date
    match: {
      league: { name: string }
      homeTeam: { name: string }
      awayTeam: { name: string }
      aiPrediction: { homeWinProb: number; drawProb: number | null; awayWinProb: number } | null
    }
  }>,
  preferences: { favoriteLeagues?: string | null; favoriteTeams?: string | null; maxStake?: number | null } | null,
  gamblingLimit: { dailyLossLimit?: number | null; coolOffUntil?: Date | null } | null,
) {
  const insights: Array<{ type: string; severity: 'positive' | 'info' | 'warning' | 'danger'; title: string; message: string }> = []

  if (predictions.length < 10) {
    insights.push({
      type: 'beginner',
      severity: 'info',
      title: 'Welcome to Betting Coach',
      message: 'Place more predictions to receive personalized coaching insights about your betting patterns.',
    })
    return insights
  }

  const wins = predictions.filter((p) => p.result === 'win').length
  const losses = predictions.filter((p) => p.result === 'loss').length
  const total = wins + losses
  const winRate = total > 0 ? wins / total : 0

  const totalStake = predictions.reduce((sum, p) => sum + (p.stake || 0), 0)
  const totalProfit = predictions.reduce((sum, p) => sum + (p.profit || 0), 0)
  const roi = totalStake > 0 ? (totalProfit / totalStake) * 100 : 0

  const byLeague: Record<string, { wins: number; losses: number; stake: number; profit: number }> = {}
  for (const p of predictions) {
    const league = p.match?.league?.name || 'Unknown'
    if (!byLeague[league]) byLeague[league] = { wins: 0, losses: 0, stake: 0, profit: 0 }
    byLeague[league].wins += p.result === 'win' ? 1 : 0
    byLeague[league].losses += p.result === 'loss' ? 1 : 0
    byLeague[league].stake += p.stake || 0
    byLeague[league].profit += p.profit || 0
  }

  const bestLeague = Object.entries(byLeague)
    .map(([league, s]) => ({ league, winRate: (s.wins + s.losses) > 0 ? s.wins / (s.wins + s.losses) : 0, ...s }))
    .filter((s) => (s.wins + s.losses) >= 3)
    .sort((a, b) => b.winRate - a.winRate)[0]

  const worstLeague = Object.entries(byLeague)
    .map(([league, s]) => ({ league, winRate: (s.wins + s.losses) > 0 ? s.wins / (s.wins + s.losses) : 0, ...s }))
    .filter((s) => (s.wins + s.losses) >= 3)
    .sort((a, b) => a.winRate - b.winRate)[0]

  if (bestLeague && bestLeague.winRate > 0.6) {
    insights.push({
      type: 'league_strength',
      severity: 'positive',
      title: 'Your Best League',
      message: `You win ${(bestLeague.winRate * 100).toFixed(0)}% of bets in ${bestLeague.league}. Consider focusing more here.`,
    })
  }

  if (worstLeague && worstLeague.winRate < 0.35 && (worstLeague.wins + worstLeague.losses) >= 5) {
    insights.push({
      type: 'league_weakness',
      severity: 'warning',
      title: 'Tough League',
      message: `You win only ${(worstLeague.winRate * 100).toFixed(0)}% in ${worstLeague.league}. Maybe reduce stakes here.`,
    })
  }

  if (winRate < 0.4 && total >= 20) {
    insights.push({
      type: 'overall_performance',
      severity: 'danger',
      title: 'Performance Alert',
      message: `Your win rate is ${(winRate * 100).toFixed(0)}%, below the expected ~49%. Consider reviewing your strategy.`,
    })
  }

  if (winRate > 0.55 && total >= 20) {
    insights.push({
      type: 'overall_performance',
      severity: 'positive',
      title: 'Great Performance',
      message: `You're winning ${(winRate * 100).toFixed(0)}% of bets — above the expected 49%. Keep it up!`,
    })
  }

  if (roi < -20 && total >= 15) {
    insights.push({
      type: 'negative_roi',
      severity: 'danger',
      title: 'Losses Adding Up',
      message: `Your ROI is ${roi.toFixed(1)}%. Consider lowering stakes until performance improves.`,
    })
  }

  if (roi > 10 && total >= 15) {
    insights.push({
      type: 'positive_roi',
      severity: 'positive',
      title: 'Profitable Bettor',
      message: `Your ROI is +${roi.toFixed(1)}%. You're beating the market!`,
    })
  }

  let lossStreak = 0
  let maxLossStreak = 0
  for (const p of predictions) {
    if (p.result === 'loss') {
      lossStreak++
      maxLossStreak = Math.max(maxLossStreak, lossStreak)
    } else if (p.result === 'win') {
      lossStreak = 0
    }
  }

  const recent5 = predictions.slice(0, 5)
  const recentLosses = recent5.filter((p) => p.result === 'loss').length

  if (recentLosses >= 4) {
    const avgStake = predictions.reduce((s, p) => s + (p.stake || 0), 0) / predictions.length
    const recentAvgStake = recent5.reduce((s, p) => s + (p.stake || 0), 0) / recent5.length
    const isChasing = recentAvgStake > avgStake * 1.3

    insights.push({
      type: 'loss_streak',
      severity: isChasing ? 'danger' : 'warning',
      title: isChasing ? 'Chasing Losses Detected' : 'Recent Losses',
      message: isChasing
        ? `You've lost ${recentLosses} of the last 5 bets and your stake increased ${Math.round((recentAvgStake / avgStake - 1) * 100)}%. This pattern can lead to bigger losses.`
        : `You've lost ${recentLosses} of the last 5 bets. Maybe take a break?`,
    })
  }

  if (predictions.length >= 10) {
    const profitByDay: Record<string, number> = {}
    for (const p of predictions) {
      const day = new Date(p.createdAt).toISOString().split('T')[0]
      profitByDay[day] = (profitByDay[day] || 0) + (p.profit || 0)
    }

    const daysWithLosses = Object.entries(profitByDay).filter(([, profit]) => profit < 0).length
    const totalDays = Object.keys(profitByDay).length
    if (totalDays >= 5 && daysWithLosses / totalDays > 0.7) {
      insights.push({
        type: 'frequent_loss_days',
        severity: 'warning',
        title: 'Frequent Losing Days',
        message: `You lose money on ${(daysWithLosses / totalDays * 100).toFixed(0)}% of betting days. Consider setting a daily loss limit.`,
      })
    }
  }

  if (predictions.length >= 20) {
    const recent10 = predictions.slice(0, 10)
    const older10 = predictions.slice(10, 20)
    const recentWR = recent10.filter((p) => p.result === 'win').length / 10
    const olderWR = older10.filter((p) => p.result === 'win').length / 10

    if (recentWR < olderWR - 0.15) {
      insights.push({
        type: 'declining_performance',
        severity: 'warning',
        title: 'Performance Declining',
        message: `Your last 10 bets (${(recentWR * 100).toFixed(0)}% win) are worse than the previous 10 (${(olderWR * 100).toFixed(0)}%). Time to re-evaluate.`,
      })
    }
  }

  const totalBets = predictions.length
  const betsPerDay = totalBets / Math.max(1, getDaysSinceFirstPrediction(predictions as Array<{ createdAt: Date }>))
  if (betsPerDay > 5 && totalBets >= 30) {
    insights.push({
      type: 'high_frequency',
      severity: 'warning',
      title: 'High Betting Frequency',
      message: `You average ${betsPerDay.toFixed(1)} bets per day. Higher frequency often correlates with lower returns. Quality over quantity.`,
    })
  }

  if (gamblingLimit?.coolOffUntil && new Date(gamblingLimit.coolOffUntil) > new Date()) {
    insights.push({
      type: 'cool_off_active',
      severity: 'info',
      title: 'Cool-Off Active',
      message: `Your cool-off period is active until ${new Date(gamblingLimit.coolOffUntil).toISOString().split('T')[0]}. Use this time to reflect.`,
    })
  }

  const accuracyDiff = compareToModelAccuracy(predictions)
  if (accuracyDiff !== null) {
    insights.push({
      type: 'model_comparison',
      severity: accuracyDiff > 0 ? 'positive' : 'info',
      title: 'vs. AI Model',
      message: accuracyDiff > 0
        ? `You beat the AI model by ${(accuracyDiff * 100).toFixed(1)}%! Your instincts are sharp.`
        : `The AI model is outperforming you by ${(Math.abs(accuracyDiff) * 100).toFixed(1)}%. Consider checking its predictions before betting.`,
    })
  }

  const psychPatterns = detectPsychologicalPatterns(predictions)
  for (const p of psychPatterns) {
    insights.push(p)
  }

  insights.sort((a, b) => {
    const severityRank = { danger: 0, warning: 1, info: 2, positive: 3 }
    return (severityRank[a.severity] || 99) - (severityRank[b.severity] || 99)
  })

  return insights.slice(0, 10)
}

function generateTip(recent: any[]) {
  const tips = [
    { text: 'Focus on leagues you know best — knowledge is your edge.', category: 'strategy' },
    { text: 'Avoid betting on every match. Pick your spots carefully.', category: 'discipline' },
    { text: 'Track your bets to identify patterns in your wins and losses.', category: 'analytics' },
    { text: 'Set a budget before you start and stick to it.', category: 'bankroll' },
    { text: 'Don\'t chase losses. Take a break and come back fresh.', category: 'psychology' },
    { text: 'Bet with your head, not your heart. Avoid betting on your favorite team.', category: 'psychology' },
    { text: 'Compare your predictions with the AI model to calibrate your instincts.', category: 'strategy' },
    { text: 'Small consistent profits beat big risky bets over time.', category: 'bankroll' },
    { text: 'The best bettors win ~55% of the time. Anything above is exceptional.', category: 'expectations' },
    { text: 'Line shop across bookmakers for the best odds on your selection.', category: 'strategy' },
  ]

  const losses = recent.filter((p) => p.result === 'loss').length
  const recentProfit = recent.slice(0, 5).reduce((s, p) => s + (p.profit || 0), 0)

  if (losses >= 3 && recentProfit < 0) {
    tips.unshift({
      text: 'You\'re on a rough patch. Consider halving your stakes until you\'re back in profit.',
      category: 'bankroll',
    })
  }

  return tips[Math.floor(Math.random() * tips.length)]
}

function detectPsychologicalPatterns(
  predictions: Array<{
    id?: string
    result: string | null
    stake: number | null
    profit: number | null
    createdAt: Date
    match: {
      league: { name: string }
      homeTeam: { name: string }
      awayTeam: { name: string }
    }
  }>,
): Array<{ type: string; severity: 'positive' | 'info' | 'warning' | 'danger'; title: string; message: string }> {
  const insights: Array<{ type: string; severity: 'positive' | 'info' | 'warning' | 'danger'; title: string; message: string }> = []

  if (predictions.length < 10) return insights

  const sorted = [...predictions].sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime())

  const hourDistribution: Record<number, number> = {}
  for (const p of sorted) {
    const hour = new Date(p.createdAt).getHours()
    hourDistribution[hour] = (hourDistribution[hour] || 0) + 1
  }

  const lateNightBets = Object.entries(hourDistribution)
    .filter(([hour]) => {
      const h = parseInt(hour)
      return h >= 23 || h < 6
    })
    .reduce((sum, [, count]) => sum + count, 0)

  const lateNightPct = lateNightBets / sorted.length
  if (lateNightPct > 0.3 && lateNightBets >= 5) {
    insights.push({
      type: 'late_night_betting',
      severity: 'warning',
      title: 'Late-Night Betting Pattern',
      message: `${(lateNightPct * 100).toFixed(0)}% of your bets are placed between 11pm-6am. Late-night betting is associated with reduced impulse control.`,
    })
  }

  const stakes = sorted.map((p) => p.stake || 0)
  if (stakes.length >= 10) {
    const firstHalf = stakes.slice(0, Math.floor(stakes.length / 2))
    const secondHalf = stakes.slice(Math.floor(stakes.length / 2))
    const avgFirst = firstHalf.reduce((s, v) => s + v, 0) / firstHalf.length
    const avgSecond = secondHalf.reduce((s, v) => s + v, 0) / secondHalf.length

    if (avgSecond > avgFirst * 1.5 && avgFirst > 0) {
      const increasePct = ((avgSecond / avgFirst) - 1) * 100
      insights.push({
        type: 'stake_escalation',
        severity: 'danger',
        title: 'Stake Escalation Warning',
        message: `Your average stake has increased ${increasePct.toFixed(0)}% over time. This pattern often precedes problem gambling. Consider freezing your stakes.`,
      })
    }
  }

  let tiltBets = 0
  let tiltLosses = 0
  let consecutiveLosses = 0
  for (const p of sorted) {
    if (p.result === 'loss' && p.profit != null && p.profit < 0) {
      consecutiveLosses++
      if (consecutiveLosses >= 2 && (p.stake || 0) > 0) {
        tiltBets++
        tiltLosses++
      }
    } else {
      consecutiveLosses = 0
    }
  }

  if (tiltBets >= 3) {
    insights.push({
      type: 'tilt_betting',
      severity: 'danger',
      title: 'Tilt Betting Detected',
      message: `You placed ${tiltBets} bets immediately after a loss where stakes increased. This "tilt" behavior is a classic gambling pitfall. Take a break after losses.`,
    })
  }

  const favoriteTeamBets = sorted.filter((p) => {
    const home = p.match?.homeTeam?.name?.toLowerCase() || ''
    const away = p.match?.awayTeam?.name?.toLowerCase() || ''
    return false
  }).length

  const byDay: Record<string, number> = {}
  for (const p of sorted) {
    const day = new Date(p.createdAt).toISOString().split('T')[0]
    byDay[day] = (byDay[day] || 0) + 1
  }

  const bingeDays = Object.entries(byDay).filter(([, count]) => count >= 10)
  if (bingeDays.length > 0) {
    const maxBinge = Math.max(...Object.values(byDay))
    insights.push({
      type: 'binge_betting',
      severity: 'warning',
      title: 'Binge Betting Days',
      message: `You placed ${maxBinge} bets in a single day. High-volume betting days are associated with poorer decision-making and larger losses.`,
    })
  }

  const activeHours = Object.keys(hourDistribution).length
  if (activeHours >= 18 && sorted.length >= 30) {
    insights.push({
      type: 'round_clock_betting',
      severity: 'info',
      title: 'Around-the-Clock Betting',
      message: `You bet across ${activeHours} different hours of the day. Betting at all hours can indicate compulsive behavior. Try setting specific betting windows.`,
    })
  }

  if (predictions.length >= 20) {
    const recent = predictions.slice(0, 10)
    const recentBets = recent.length
    const older = predictions.slice(10, 20)
    const olderBets = older.length

    if (recentBets > 0 && olderBets > 0) {
      const recentLosses = recent.filter((p) => p.result === 'loss').length
      const olderLosses = older.filter((p) => p.result === 'loss').length
      const recentLossRate = recentLosses / recentBets
      const olderLossRate = olderLosses / olderBets

      if (recentLossRate > olderLossRate + 0.2 && recentLossRate > 0.5) {
        const avgRecentStake = recent.reduce((s, p) => s + (p.stake || 0), 0) / recentBets
        const avgOlderStake = older.reduce((s, p) => s + (p.stake || 0), 0) / olderBets

        if (avgRecentStake > avgOlderStake * 1.2) {
          insights.push({
            type: 'loss_chasing_escalation',
            severity: 'danger',
            title: 'Loss Chasing + Stake Increase',
            message: `Your loss rate increased from ${(olderLossRate * 100).toFixed(0)}% to ${(recentLossRate * 100).toFixed(0)}% AND your stakes increased ${Math.round((avgRecentStake / avgOlderStake - 1) * 100)}%. This is a dangerous combination — consider a cool-off period.`,
          })
        }
      }
    }
  }

  return insights
}

function getDaysSinceFirstPrediction(predictions: Array<{ createdAt: Date }>): number {
  if (predictions.length === 0) return 1
  const first = new Date(predictions[predictions.length - 1].createdAt)
  return Math.max(1, (Date.now() - first.getTime()) / 86400000)
}

function compareToModelAccuracy(
  predictions: Array<{
    result: string | null
    match: { aiPrediction: { homeWinProb: number; drawProb: number | null; awayWinProb: number } | null }
  }>,
): number | null {
  const withModel = predictions.filter((p) => p.match?.aiPrediction && p.result)
  if (withModel.length < 10) return null

  const modelCorrect = withModel.filter((p) => {
    const ai = p.match.aiPrediction!
    const modelPrediction = ai.homeWinProb > ai.awayWinProb
      ? 'home_win'
      : ai.awayWinProb > ai.homeWinProb
        ? 'away_win'
        : 'draw'
    const actual = p.result
    return (modelPrediction === 'home_win' && actual === 'win') ||
           (modelPrediction === 'away_win' && actual === 'win') ||
           (modelPrediction === 'draw' && actual === 'push')
  }).length

  const userCorrect = withModel.filter((p) => p.result === 'win').length

  return (userCorrect / withModel.length) - (modelCorrect / withModel.length)
}

export default router
