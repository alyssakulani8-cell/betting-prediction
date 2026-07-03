import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

const LEAGUES = [
  { id: 'pl', name: 'Premier League', country: 'England', sport: 'football' },
  { id: 'pd', name: 'La Liga', country: 'Spain', sport: 'football' },
  { id: 'sa', name: 'Serie A', country: 'Italy', sport: 'football' },
  { id: 'bl', name: 'Bundesliga', country: 'Germany', sport: 'football' },
  { id: 'fl', name: 'Ligue 1', country: 'France', sport: 'football' },
  { id: 'ucl', name: 'Champions League', country: 'Europe', sport: 'football' },
  { id: 'uel', name: 'Europa League', country: 'Europe', sport: 'football' },
  { id: 'wcq', name: 'World Cup Qualifiers', country: 'International', sport: 'football' },
  { id: 'ecq', name: 'Euro Qualifiers', country: 'International', sport: 'football' },
  { id: 'copa', name: 'Copa America', country: 'International', sport: 'football' },
  { id: 'nba', name: 'NBA', country: 'USA', sport: 'basketball' },
  { id: 'ncaa', name: 'NCAA Basketball', country: 'USA', sport: 'basketball' },
  { id: 'euro', name: 'EuroLeague', country: 'Europe', sport: 'basketball' },
]

const TEAMS = [
  { id: 'mci', name: 'Manchester City', short: 'MCI' },
  { id: 'ars', name: 'Arsenal', short: 'ARS' },
  { id: 'liv', name: 'Liverpool', short: 'LIV' },
  { id: 'che', name: 'Chelsea', short: 'CHE' },
  { id: 'mun', name: 'Manchester United', short: 'MUN' },
  { id: 'tot', name: 'Tottenham', short: 'TOT' },
  { id: 'new', name: 'Newcastle', short: 'NEW' },
  { id: 'avl', name: 'Aston Villa', short: 'AVL' },
  { id: 'bar', name: 'Barcelona', short: 'BAR' },
  { id: 'rma', name: 'Real Madrid', short: 'RMA' },
  { id: 'atm', name: 'Atletico Madrid', short: 'ATM' },
  { id: 'sev', name: 'Sevilla', short: 'SEV' },
  { id: 'juv', name: 'Juventus', short: 'JUV' },
  { id: 'acm', name: 'AC Milan', short: 'ACM' },
  { id: 'int', name: 'Inter Milan', short: 'INT' },
  { id: 'nap', name: 'Napoli', short: 'NAP' },
  { id: 'bay', name: 'Bayern Munich', short: 'BAY' },
  { id: 'bvb', name: 'Borussia Dortmund', short: 'BVB' },
  { id: 'rbl', name: 'RB Leipzig', short: 'RBL' },
  { id: 'psg', name: 'Paris Saint-Germain', short: 'PSG' },
  { id: 'mon', name: 'AS Monaco', short: 'MON' },
  { id: 'bra', name: 'Brazil', short: 'BRA' },
  { id: 'arg', name: 'Argentina', short: 'ARG' },
  { id: 'fra', name: 'France', short: 'FRA' },
  { id: 'eng', name: 'England', short: 'ENG' },
  { id: 'ger', name: 'Germany', short: 'GER' },
  { id: 'ita', name: 'Italy', short: 'ITA' },
  { id: 'spa', name: 'Spain', short: 'SPA' },
  { id: 'por', name: 'Portugal', short: 'POR' },
  { id: 'ned', name: 'Netherlands', short: 'NED' },
  { id: 'bel', name: 'Belgium', short: 'BEL' },
  { id: 'uru', name: 'Uruguay', short: 'URU' },
  { id: 'col', name: 'Colombia', short: 'COL' },
  { id: 'bos', name: 'Boston Celtics', short: 'BOS' },
  { id: 'lal', name: 'LA Lakers', short: 'LAL' },
  { id: 'gsw', name: 'Golden State Warriors', short: 'GSW' },
  { id: 'mil', name: 'Milwaukee Bucks', short: 'MIL' },
  { id: 'phi', name: 'Philadelphia 76ers', short: 'PHI' },
  { id: 'den', name: 'Denver Nuggets', short: 'DEN' },
  { id: 'mia', name: 'Miami Heat', short: 'MIA' },
  { id: 'brk', name: 'Brooklyn Nets', short: 'BRK' },
  { id: 'phx', name: 'Phoenix Suns', short: 'PHX' },
  { id: 'dal', name: 'Dallas Mavericks', short: 'DAL' },
]

