import { Router, Request, Response, NextFunction } from 'express'
import { authenticate } from '../middleware/auth'
import { prisma } from '../config/prisma'

const router = Router()

router.get('/', authenticate, async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const leagues = await prisma.league.findMany({ orderBy: { name: 'asc' } })
    res.json({ leagues })
  } catch (err) {
    next(err)
  }
})

export default router
