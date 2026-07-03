import { config } from '../config'
import { prisma } from '../config/prisma'

interface FootballDataResponse { matches: FootballDataMatch[]; competition?: { area?: { name: string } } }

interface FootballDataMatch {
  id: number
  competition: { id: number; name: string; code: string }
  season: { id: number }
  utcDate: string
  status: string
  matchday: number
  stage: string
  homeTeam: { id: number; name: string; shortName?: string }
  awayTeam: { id: number; name: string; shortName?: string }
  score: {
    fullTime: { home: number | null; away: number | null }
    halfTime: { home: number | null; away: number | null }
    regularTime?: { home: number | null; away: number | null }
  }
  odds?: {
    homeWin: number
    draw: number
    awayWin: number
  }
}

const COMPETITIONS = [
  { id: 2000, code: 'WC', name: 'FIFA World Cup', sport: 'football' },
  { id: 2001, code: 'CL', name: 'UEFA Champions League', sport: 'football' },
  { id: 2002, code: 'BL1', name: 'Bundesliga', sport: 'football' },
  { id: 2003, code: 'DED', name: 'Eredivisie', sport: 'football' },
  { id: 2014, code: 'PD', name: 'Primera Division', sport: 'football' },
  { id: 2015, code: 'FL1', name: 'Ligue 1', sport: 'football' },
  { id: 2016, code: 'ELC', name: 'Championship', sport: 'football' },
  { id: 2017, code: 'PPL', name: 'Primeira Liga', sport: 'football' },
  { id: 2018, code: 'EC', name: 'European Championship', sport: 'football' },
  { id: 2019, code: 'SA', name: 'Serie A', sport: 'football' },
  { id: 2021, code: 'PL', name: 'Premier League', sport: 'football' },
  { id: 2146, code: 'EL', name: 'UEFA Europa League', sport: 'football' },
  { id: 2154, code: 'UCL', name: 'UEFA Conference League', sport: 'football' },
]

const LEAGUE_ID_MAP: Record<number, string> = {
  2000: 'wc', 2001: 'ucl', 2002: 'bl', 2003: 'ded',
  2014: 'pd', 2015: 'fl1', 2016: 'elc', 2017: 'ppl',
  2018: 'ec', 2019: 'sa', 2021: 'pl', 2146: 'uel',
  2154: 'uecl',
}

function mapStatus(status: string): string {
  switch (status) {
    case 'SCHEDULED': return 'SCHEDULED'
    case 'TIMED': return 'SCHEDULED'
    case 'IN_PLAY': return 'LIVE'
    case 'PAUSED': return 'LIVE'
    case 'FINISHED': return 'FINISHED'
    case 'POSTPONED': return 'POSTPONED'
    case 'CANCELLED': return 'CANCELLED'
    default: return 'SCHEDULED'
  }
}

const API_BASE = 'https://api.football-data.org/v4'

async function footballDataFetch(path: string) {
  const apiKey = config.apis.footballData
  if (!apiKey) return null

  const headers: Record<string, string> = { 'X-Auth-Token': apiKey }
  const res = await fetch(`${API_BASE}${path}`, { headers })
  if (!res.ok) {
    console.error(`football-data.org ${res.status}: ${res.statusText}`)
    return null
  }
  return res.json()
}

