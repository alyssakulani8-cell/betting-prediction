import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

const LEAGUES = [
  { id: 'pl', name: 'Premier League', country: 'England' },
  { id: 'pd', name: 'La Liga', country: 'Spain' },
  { id: 'sa', name: 'Serie A', country: 'Italy' },
  { id: 'bl', name: 'Bundesliga', country: 'Germany' },
  { id: 'fl', name: 'Ligue 1', country: 'France' },
  { id: 'ucl', name: 'Champions League', country: 'Europe' },
]

const TEAMS = [
  { id: 'mci', name: 'Manchester City', short: 'MCI' },
  { id: 'ars', name: 'Arsenal', short: 'ARS' },
  { id: 'liv', name: 'Liverpool', short: 'LIV' },
  { id: 'che', name: 'Chelsea', short: 'CHE' },
  { id: 'mun', name: 'Manchester United', short: 'MUN' },
  { id: 'tot', name: 'Tottenham', short: 'TOT' },
  { id: 'bar', name: 'Barcelona', short: 'BAR' },
  { id: 'rma', name: 'Real Madrid', short: 'RMA' },
  { id: 'atm', name: 'Atletico Madrid', short: 'ATM' },
  { id: 'juv', name: 'Juventus', short: 'JUV' },
  { id: 'acm', name: 'AC Milan', short: 'ACM' },
  { id: 'int', name: 'Inter Milan', short: 'INT' },
  { id: 'bay', name: 'Bayern Munich', short: 'BAY' },
  { id: 'bvb', name: 'Borussia Dortmund', short: 'BVB' },
  { id: 'psg', name: 'Paris Saint-Germain', short: 'PSG' },
]

async function main() {
  for (const league of LEAGUES) {
    await prisma.league.upsert({
      where: { id: league.id },
      update: league,
      create: league,
    })
  }

  for (const team of TEAMS) {
    await prisma.team.upsert({
      where: { id: team.id },
      update: team,
      create: team,
    })
  }

  console.log('Seeded leagues and teams')
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect())
