import dotenv from 'dotenv'
import prisma from './utils/prisma'
import { hashPassword } from './utils/password'

dotenv.config()

async function reset() {
  const password = process.env.ADMIN_PASSWORD || 'admin123'
  const tenantId = 'default'
  // Upsert admin
  await prisma.user.upsert({
    where: { tenantId_username: { tenantId, username: 'admin' } },
    update: { password: hashPassword(password), status: 'ACTIVE', loginFailures: 0, lockedUntil: null },
    create: {
      tenantId,
      username: 'admin',
      password: hashPassword(password),
      name: 'System Admin',
      role: 'ADMIN',
      status: 'ACTIVE'
    }
  })
  console.log('Admin credentials reset:')
  console.log('  username: admin')
  console.log('  password:', password)
}

reset()
  .catch(console.error)
  .finally(() => prisma.$disconnect())