function intBetween(min: number, max: number) { return Math.floor(Math.random() * (max - min + 1)) + min }
function oddsBetween(min: number, max: number) { return +(Math.random() * (max - min) + min).toFixed(2) }

function pickPair(): [typeof TEAMS[0], typeof TEAMS[0]] {
  const idx1 = intBetween(0, TEAMS.length - 1)
  let idx2 = intBetween(0, TEAMS.length - 1)
  while (idx2 === idx1) idx2 = intBetween(0, TEAMS.length - 1)
  return [TEAMS[idx1], TEAMS[idx2]]
}

function generateOdds(homeWinProb: number) {
  const fairHome = 1 / homeWinProb
  const fairDraw = 1 / 0.26
  const fairAway = 1 / (1 - homeWinProb - 0.26)
  const margin = 1.05
  return {
    homeWin: +(fairHome * margin).toFixed(2),
    draw: +(fairDraw * margin).toFixed(2),
    awayWin: +(fairAway * margin).toFixed(2),
    overUnder: +(Math.random() * 1.5 + 2).toFixed(1),
    overPrice: +(Math.random() * 0.5 + 1.8).toFixed(2),
    underPrice: +(Math.random() * 0.5 + 1.8).toFixed(2),
    bttsYes: +(Math.random() * 0.5 + 1.6).toFixed(2),
    bttsNo: +(Math.random() * 0.5 + 1.6).toFixed(2),
  }
}

async function main() {
  for (const league of LEAGUES) {
    await prisma.league.upsert({ where: { id: league.id }, update: league, create: league })
  }

  for (const team of TEAMS) {
    await prisma.team.upsert({ where: { id: team.id }, update: team, create: team })
  }

  const now = new Date()
  const matches: Array<{
    leagueId: string
    homeTeamId: string
    awayTeamId: string
    kickoff: Date
    status: string
    homeScore?: number
    awayScore?: number
    season: string
    odds: ReturnType<typeof generateOdds>
    aiProb: { homeWinProb: number; drawProb: number; awayWinProb: number; confidence: number }
  }> = []

  const LEAGUE_MATCH_COUNTS: Record<string, number> = {
    pl: 10, pd: 10, sa: 10, bl: 10, fl: 8,
    ucl: 8, uel: 6, wcq: 6, ecq: 6, copa: 4,
    nba: 8, ncaa: 6, euro: 6,
  }

  for (const league of LEAGUES) {
    const count = LEAGUE_MATCH_COUNTS[league.id] || 6
    const isBasketball = league.sport === 'basketball'
    const basketballTeams = TEAMS.slice(-10)
    const getTeam = () => {
      if (isBasketball) return basketballTeams[intBetween(0, basketballTeams.length - 1)]
      return pickPair()[0]
    }

    for (let i = 0; i < count; i++) {
      let home = getTeam()
      let away = getTeam()
      while (away.id === home.id) { away = getTeam() }

      const daysFromNow = intBetween(0, 14)
      const kickoff = new Date(now.getTime() + daysFromNow * 86400000 + intBetween(12, 22) * 3600000 + [0, 15, 30, 45][intBetween(0, 3)] * 60000)

      let homeProb: number, drawProb: number, awayProb: number
      if (isBasketball) {
        homeProb = +(Math.random() * 0.3 + 0.5).toFixed(3)
        drawProb = 0
        awayProb = +(1 - homeProb).toFixed(3)
      } else {
        homeProb = +(Math.random() * 0.35 + 0.35).toFixed(3)
        drawProb = +(Math.random() * 0.15 + 0.15).toFixed(3)
        awayProb = +(1 - homeProb - drawProb).toFixed(3)
      }

      matches.push({
        leagueId: league.id,
        homeTeamId: home.id,
        awayTeamId: away.id,
        kickoff,
        status: 'SCHEDULED',
        season: '2025/2026',
        odds: generateOdds(homeProb),
        aiProb: {
          homeWinProb: homeProb,
          drawProb: drawProb,
          awayWinProb: awayProb,
          confidence: +(Math.random() * 0.25 + 0.6).toFixed(2),
        },
      })
    }
  }

  console.log(`Creating ${matches.length} matches with odds and AI predictions...`)

  for (const m of matches) {
    const { odds, aiProb, ...matchData } = m
    await prisma.match.create({
      data: {
        ...matchData,
        odds: { create: odds },
        aiPrediction: { create: aiProb },
      },
    })
  }

  console.log('Done!')
}

main().catch(console.error).finally(() => prisma.$disconnect())
