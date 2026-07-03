import { Router, Response, NextFunction } from 'express'
import { z } from 'zod'
import { authenticate, AuthRequest } from '../middleware/auth'
import { prisma } from '../config/prisma'
import { AppError } from '../middleware/errorHandler'

const router = Router()

const updatePreferencesSchema = z.object({
  notificationLevel: z.enum(['all', 'important', 'none']).optional(),
  defaultLeague: z.string().optional().nullable(),
  theme: z.enum(['dark', 'light']).optional(),
  favoriteLeagues: z.array(z.string()).optional(),
  favoriteTeams: z.array(z.string()).optional(),
  preferredBetTypes: z.array(z.enum(['moneyline', 'spread', 'over_under'])).optional(),
  riskTolerance: z.enum(['low', 'medium', 'high']).optional(),
  maxStake: z.number().min(0).optional().nullable(),
  monthlyBudget: z.number().min(0).optional().nullable(),
  maxDailyBets: z.number().int().min(1).optional().nullable(),
})

router.get('/preferences', authenticate, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.userId },
      include: { preferences: true, gamblingLimit: true },
    })
    if (!user) throw new AppError('User not found', 404)

    res.json({
      id: user.id,
      name: user.name,
      email: user.email,
      preferences: user.preferences ? {
        ...user.preferences,
        favoriteLeagues: safeJsonParse(user.preferences.favoriteLeagues),
        favoriteTeams: safeJsonParse(user.preferences.favoriteTeams),
        preferredBetTypes: safeJsonParse(user.preferences.preferredBetTypes),
      } : null,
      gamblingLimit: user.gamblingLimit,
    })
  } catch (err) {
    next(err)
  }
})

router.put('/preferences', authenticate, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const data = updatePreferencesSchema.parse(req.body)
    const prefData: Record<string, unknown> = {}

    if (data.notificationLevel !== undefined) prefData.notificationLevel = data.notificationLevel
    if (data.defaultLeague !== undefined) prefData.defaultLeague = data.defaultLeague || null
    if (data.theme !== undefined) prefData.theme = data.theme
    if (data.favoriteLeagues !== undefined) prefData.favoriteLeagues = JSON.stringify(data.favoriteLeagues)
    if (data.favoriteTeams !== undefined) prefData.favoriteTeams = JSON.stringify(data.favoriteTeams)
    if (data.preferredBetTypes !== undefined) prefData.preferredBetTypes = JSON.stringify(data.preferredBetTypes)
    if (data.riskTolerance !== undefined) prefData.riskTolerance = data.riskTolerance
    if (data.maxStake !== undefined) prefData.maxStake = data.maxStake
    if (data.monthlyBudget !== undefined) prefData.monthlyBudget = data.monthlyBudget
    if (data.maxDailyBets !== undefined) prefData.maxDailyBets = data.maxDailyBets

    const existing = await prisma.userPreference.findUnique({ where: { userId: req.userId } })
    if (existing) {
      await prisma.userPreference.update({ where: { userId: req.userId }, data: prefData as any })
    } else {
      await prisma.userPreference.create({ data: { userId: req.userId!, ...prefData } as any })
    }

    const updated = await prisma.userPreference.findUnique({ where: { userId: req.userId } })
    res.json({
      preferences: updated ? {
        ...updated,
        favoriteLeagues: safeJsonParse(updated.favoriteLeagues),
        favoriteTeams: safeJsonParse(updated.favoriteTeams),
        preferredBetTypes: safeJsonParse(updated.preferredBetTypes),
      } : null,
    })
  } catch (err) {
    next(err instanceof z.ZodError ? new AppError('Invalid input', 400) : err)
  }
})

const updateLimitsSchema = z.object({
  dailyLossLimit: z.number().min(0).optional().nullable(),
  weeklyLossLimit: z.number().min(0).optional().nullable(),
  monthlyDepositLimit: z.number().min(0).optional().nullable(),
  maxStakePerBet: z.number().min(0).optional().nullable(),
})

router.put('/limits', authenticate, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const data = updateLimitsSchema.parse(req.body)
    const limitData: Record<string, unknown> = {}

    if (data.dailyLossLimit !== undefined) limitData.dailyLossLimit = data.dailyLossLimit
    if (data.weeklyLossLimit !== undefined) limitData.weeklyLossLimit = data.weeklyLossLimit
    if (data.monthlyDepositLimit !== undefined) limitData.monthlyDepositLimit = data.monthlyDepositLimit
    if (data.maxStakePerBet !== undefined) limitData.maxStakePerBet = data.maxStakePerBet

    const existing = await prisma.gamblingLimit.findUnique({ where: { userId: req.userId } })
    if (existing) {
      await prisma.gamblingLimit.update({ where: { userId: req.userId }, data: limitData as any })
    } else {
      await prisma.gamblingLimit.create({ data: { userId: req.userId!, ...limitData } as any })
    }

    const updated = await prisma.gamblingLimit.findUnique({ where: { userId: req.userId } })
    res.json({ gamblingLimit: updated })
  } catch (err) {
    next(err instanceof z.ZodError ? new AppError('Invalid input', 400) : err)
  }
})

