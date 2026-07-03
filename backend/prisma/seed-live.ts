import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  const matches = await prisma.match.findMany({ include: { league: true } })

  const now = new Date()
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const tomorrow = new Date(today.getTime() + 86400000)
  const yesterday = new Date(today.getTime() - 86400000)

  // Mark first 6 matches as LIVE with scores
  const liveMatches = matches.slice(0, 6)
  for (let i = 0; i < liveMatches.length; i++) {
    const m = liveMatches[i]
    const homeScore = Math.floor(Math.random() * 4)
    const awayScore = Math.floor(Math.random() * 3)
    await prisma.match.update({
      where: { id: m.id },
      data: {
        status: 'LIVE',
        homeScore,
        awayScore,
        kickoff: new Date(now.getTime() - Math.random() * 5400000), // kicked off 0-90 min ago
      },
    })
  }

  // Set next 30 matches to today
  const todayMatches = matches.slice(6, 36)
  for (const m of todayMatches) {
    const hour = 10 + Math.floor(Math.random() * 10)
    await prisma.match.update({
      where: { id: m.id },
      data: {
        status: 'SCHEDULED',
        kickoff: new Date(today.getTime() + hour * 3600000 + Math.random() * 3600000),
      },
    })
  }

  // Set next 30 to tomorrow
  const tomorrowMatches = matches.slice(36, 66)
  for (const m of tomorrowMatches) {
    const hour = 10 + Math.floor(Math.random() * 10)
    await prisma.match.update({
      where: { id: m.id },
      data: {
        status: 'SCHEDULED',
        kickoff: new Date(tomorrow.getTime() + hour * 3600000 + Math.random() * 3600000),
      },
    })
  }

  const count = await prisma.match.count()
  const liveCount = await prisma.match.count({ where: { status: 'LIVE' } })
  const todayCount = await prisma.match.count({
    where: { kickoff: { gte: today, lt: tomorrow } },
  })
  console.log(`Updated ${count} matches: ${liveCount} LIVE, ${todayCount} today`)
}

main().catch(console.error).finally(() => prisma.$disconnect())
