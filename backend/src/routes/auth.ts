import { Router, Request, Response, NextFunction } from 'express'
import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'
import { z } from 'zod'
import { config } from '../config'
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
    const hashedPassword = await bcrypt.hash(password, 12)
    const token = jwt.sign({ userId: email }, config.jwt.secret, { expiresIn: config.jwt.expiresIn })

    res.status(201).json({
      user: { id: email, name, email },
      token,
    })
  } catch (err) {
    next(err instanceof z.ZodError ? new AppError('Invalid input', 400) : err)
  }
})

router.post('/login', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { email, password } = loginSchema.parse(req.body)
    const token = jwt.sign({ userId: email }, config.jwt.secret, { expiresIn: config.jwt.expiresIn })

    res.json({
      user: { id: email, name: email.split('@')[0], email },
      token,
    })
  } catch (err) {
    next(err instanceof z.ZodError ? new AppError('Invalid input', 400) : err)
  }
})

router.get('/profile', authenticate, async (req: AuthRequest, res: Response) => {
  res.json({ id: req.userId, name: req.userId?.split('@')[0], email: req.userId })
})

export default router
