import { config } from '../config'
import { prisma } from '../config/prisma'

const ESPN_BASE = 'https://site.api.espn.com/apis/site/v2/sports/basketball'
const SPORTSRC_BASE = 'https://api.sportsrc.org'
const SPORTSCORE_BASE = 'https://sportscore.com'

interface ESPNCompetition {
  id: string; uid: string; date: string; attendance: number
  type: { id: string; text: string; abbreviation: string }
  timeValid: boolean; neutralSite: boolean; conferenceCompetition: boolean
  playByPlayAvailable: boolean; recent: boolean
  venue: { id: string; fullName: string; address: { city: string; state: string }; capacity: number; indoor: boolean }
  competitors: Array<{
    id: string; uid: string; type: string; order: number; homeAway: string
    team: { id: string; uid: string; location: string; name: string; abbreviation: string; displayName: string; shortDisplayName: string; color: string; alternateColor: string; logo: string }
    score: { value: number; displayValue: string }
    records: Array<{ type: string; summary: string }>
  }>
  status: { clock: number; displayClock: string; period: number; type: { id: string; name: string; state: string; completed: boolean; description: string; detail: string; shortDetail: string } }
  broadcasts: Array<{ market: string; names: Array<string> }>
  format: { regulation: { periods: number } }
  startDate: string
  geoBroadcasts: Array<{ marketplace: string; country: string; media: { shortName: string } }>
  odds?: Array<{ provider: { id: string; name: string; priority: number }; details: string; overUnder: string; spread: number; currentSpread: number; awayTeamOdds: { favorite: boolean; underdog: boolean; moneyLine: number; spreadOdds: number }; homeTeamOdds: { favorite: boolean; underdog: boolean; moneyLine: number; spreadOdds: number }; open: { spread: number; overUnder: number } }>
}

interface ESPNResponse {
  events: Array<{
    id: string; uid: string; date: string; name: string; shortName: string
    season: { year: number; type: number; slug: string }
    competitions: ESPNCompetition[]
    status: { type: { id: string; name: string; state: string; completed: boolean; description: string; detail: string; shortDetail: string } }
  }>
  leagues: Array<{ id: string; name: string; abbreviation: string; slug: string }>
}

const ESPN_LEAGUES = [
  { slug: 'nba', id: 'nba', name: 'NBA', country: 'USA' },
  { slug: 'wnba', id: 'wnba', name: 'WNBA', country: 'USA' },
  { slug: 'mens-college-basketball', id: 'ncaa', name: 'NCAA Men', country: 'USA' },
  { slug: 'womens-college-basketball', id: 'ncaa-w', name: 'NCAA Women', country: 'USA' },
  { slug: 'nbl', id: 'nbl', name: 'NBL Australia', country: 'Australia' },
  { slug: 'fiba', id: 'fiba', name: 'FIBA', country: 'International' },
]

async function fetchESPN(slug: string, leagueId: string, leagueName: string, country: string) {
  const url = `${ESPN_BASE}/${slug}/scoreboard`
  const res = await fetch(url)
  if (!res.ok) return { imported: 0 }

  const data = await res.json() as ESPNResponse
  if (!data.events?.length) return { imported: 0 }

  await prisma.league.upsert({
    where: { id: leagueId },
    update: { name: leagueName, country, sport: 'basketball' },
    create: { id: leagueId, name: leagueName, country, sport: 'basketball' },
  })

  let imported = 0
  for (const event of data.events) {
    const comp = event.competitions?.[0]
    if (!comp) continue

    const h = comp.competitors.find((c) => c.homeAway === 'home')
    const a = comp.competitors.find((c) => c.homeAway === 'away')
    if (!h || !a) continue

    const homeTeamId = `espn_bb_ht_${h.team.id}`
    const awayTeamId = `espn_bb_at_${a.team.id}`

    for (const t of [
      { id: homeTeamId, name: h.team.displayName || h.team.name, short: h.team.abbreviation },
      { id: awayTeamId, name: a.team.displayName || a.team.name, short: a.team.abbreviation },
    ]) {
      await prisma.team.upsert({
        where: { id: t.id },
        update: { name: t.name, short: t.short },
        create: { id: t.id, name: t.name, short: t.short },
      })
    }

    const matchId = `espn_bb_${event.id}`
    const kickoff = new Date(comp.date || event.date)
    const st = comp.status?.type?.state || ''
    const status = st === 'pre' ? 'SCHEDULED' : st === 'in' ? 'LIVE' : st === 'post' || comp.status?.type?.completed ? 'FINISHED' : 'SCHEDULED'
    const homeScore = h.score?.value ?? null
    const awayScore = a.score?.value ?? null

    await prisma.match.upsert({
      where: { id: matchId },
      update: { status, homeScore, awayScore },
      create: {
        id: matchId, externalId: event.id, leagueId,
        homeTeamId, awayTeamId, kickoff, status,
        homeScore, awayScore, matchday: 0,
        season: String(event.season?.year || new Date().getFullYear()),
      },
    })

    const existing = await prisma.aiPrediction.findUnique({ where: { matchId } })
    if (!existing) {
      await prisma.aiPrediction.create({
        data: {
          matchId,
          homeWinProb: +(Math.random() * 0.4 + 0.2).toFixed(3),
          drawProb: 0,
          awayWinProb: +(Math.random() * 0.4 + 0.2).toFixed(3),
          confidence: +(Math.random() * 0.3 + 0.5).toFixed(2),
        },
      })
    }

    imported++
  }

  return { imported, league: leagueName }
}

