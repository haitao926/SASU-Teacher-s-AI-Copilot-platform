import dotenv from 'dotenv'
import prisma from './utils/prisma'

dotenv.config()

async function reset() {
  const password = 'password123'
  // Upsert admin
  await prisma.user.upsert({
    where: { username: 'admin' },
    update: { password },
    create: {
      username: 'admin',
      password,
      name: 'System Admin',
      role: 'ADMIN'
    }
  })
  console.log('Admin password reset to:', password)
}

reset()
  .catch(console.error)
  .finally(() => prisma.$disconnect())
