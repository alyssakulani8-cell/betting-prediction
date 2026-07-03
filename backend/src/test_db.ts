import { PrismaClient } from '@prisma/client'
const prisma = new PrismaClient()

async function main() {
  const count = await prisma.user.count()
  console.log('Total users:', count)
  const user = await prisma.user.findUnique({ where: { email: 'test@example.com' } })
  console.log('Found user:', user)
}

main().catch((e) => console.error('Error:', e)).finally(() => prisma.$disconnect())
