import { describe, it, expect, jest, beforeEach } from '@jest/globals'

jest.mock('../config/prisma', () => ({
  prisma: {
    league: {
      findMany: jest.fn(),
    },
  },
}))

jest.mock('../middleware/auth', () => ({
  authenticate: jest.fn((_req: any, _res: any, next: any) => next()),
}))

import request from 'supertest'
import express from 'express'
import leagueRoutes from '../routes/leagues'
import { errorHandler } from '../middleware/errorHandler'

const app = express()
app.use(express.json())
app.use('/leagues', leagueRoutes)
app.use(errorHandler)

describe('Leagues Routes', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('GET /leagues - returns league list', async () => {
    const { prisma } = require('../config/prisma')
    prisma.league.findMany.mockResolvedValue([
      { id: 'pl', name: 'Premier League', country: 'England', logo: null },
      { id: 'laliga', name: 'La Liga', country: 'Spain', logo: null },
    ])

    const res = await request(app).get('/leagues')

    expect(res.status).toBe(200)
    expect(res.body.leagues).toHaveLength(2)
    expect(res.body.leagues[0].name).toBe('Premier League')
  })

  it('GET /leagues - returns empty array', async () => {
    const { prisma } = require('../config/prisma')
    prisma.league.findMany.mockResolvedValue([])

    const res = await request(app).get('/leagues')

    expect(res.status).toBe(200)
    expect(res.body.leagues).toEqual([])
  })
})
