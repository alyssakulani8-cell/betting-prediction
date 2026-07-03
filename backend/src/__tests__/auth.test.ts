import { describe, it, expect, jest, beforeEach } from '@jest/globals'

jest.mock('../config/prisma', () => ({
  prisma: {
    user: {
      findUnique: jest.fn(),
      create: jest.fn(),
    },
  },
}))

jest.mock('bcryptjs', () => ({
  hash: jest.fn(() => Promise.resolve('hashed-pass')),
  compare: jest.fn(() => Promise.resolve(true)),
}))

jest.mock('jsonwebtoken', () => ({
  sign: jest.fn(() => 'mock-token'),
}))

import request from 'supertest'
import express from 'express'
import authRoutes from '../routes/auth'
import { errorHandler } from '../middleware/errorHandler'

const app = express()
app.use(express.json())
app.use('/auth', authRoutes)
app.use(errorHandler)

describe('Auth Routes', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('POST /auth/register - creates a new user', async () => {
    const { prisma } = require('../config/prisma')
    prisma.user.findUnique.mockResolvedValue(null)
    prisma.user.create.mockResolvedValue({
      id: 'user-1',
      name: 'Test',
      email: 'test@example.com',
      password: 'hashed-pass',
    })

    const res = await request(app)
      .post('/auth/register')
      .send({ name: 'Test', email: 'test@example.com', password: 'password123' })

    expect(res.status).toBe(201)
    expect(res.body.user.email).toBe('test@example.com')
    expect(res.body.token).toBe('mock-token')
  })

  it('POST /auth/register - rejects duplicate email', async () => {
    const { prisma } = require('../config/prisma')
    prisma.user.findUnique.mockResolvedValue({ id: 'existing', email: 'test@example.com' })

    const res = await request(app)
      .post('/auth/register')
      .send({ name: 'Test', email: 'test@example.com', password: 'password123' })

    expect(res.status).toBe(409)
  })

  it('POST /auth/login - authenticates user', async () => {
    const { prisma } = require('../config/prisma')
    prisma.user.findUnique.mockResolvedValue({
      id: 'user-1',
      name: 'Test',
      email: 'test@example.com',
      password: 'hashed-pass',
    })

    const res = await request(app)
      .post('/auth/login')
      .send({ email: 'test@example.com', password: 'password123' })

    expect(res.status).toBe(200)
    expect(res.body.token).toBe('mock-token')
  })

  it('POST /auth/login - rejects invalid credentials', async () => {
    const { prisma } = require('../config/prisma')
    prisma.user.findUnique.mockResolvedValue(null)

    const res = await request(app)
      .post('/auth/login')
      .send({ email: 'wrong@example.com', password: 'wrongpass' })

    expect(res.status).toBe(401)
  })

  it('POST /auth/register - validates input', async () => {
    const res = await request(app)
      .post('/auth/register')
      .send({ name: 'A', email: 'bad', password: '12' })

    expect(res.status).toBe(400)
  })
})