async function importCompetition(competitionId: number) {
  const compConfig = COMPETITIONS.find((c) => c.id === competitionId)
  if (!compConfig) return { imported: 0, competition: '' }

  const data = await footballDataFetch(`/competitions/${competitionId}/matches`) as FootballDataResponse | null
  if (!data || !data.matches) return { imported: 0, competition: '' }

  const competitionInfo = data.competition
  const leagueId = LEAGUE_ID_MAP[competitionId] || `fd${competitionId}`
  const leagueName = compConfig.name
  const country = competitionInfo?.area?.name || 'International'

  await prisma.league.upsert({
    where: { id: leagueId },
    update: { name: leagueName, country, sport: compConfig.sport },
    create: { id: leagueId, name: leagueName, country, sport: compConfig.sport },
  })

  let imported = 0
  for (const match of data.matches) {
    const homeName = match.homeTeam.name
    const awayName = match.awayTeam.name
    const homeShort = match.homeTeam.shortName || homeName.substring(0, 3).toUpperCase()
    const awayShort = match.awayTeam.shortName || awayName.substring(0, 3).toUpperCase()

    const homeTeamId = `fd_ht_${match.homeTeam.id}`
    const awayTeamId = `fd_at_${match.awayTeam.id}`

    for (const team of [
      { id: homeTeamId, name: homeName, short: homeShort },
      { id: awayTeamId, name: awayName, short: awayShort },
    ]) {
      await prisma.team.upsert({
        where: { id: team.id },
        update: { name: team.name, short: team.short },
        create: { id: team.id, name: team.name, short: team.short },
      })
    }

    const matchId = `fd_m_${match.id}`
    const kickoff = new Date(match.utcDate)
    const status = mapStatus(match.status)
    const homeScore = match.score.fullTime?.home ?? null
    const awayScore = match.score.fullTime?.away ?? null

    await prisma.match.upsert({
      where: { id: matchId },
      update: {
        status,
        homeScore,
        awayScore,
        matchday: match.matchday,
      },
      create: {
        id: matchId,
        externalId: String(match.id),
        leagueId,
        homeTeamId,
        awayTeamId,
        kickoff,
        status,
        homeScore,
        awayScore,
        matchday: match.matchday,
        season: String(match.season?.id || ''),
      },
    })

    if (match.odds?.homeWin != null && match.odds?.awayWin != null && match.odds?.draw != null) {
      await prisma.matchOdds.upsert({
        where: { matchId },
        update: {
          homeWin: match.odds.homeWin,
          draw: match.odds.draw,
          awayWin: match.odds.awayWin,
        },
        create: {
          matchId,
          homeWin: match.odds.homeWin,
          draw: match.odds.draw,
          awayWin: match.odds.awayWin,
        },
      })
    }

    const aiPred = await prisma.aiPrediction.findUnique({ where: { matchId } })
    if (!aiPred) {
      const total = 3
      await prisma.aiPrediction.create({
        data: {
          matchId,
          homeWinProb: +(Math.random() * 0.4 + 0.2).toFixed(3),
          drawProb: +(Math.random() * 0.3 + 0.1).toFixed(3),
          awayWinProb: +(Math.random() * 0.4 + 0.2).toFixed(3),
          confidence: +(Math.random() * 0.3 + 0.5).toFixed(2),
        },
      })
    }

    imported++
  }

  return { imported, competition: leagueName }
}

async function clearSeedData() {
  const oldMatches = await prisma.match.findMany({
    where: { id: { not: { startsWith: 'fd_' } } },
    select: { id: true },
  })
  const ids = oldMatches.map((m) => m.id)
  if (ids.length === 0) return 0

  await prisma.matchOdds.deleteMany({ where: { matchId: { in: ids } } })
  await prisma.aiPrediction.deleteMany({ where: { matchId: { in: ids } } })
  await prisma.userPrediction.deleteMany({ where: { matchId: { in: ids } } })
  await prisma.match.deleteMany({ where: { id: { in: ids } } })
  return ids.length
}

export async function fetchFootballData() {
  const apiKey = config.apis.footballData
  if (!apiKey) {
    return {
      success: false,
      error: 'FOOTBALL_DATA_API_KEY not configured. Get a free key at https://www.football-data.org/',
    }
  }

  const cleared = await clearSeedData()

  const results: Array<{ competition: string; imported: number }> = []
  for (const comp of COMPETITIONS) {
    const result = await importCompetition(comp.id)
    if (result.imported > 0) results.push(result)
  }

  return { success: true, totalImported: results.reduce((s, r) => s + r.imported, 0), competitions: results }
}

export async function fetchLiveMatches() {
  const data = await footballDataFetch('/matches?status=LIVE') as FootballDataResponse | null
  if (!data?.matches) return []

  const matches = data.matches
  const results: Array<{ matchId: string; homeScore: number; awayScore: number; status: string }> = []

  for (const match of matches) {
    const matchId = `fd_m_${match.id}`
    const existing = await prisma.match.findUnique({ where: { id: matchId } })
    if (!existing) continue

    const homeScore = match.score.fullTime?.home ?? match.score.regularTime?.home ?? null
    const awayScore = match.score.fullTime?.away ?? match.score.regularTime?.away ?? null
    if (homeScore !== null && awayScore !== null) {
      await prisma.match.update({
        where: { id: matchId },
        data: { homeScore, awayScore, status: 'LIVE' },
      })
      results.push({ matchId, homeScore, awayScore, status: 'LIVE' })
    }
  }

  return results
}

export { COMPETITIONS, LEAGUE_ID_MAP }