async function fetchSportSRC() {
  const res = await fetch(`${SPORTSRC_BASE}/?data=matches&category=basketball`)
  if (!res.ok) return 0

  const json = await res.json() as { data: any[] }
  const matches = json.data || []
  if (!matches.length) return 0

  await prisma.league.upsert({
    where: { id: 'wnba' },
    update: { name: 'WNBA', country: 'USA', sport: 'basketball' },
    create: { id: 'wnba', name: 'WNBA', country: 'USA', sport: 'basketball' },
  })

  let imported = 0
  for (const m of matches) {
    const homeName = m.teams?.home?.name || 'Home'
    const awayName = m.teams?.away?.name || 'Away'
    const homeTeamId = `sportsrc_bb_ht_${homeName.replace(/\s+/g, '_').toLowerCase()}`
    const awayTeamId = `sportsrc_bb_at_${awayName.replace(/\s+/g, '_').toLowerCase()}`

    for (const t of [
      { id: homeTeamId, name: homeName, short: homeName.substring(0, 3).toUpperCase() },
      { id: awayTeamId, name: awayName, short: awayName.substring(0, 3).toUpperCase() },
    ]) {
      await prisma.team.upsert({
        where: { id: t.id },
        update: { name: t.name, short: t.short },
        create: { id: t.id, name: t.name, short: t.short },
      })
    }

    const matchId = `sportsrc_bb_${m.id}`
    const kickoff = new Date(m.date || Date.now())

    await prisma.match.upsert({
      where: { id: matchId },
      update: { status: 'SCHEDULED' },
      create: {
        id: matchId, externalId: m.id, leagueId: 'wnba',
        homeTeamId, awayTeamId, kickoff, status: 'SCHEDULED',
        matchday: 0, season: String(kickoff.getFullYear()),
      },
    })

    const existing = await prisma.aiPrediction.findUnique({ where: { matchId } })
    if (!existing) {
      await prisma.aiPrediction.create({
        data: {
          matchId,
          homeWinProb: +(Math.random() * 0.4 + 0.2).toFixed(3),
          drawProb: 0,
          awayWinProb: +(Math.random() * 0.4 + 0.2).toFixed(3),
          confidence: +(Math.random() * 0.3 + 0.5).toFixed(2),
        },
      })
    }

    imported++
  }

  return imported
}

interface SportScoreMatch {
  home: string; away: string; home_logo?: string; away_logo?: string
  home_score: number | null; away_score: number | null
  status: string; status_text: string
  time: string; competition: string; competition_logo?: string; url?: string; slug?: string
}

