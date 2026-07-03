import { describe, it, expect } from '@jest/globals'
import { AppError, errorHandler } from '../middleware/errorHandler'
import { Request, Response, NextFunction } from 'express'

describe('AppError', () => {
  it('creates error with status code', () => {
    const err = new AppError('Not found', 404)
    expect(err.message).toBe('Not found')
    expect(err.statusCode).toBe(404)
  })
})

describe('errorHandler', () => {
  it('returns AppError status and message', () => {
    const err = new AppError('Bad request', 400)
    const res = { status: jest.fn().mockReturnThis(), json: jest.fn() } as unknown as Response
    errorHandler(err, {} as Request, res, {} as NextFunction)
    expect(res.status).toHaveBeenCalledWith(400)
    expect(res.json).toHaveBeenCalledWith({ error: 'Bad request' })
  })

  it('returns 500 for unknown errors', () => {
    const err = new Error('Something broke')
    const res = { status: jest.fn().mockReturnThis(), json: jest.fn() } as unknown as Response
    errorHandler(err, {} as Request, res, {} as NextFunction)
    expect(res.status).toHaveBeenCalledWith(500)
    expect(res.json).toHaveBeenCalledWith({ error: 'Internal server error' })
  })
})
