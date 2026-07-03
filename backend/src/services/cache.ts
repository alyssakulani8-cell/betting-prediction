import { createClient, type RedisClientType } from 'redis'
import { config } from '../config'

let client: RedisClientType | null = null
let connected = false

async function getClient(): Promise<RedisClientType | null> {
  if (connected && client) return client
  try {
    client = createClient({
      url: config.redis.url,
      socket: { connectTimeout: 3000, reconnectStrategy: false },
    })
    client.on('error', () => { connected = false })
    await client.connect()
    connected = true
    return client
  } catch {
    return null
  }
}

const DEFAULT_TTL = 300

export async function cacheGet<T>(key: string): Promise<T | null> {
  try {
    const c = await getClient()
    if (!c) return null
    const raw = await c.get(key)
    if (!raw) return null
    return JSON.parse(raw) as T
  } catch {
    return null
  }
}

export async function cacheSet(key: string, value: unknown, ttl = DEFAULT_TTL): Promise<void> {
  try {
    const c = await getClient()
    if (!c) return
    await c.setEx(key, ttl, JSON.stringify(value))
  } catch {
  }
}

export async function cacheDel(key: string): Promise<void> {
  try {
    const c = await getClient()
    if (!c) return
    await c.del(key)
  } catch {
  }
}

export async function cacheWrap<T>(key: string, fn: () => Promise<T>, ttl = DEFAULT_TTL): Promise<T> {
  const cached = await cacheGet<T>(key)
  if (cached !== null) return cached
  const result = await fn()
  await cacheSet(key, result, ttl)
  return result
}

export function predictionsCacheKey(matchIds: string[]): string {
  return `predictions:batch:${matchIds.sort().join(',')}`
}

export function teamAnalysisCacheKey(teamId: string): string {
  return `analysis:team:${teamId}`
}

export function featureCacheKey(sport: string): string {
  return `features:${sport}`
}
