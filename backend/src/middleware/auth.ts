import { Request, Response, NextFunction } from 'express'
import jwt from 'jsonwebtoken'
import { config } from '../config'
import { AppError } from './errorHandler'

export interface AuthRequest extends Request {
  userId?: string
}

export function authenticate(req: AuthRequest, _res: Response, next: NextFunction) {
  const header = req.headers.authorization
  if (!header?.startsWith('Bearer ')) {
    throw new AppError('No token provided', 401)
  }

  const token = header.split(' ')[1]
  try {
    const decoded = jwt.verify(token, config.jwt.secret) as { userId: string }
    req.userId = decoded.userId
    next()
  } catch {
    throw new AppError('Invalid token', 401)
  }
}