router.post('/cool-off', authenticate, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const schema = z.object({
      hours: z.number().int().min(1).max(720),
    })
    const { hours } = schema.parse(req.body)
    const coolOffUntil = new Date(Date.now() + hours * 60 * 60 * 1000)

    await prisma.gamblingLimit.upsert({
      where: { userId: req.userId },
      update: { coolOffUntil },
      create: { userId: req.userId!, coolOffUntil },
    })

    res.json({
      message: `Cool-off activated until ${coolOffUntil.toISOString()}`,
      coolOffUntil: coolOffUntil.toISOString(),
    })
  } catch (err) {
    next(err instanceof z.ZodError ? new AppError('Invalid input', 400) : err)
  }
})

router.delete('/cool-off', authenticate, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    await prisma.gamblingLimit.update({
      where: { userId: req.userId },
      data: { coolOffUntil: null },
    })
    res.json({ message: 'Cool-off period ended' })
  } catch (err) {
    next(err)
  }
})

router.get('/limits/status', authenticate, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const limits = await prisma.gamblingLimit.findUnique({ where: { userId: req.userId } })
    if (!limits) {
      res.json({ isLimited: false, limits: null })
      return
    }

    const today = new Date()
    const todayStart = new Date(today.getFullYear(), today.getMonth(), today.getDate())
    const weekStart = new Date(todayStart.getTime() - todayStart.getDay() * 86400000)
    const monthStart = new Date(today.getFullYear(), today.getMonth(), 1)

    const [dailyLoss, weeklyLoss, monthlyDeposit, activeSession] = await Promise.all([
      getLossSince(predictionQuery(req.userId, todayStart)),
      getLossSince(predictionQuery(req.userId, weekStart)),
      getStakeSince(predictionQuery(req.userId, monthStart)),
      prisma.bettingSession.findFirst({
        where: { userId: req.userId, status: 'active' },
        orderBy: { startTime: 'desc' },
      }),
    ])

    const isCooledOff = limits.coolOffUntil && new Date(limits.coolOffUntil) > today
    const exceededDailyLoss = limits.dailyLossLimit != null && dailyLoss <= -(limits.dailyLossLimit)
    const exceededWeeklyLoss = limits.weeklyLossLimit != null && weeklyLoss <= -(limits.weeklyLossLimit)
    const exceededMonthlyDeposit = limits.monthlyDepositLimit != null && monthlyDeposit >= limits.monthlyDepositLimit

    res.json({
      isLimited: !!(isCooledOff || exceededDailyLoss || exceededWeeklyLoss || exceededMonthlyDeposit),
      limits,
      currentUsage: {
        dailyLoss: +dailyLoss.toFixed(2),
        weeklyLoss: +weeklyLoss.toFixed(2),
        monthlyDeposited: +monthlyDeposit.toFixed(2),
      },
      alerts: [
        isCooledOff && { type: 'cool_off', message: `Cool-off active until ${limits.coolOffUntil?.toISOString().split('T')[0]}` },
        exceededDailyLoss && { type: 'daily_loss_limit', message: 'Daily loss limit reached' },
        exceededWeeklyLoss && { type: 'weekly_loss_limit', message: 'Weekly loss limit reached' },
        exceededMonthlyDeposit && { type: 'monthly_deposit_limit', message: 'Monthly deposit limit reached' },
      ].filter(Boolean),
      activeSession,
    })
  } catch (err) {
    next(err)
  }
})

router.post('/session/start', authenticate, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const active = await prisma.bettingSession.findFirst({
      where: { userId: req.userId, status: 'active' },
    })
    if (active) {
      res.json({ session: active, message: 'Continuing existing session' })
      return
    }

    const session = await prisma.bettingSession.create({
      data: { userId: req.userId!, startTime: new Date() },
    })
    res.status(201).json({ session })
  } catch (err) {
    next(err)
  }
})

router.post('/session/end', authenticate, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const active = await prisma.bettingSession.findFirst({
      where: { userId: req.userId, status: 'active' },
      orderBy: { startTime: 'desc' },
    })
    if (!active) {
      res.json({ message: 'No active session' })
      return
    }

    const sessionPredictions = await prisma.userPrediction.findMany({
      where: {
        userId: req.userId,
        createdAt: { gte: active.startTime },
      },
    })

    const totalStake = sessionPredictions.reduce((sum, p) => sum + (p.stake || 0), 0)
    const netProfit = sessionPredictions.reduce((sum, p) => sum + (p.profit || 0), 0)
    const betsPlaced = sessionPredictions.length

    const ended = await prisma.bettingSession.update({
      where: { id: active.id },
      data: {
        endTime: new Date(),
        status: 'ended',
        totalStake,
        netProfit,
        betsPlaced,
      },
    })

    res.json({ session: ended })
  } catch (err) {
    next(err)
  }
})

router.get('/sessions', authenticate, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const sessions = await prisma.bettingSession.findMany({
      where: { userId: req.userId },
      orderBy: { startTime: 'desc' },
      take: 50,
    })
    res.json({ sessions })
  } catch (err) {
    next(err)
  }
})

function safeJsonParse(val: string | null | undefined): unknown {
  if (!val) return null
  try { return JSON.parse(val) } catch { return null }
}

function predictionQuery(userId: string | undefined, since: Date) {
  return {
    userId: userId || '',
    createdAt: { gte: since },
    isResolved: true,
  }
}

async function getLossSince(where: Record<string, unknown>): Promise<number> {
  const preds = await prisma.userPrediction.findMany({ where: where as any })
  return preds.reduce((sum, p) => sum + (p.profit || 0), 0)
}

async function getStakeSince(where: Record<string, unknown>): Promise<number> {
  const preds = await prisma.userPrediction.findMany({ where: where as any })
  return preds.reduce((sum, p) => sum + (p.stake || 0), 0)
}

export default router
