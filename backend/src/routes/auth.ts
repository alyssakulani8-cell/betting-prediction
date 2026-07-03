import { Router, Request, Response, NextFunction } from 'express'
import bcrypt from 'bcryptjs'
import jwt, { type SignOptions } from 'jsonwebtoken'
import { z } from 'zod'
import { config } from '../config'
import { prisma } from '../config/prisma'
import { AppError } from '../middleware/errorHandler'
import { authenticate, AuthRequest } from '../middleware/auth'

const router = Router()

const registerSchema = z.object({
  name: z.string().min(2).max(50),
  email: z.string().email(),
  password: z.string().min(6).max(100),
})

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string(),
})

router.post('/register', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { name, email, password } = registerSchema.parse(req.body)

    const existing = await prisma.user.findUnique({ where: { email } })
    if (existing) {
      throw new AppError('Email already registered', 409)
    }

    const hashedPassword = await bcrypt.hash(password, 12)
    const user = await prisma.user.create({
      data: { name, email, password: hashedPassword },
    })

    const token = jwt.sign({ userId: user.id }, config.jwt.secret, { expiresIn: config.jwt.expiresIn } as SignOptions)

    res.status(201).json({
      user: { id: user.id, name: user.name, email: user.email },
      token,
    })
  } catch (err) {
    next(err instanceof z.ZodError ? new AppError('Invalid input', 400) : err)
  }
})

router.post('/login', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { email, password } = loginSchema.parse(req.body)

    const user = await prisma.user.findUnique({ where: { email } })
    if (!user) {
      throw new AppError('Invalid credentials', 401)
    }

    const valid = await bcrypt.compare(password, user.password)
    if (!valid) {
      throw new AppError('Invalid credentials', 401)
    }

    const token = jwt.sign({ userId: user.id }, config.jwt.secret, { expiresIn: config.jwt.expiresIn } as SignOptions)

    res.json({
      user: { id: user.id, name: user.name, email: user.email },
      token,
    })
  } catch (err) {
    next(err instanceof z.ZodError ? new AppError('Invalid input', 400) : err)
  }
})

router.get('/profile', authenticate, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.userId },
      include: { preferences: true },
    })
    if (!user) {
      throw new AppError('User not found', 404)
    }
    res.json({ id: user.id, name: user.name, email: user.email, preferences: user.preferences })
  } catch (err) {
    next(err)
  }
})

const updateProfileSchema = z.object({
  name: z.string().min(2).max(50).optional(),
  notificationLevel: z.enum(['all', 'important', 'none']).optional(),
  defaultLeague: z.string().optional(),
  theme: z.enum(['dark', 'light']).optional(),
})

router.put('/profile', authenticate, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const data = updateProfileSchema.parse(req.body)

    const updateData: Record<string, unknown> = {}
    if (data.name) updateData.name = data.name

    if (data.notificationLevel !== undefined || data.defaultLeague !== undefined || data.theme !== undefined) {
      const existing = await prisma.userPreference.findUnique({ where: { userId: req.userId } })
      const prefData: Record<string, unknown> = {}
      if (data.notificationLevel !== undefined) prefData.notificationLevel = data.notificationLevel
      if (data.defaultLeague !== undefined) prefData.defaultLeague = data.defaultLeague || null
      if (data.theme !== undefined) prefData.theme = data.theme

      if (existing) {
        await prisma.userPreference.update({ where: { userId: req.userId }, data: prefData as any })
      } else {
        await prisma.userPreference.create({
          data: { userId: req.userId!, ...prefData } as any,
        })
      }
    }

    if (data.name) {
      await prisma.user.update({ where: { id: req.userId }, data: updateData as any })
    }

    const user = await prisma.user.findUnique({
      where: { id: req.userId },
      include: { preferences: true },
    })

    res.json({ id: user!.id, name: user!.name, email: user!.email, preferences: user!.preferences })
  } catch (err) {
    next(err instanceof z.ZodError ? new AppError('Invalid input', 400) : err)
  }
})

export default router
