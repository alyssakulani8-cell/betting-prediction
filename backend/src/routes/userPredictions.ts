import { Router, Response, NextFunction } from 'express'
import { z } from 'zod'
import { authenticate, AuthRequest } from '../middleware/auth'
import { prisma } from '../config/prisma'
import { AppError } from '../middleware/errorHandler'

const router = Router()

const createSchema = z.object({
  matchId: z.string().uuid(),
  predictedWinner: z.enum(['HOME_WIN', 'DRAW', 'AWAY_WIN']),
  confidence: z.number().min(0).max(1),
  stake: z.number().min(0).optional(),
  odds: z.number().min(1).optional(),
  betType: z.enum(['moneyline', 'spread', 'over_under']).optional(),
  spread: z.number().optional(),
  overUnder: z.number().optional(),
})

router.post('/', authenticate, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { matchId, predictedWinner, confidence, stake, odds, betType, spread, overUnder } = createSchema.parse(req.body)

    const match = await prisma.match.findUnique({ where: { id: matchId } })
    if (!match) {
      throw new AppError('Match not found', 404)
    }

    const existing = await prisma.userPrediction.findFirst({
      where: { userId: req.userId, matchId },
    })
    if (existing) {
      throw new AppError('You already have a prediction for this match', 409)
    }

    const prediction = await prisma.userPrediction.create({
      data: {
        userId: req.userId!,
        matchId,
        predictedWinner,
        confidence,
        stake: stake || 0,
        odds: odds || null,
        betType: betType || 'moneyline',
        spread: spread || null,
        overUnder: overUnder || null,
      },
      include: {
        match: {
          include: { homeTeam: true, awayTeam: true, league: true },
        },
      },
    })

    res.status(201).json({ prediction })
  } catch (err) {
    next(err instanceof z.ZodError ? new AppError('Invalid input', 400) : err)
  }
})

router.get('/', authenticate, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const predictions = await prisma.userPrediction.findMany({
      where: { userId: req.userId },
      include: {
        match: {
          include: { homeTeam: true, awayTeam: true, league: true, aiPrediction: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    })

    res.json({ predictions })
  } catch (err) {
    next(err)
  }
})

router.get('/:id', authenticate, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const prediction = await prisma.userPrediction.findFirst({
      where: { id: req.params.id, userId: req.userId },
      include: {
        match: {
          include: { homeTeam: true, awayTeam: true, league: true, aiPrediction: true },
        },
      },
    })

    if (!prediction) {
      throw new AppError('Prediction not found', 404)
    }

    res.json({ prediction })
  } catch (err) {
    next(err)
  }
})

const updateSchema = z.object({
  predictedWinner: z.enum(['HOME_WIN', 'DRAW', 'AWAY_WIN']).optional(),
  confidence: z.number().min(0).max(1).optional(),
})

router.patch('/:id', authenticate, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const data = updateSchema.parse(req.body)

    const existing = await prisma.userPrediction.findFirst({
      where: { id: req.params.id, userId: req.userId },
    })
    if (!existing) {
      throw new AppError('Prediction not found', 404)
    }

    const prediction = await prisma.userPrediction.update({
      where: { id: req.params.id },
      data,
      include: {
        match: {
          include: { homeTeam: true, awayTeam: true, league: true },
        },
      },
    })

    res.json({ prediction })
  } catch (err) {
    next(err instanceof z.ZodError ? new AppError('Invalid input', 400) : err)
  }
})

router.delete('/:id', authenticate, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const existing = await prisma.userPrediction.findFirst({
      where: { id: req.params.id, userId: req.userId },
    })
    if (!existing) {
      throw new AppError('Prediction not found', 404)
    }

    await prisma.userPrediction.delete({ where: { id: req.params.id } })
    res.json({ message: 'Prediction deleted' })
  } catch (err) {
    next(err)
  }
})

export default router