async function fetchSportScore() {
  const url = `${SPORTSCORE_BASE}/api/widget/matches/?sport=basketball&limit=50`
  const res = await fetch(url)
  if (!res.ok) return 0

  const data = await res.json() as { matches: SportScoreMatch[] }
  const matches: SportScoreMatch[] = data.matches || []
  if (!matches.length) return 0

  const seenCompetitions = new Set<string>()
  let imported = 0
  const season = String(new Date().getFullYear())

  for (const m of matches) {
    const compKey = m.competition?.trim() || 'Unknown'
    const leagueId = `sportscore_bb_${compKey.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/_+$/, '')}`

    if (!seenCompetitions.has(compKey)) {
      seenCompetitions.add(compKey)
      await prisma.league.upsert({
        where: { id: leagueId },
        update: { name: compKey, country: 'International', sport: 'basketball' },
        create: { id: leagueId, name: compKey, country: 'International', sport: 'basketball' },
      })
    }

    const homeName = m.home || 'Home'
    const awayName = m.away || 'Away'
    const homeTeamId = `sportscore_ht_${homeName.toLowerCase().replace(/[^a-z0-9]+/g, '_')}`
    const awayTeamId = `sportscore_at_${awayName.toLowerCase().replace(/[^a-z0-9]+/g, '_')}`

    for (const t of [
      { id: homeTeamId, name: homeName, short: homeName.substring(0, 3).toUpperCase() },
      { id: awayTeamId, name: awayName, short: awayName.substring(0, 3).toUpperCase() },
    ]) {
      await prisma.team.upsert({
        where: { id: t.id },
        update: { name: t.name },
        create: { id: t.id, name: t.name, short: t.short },
      })
    }

    const matchSlug = m.slug || `${homeName.toLowerCase().replace(/[^a-z0-9]+/g, '-')}-vs-${awayName.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`
    const matchId = `sportscore_m_${matchSlug}`
    const kickoff = new Date(m.time || Date.now())
    const status = m.status === 'live' || m.status_text?.toLowerCase().includes('live') ? 'LIVE'
      : m.status === 'finished' || m.status_text?.toLowerCase().includes('finish') ? 'FINISHED'
      : 'SCHEDULED'
    const homeScore = m.home_score ?? null
    const awayScore = m.away_score ?? null

    await prisma.match.upsert({
      where: { id: matchId },
      update: { status, homeScore, awayScore },
      create: {
        id: matchId, externalId: matchSlug, leagueId,
        homeTeamId, awayTeamId, kickoff, status,
        homeScore, awayScore, matchday: 0, season,
      },
    })

    const existing = await prisma.aiPrediction.findUnique({ where: { matchId } })
    if (!existing) {
      await prisma.aiPrediction.create({
        data: {
          matchId,
          homeWinProb: +(Math.random() * 0.4 + 0.2).toFixed(3),
          drawProb: 0,
          awayWinProb: +(Math.random() * 0.4 + 0.2).toFixed(3),
          confidence: +(Math.random() * 0.3 + 0.5).toFixed(2),
        },
      })
    }

    imported++
  }

  return imported
}

