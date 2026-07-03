import { Router, Response, NextFunction } from 'express'
import { authenticate, AuthRequest } from '../middleware/auth'
import { prisma } from '../config/prisma'

const router = Router()

router.get('/clv', authenticate, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const predictions = await prisma.userPrediction.findMany({
      where: { userId: req.userId, isResolved: true, odds: { not: null } },
      include: {
        match: {
          include: { odds: true, league: true, homeTeam: true, awayTeam: true },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: 200,
    })

    const clvData = predictions.map((p) => {
      const matchOdds = p.match?.odds
      if (!matchOdds) return null

      let takenImpliedProb = p.odds ? 1 / p.odds : null
      let closingImpliedProb: number | null = null

      if (p.predictedWinner === 'HOME_WIN' && matchOdds.homeWin) {
        closingImpliedProb = 1 / matchOdds.homeWin
      } else if (p.predictedWinner === 'AWAY_WIN' && matchOdds.awayWin) {
        closingImpliedProb = 1 / matchOdds.awayWin
      } else if (p.predictedWinner === 'DRAW' && matchOdds.draw) {
        closingImpliedProb = 1 / matchOdds.draw
      }

      if (takenImpliedProb === null || closingImpliedProb === null) return null

      const clv = takenImpliedProb - closingImpliedProb
      return {
        matchId: p.matchId,
        league: p.match?.league?.name || 'Unknown',
        homeTeam: p.match?.homeTeam?.name || '',
        awayTeam: p.match?.awayTeam?.name || '',
        result: p.result,
        predictedWinner: p.predictedWinner,
        takenOdds: p.odds,
        closingOdds: matchOdds.homeWin || matchOdds.awayWin || matchOdds.draw || 0,
        takenImpliedProb: +takenImpliedProb.toFixed(4),
        closingImpliedProb: +closingImpliedProb.toFixed(4),
        clv: +clv.toFixed(4),
        createdAt: p.createdAt,
      }
    }).filter(Boolean)

    const validClv = clvData.filter((d) => d !== null) as NonNullable<typeof clvData[0]>[]
    const avgClv = validClv.length > 0
      ? validClv.reduce((sum, d) => sum + d.clv, 0) / validClv.length
      : 0

    res.json({
      totalSettled: validClv.length,
      avgClv: +avgClv.toFixed(4),
      positiveClvCount: validClv.filter((d) => d.clv > 0).length,
      negativeClvCount: validClv.filter((d) => d.clv < 0).length,
      clvData: validClv.slice(0, 50),
    })
  } catch (err) {
    next(err)
  }
})

router.get('/ev', authenticate, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const predictions = await prisma.userPrediction.findMany({
      where: { userId: req.userId, isResolved: true, odds: { not: null } },
      include: {
        match: {
          include: { aiPrediction: true, league: true, homeTeam: true, awayTeam: true },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: 200,
    })

    const evData = predictions.map((p) => {
      const ai = p.match?.aiPrediction
      if (!ai || !p.odds) return null

      let mlProb: number | null = null
      if (p.predictedWinner === 'HOME_WIN' && ai.homeWinProb != null) {
        mlProb = ai.homeWinProb
      } else if (p.predictedWinner === 'AWAY_WIN' && ai.awayWinProb != null) {
        mlProb = ai.awayWinProb
      } else if (p.predictedWinner === 'DRAW' && ai.drawProb != null) {
        mlProb = ai.drawProb
      }

      if (mlProb === null) return null

      const ev = mlProb * p.odds - 1

      return {
        matchId: p.matchId,
        league: p.match?.league?.name || 'Unknown',
        homeTeam: p.match?.homeTeam?.name || '',
        awayTeam: p.match?.awayTeam?.name || '',
        result: p.result,
        predictedWinner: p.predictedWinner,
        mlProb: +mlProb.toFixed(4),
        odds: p.odds,
        ev: +ev.toFixed(4),
        isPositiveEv: ev > 0,
        createdAt: p.createdAt,
      }
    }).filter(Boolean)

    const validEv = evData.filter((d) => d !== null) as NonNullable<typeof evData[0]>[]
    const avgEv = validEv.length > 0
      ? validEv.reduce((sum, d) => sum + d.ev, 0) / validEv.length
      : 0
    const positiveEvCount = validEv.filter((d) => d.isPositiveEv).length

    res.json({
      totalSettled: validEv.length,
      avgEv: +avgEv.toFixed(4),
      totalEv: +(validEv.reduce((sum, d) => sum + d.ev, 0)).toFixed(4),
      positiveEvCount,
      negativeEvCount: validEv.length - positiveEvCount,
      evData: validEv.slice(0, 50),
    })
  } catch (err) {
    next(err)
  }
})

router.get('/ev/summary', authenticate, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const predictions = await prisma.userPrediction.findMany({
      where: { userId: req.userId, isResolved: true, odds: { not: null } },
      include: {
        match: { include: { aiPrediction: true, odds: true } },
      },
      orderBy: { createdAt: 'desc' },
    })

    let totalClv = 0
    let clvCount = 0
    let totalEv = 0
    let evCount = 0
    let positiveEvWins = 0
    let positiveEvTotal = 0
    let negativeEvWins = 0
    let negativeEvTotal = 0

    for (const p of predictions) {
      const ai = p.match?.aiPrediction
      const matchOdds = p.match?.odds

      if (p.odds && ai) {
        let mlProb: number | null = null
        if (p.predictedWinner === 'HOME_WIN' && ai.homeWinProb != null) mlProb = ai.homeWinProb
        else if (p.predictedWinner === 'AWAY_WIN' && ai.awayWinProb != null) mlProb = ai.awayWinProb
        else if (p.predictedWinner === 'DRAW' && ai.drawProb != null) mlProb = ai.drawProb

        if (mlProb !== null) {
          const ev = mlProb * p.odds - 1
          totalEv += ev
          evCount++

          if (ev > 0) {
            positiveEvTotal++
            if (p.result === 'win') positiveEvWins++
          } else {
            negativeEvTotal++
            if (p.result === 'win') negativeEvWins++
          }
        }
      }

      if (p.odds && matchOdds) {
        let closingOdds: number | null = null
        if (p.predictedWinner === 'HOME_WIN') closingOdds = matchOdds.homeWin
        else if (p.predictedWinner === 'AWAY_WIN') closingOdds = matchOdds.awayWin
        else if (p.predictedWinner === 'DRAW') closingOdds = matchOdds.draw

        if (closingOdds) {
          const takenIp = 1 / p.odds
          const closingIp = 1 / closingOdds
          totalClv += takenIp - closingIp
          clvCount++
        }
      }
    }

    res.json({
      clv: {
        avgClv: clvCount > 0 ? +(totalClv / clvCount).toFixed(4) : 0,
        sampleSize: clvCount,
        totalClv: +totalClv.toFixed(4),
      },
      ev: {
        avgEv: evCount > 0 ? +(totalEv / evCount).toFixed(4) : 0,
        sampleSize: evCount,
        totalEv: +totalEv.toFixed(4),
        positiveEvAccuracy: positiveEvTotal > 0 ? +((positiveEvWins / positiveEvTotal) * 100).toFixed(1) : 0,
        negativeEvAccuracy: negativeEvTotal > 0 ? +((negativeEvWins / negativeEvTotal) * 100).toFixed(1) : 0,
        positiveEvCount: positiveEvTotal,
        negativeEvCount: negativeEvTotal,
      },
    })
  } catch (err) {
    next(err)
  }
})

export default router