async function fetchApiSports() {
  const apiKey = config.apis.apiSports
  if (!apiKey) return { success: false, totalImported: 0 }

  const COMPETITIONS = [
    { id: 'euroleague', name: 'EuroLeague', apiId: 14 },
    { id: 'eurocup', name: 'EuroCup', apiId: 15 },
    { id: 'acb', name: 'Liga ACB (Spain)', apiId: 1 },
    { id: 'lnb', name: 'LNB (France)', apiId: 2 },
    { id: 'legabasket', name: 'Lega Basket (Italy)', apiId: 3 },
    { id: 'bsl', name: 'BSL (Turkey)', apiId: 5 },
    { id: 'greek-basket', name: 'Greek Basket League', apiId: 6 },
    { id: 'vtb', name: 'VTB United League', apiId: 7 },
    { id: 'aba', name: 'ABA League (Adriatic)', apiId: 8 },
    { id: 'nbb', name: 'NBB (Brazil)', apiId: 10 },
    { id: 'cba-china', name: 'CBA (China)', apiId: 11 },
    { id: 'kbl', name: 'KBL (Korea)', apiId: 13 },
    { id: 'b-league', name: 'B.League (Japan)', apiId: 16 },
    { id: 'pba', name: 'PBA (Philippines)', apiId: 17 },
    { id: 'lnb-argentina', name: 'LNB (Argentina)', apiId: 18 },
    { id: 'liga-chile', name: 'Liga Chile', apiId: 19 },
    { id: 'basket-mexico', name: 'LNBP (Mexico)', apiId: 20 },
    { id: 'nbl-canada', name: 'NBL Canada', apiId: 21 },
    { id: 'bnxt', name: 'BNXT League (Benelux)', apiId: 22 },
    { id: 'bundesliga', name: 'BBL (Germany)', apiId: 23 },
    { id: 'euroleague-w', name: 'EuroLeague Women', apiId: 24 },
    { id: 'ligas', name: 'Liga Sudamericana', apiId: 25 },
    { id: 'bal', name: 'Basketball Africa League', apiId: 26 },
    { id: 'liga-americas', name: 'Liga de las Americas', apiId: 27 },
    { id: 'sbl', name: 'SBL (Singapore/ASEAN)', apiId: 28 },
    { id: 'nbl-australia', name: 'NBL Australia', apiId: 9 },
  ]

  const results: Array<{ leagueId: string; imported: number }> = []

  for (const comp of COMPETITIONS) {
    try {
      const season = '2025-2026'
      const url = `https://v1.basketball.api-sports.io/games?league=${comp.apiId}&season=${season}`
      const res = await fetch(url, {
        headers: { 'x-rapidapi-key': apiKey, 'x-rapidapi-host': 'v1.basketball.api-sports.io' },
      })
      if (!res.ok) continue

      const json = await res.json() as { response: any[] }
      const games = json.response || []
      if (!games.length) continue

      await prisma.league.upsert({
        where: { id: comp.id },
        update: { name: comp.name, country: 'International', sport: 'basketball' },
        create: { id: comp.id, name: comp.name, country: 'International', sport: 'basketball' },
      })

      let imported = 0
      for (const game of games) {
        const homeName = game.teams?.home?.name || 'Home'
        const awayName = game.teams?.away?.name || 'Away'
        const homeTeamId = `apisports_ht_${game.teams?.home?.id || imported}`
        const awayTeamId = `apisports_at_${game.teams?.away?.id || imported}`

        for (const t of [
          { id: homeTeamId, name: homeName, short: homeName.substring(0, 3).toUpperCase() },
          { id: awayTeamId, name: awayName, short: awayName.substring(0, 3).toUpperCase() },
        ]) {
          await prisma.team.upsert({
            where: { id: t.id },
            update: { name: t.name },
            create: { id: t.id, name: t.name, short: t.short },
          })
        }

        const matchId = `apisports_bb_${game.id}`
        const kickoff = new Date((game.timestamp || Date.now() / 1000) * 1000)
        const status = game.status?.short === 'LIVE' ? 'LIVE'
          : ['FT', 'END', 'AOT', 'FINAL'].includes(game.status?.short) ? 'FINISHED'
          : 'SCHEDULED'
        const homeScore = game.scores?.home?.total ?? null
        const awayScore = game.scores?.away?.total ?? null

        await prisma.match.upsert({
          where: { id: matchId },
          update: { status, homeScore, awayScore },
          create: {
            id: matchId, externalId: String(game.id), leagueId: comp.id,
            homeTeamId, awayTeamId, kickoff, status, homeScore, awayScore,
            matchday: 0, season,
          },
        })

        const existing = await prisma.aiPrediction.findUnique({ where: { matchId } })
        if (!existing) {
          await prisma.aiPrediction.create({
            data: {
              matchId,
              homeWinProb: +(Math.random() * 0.4 + 0.2).toFixed(3),
              drawProb: 0,
              awayWinProb: +(Math.random() * 0.4 + 0.2).toFixed(3),
              confidence: +(Math.random() * 0.3 + 0.5).toFixed(2),
            },
          })
        }

        imported++
      }

      results.push({ leagueId: comp.id, imported })
    } catch (err) {
      console.error(`API-Sports ${comp.name} error:`, err)
    }
  }

  return { success: true, totalImported: results.reduce((s, r) => s + r.imported, 0), competitions: results }
}

export async function fetchBasketballData() {
  const sources: string[] = []
  let totalImported = 0

  for (const lg of ESPN_LEAGUES) {
    const result = await fetchESPN(lg.slug, lg.id, lg.name, lg.country)
    totalImported += result.imported
    if (result.imported > 0) sources.push(`ESPN ${lg.name}`)
  }

  const sportSrc = await fetchSportSRC()
  totalImported += sportSrc
  if (sportSrc > 0) sources.push('SportSRC')

  const sportScore = await fetchSportScore()
  totalImported += sportScore
  if (sportScore > 0) sources.push('SportScore')

  if (config.apis.apiSports) {
    const apiSports = await fetchApiSports()
    totalImported += apiSports.totalImported
    if (apiSports.totalImported > 0) sources.push('API-Sports')
  }

  return {
    success: totalImported > 0,
    totalImported,
    sources: sources.length > 0 ? sources : undefined,
    error: totalImported === 0
      ? 'No basketball data available. SportScore covers CBA, KBL, B.League, PBA, NBB Brazil & more for free.'
      : undefined,
  }
}