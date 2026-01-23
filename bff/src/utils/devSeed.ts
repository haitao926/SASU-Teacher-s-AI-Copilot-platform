import prisma from './prisma'
import { hashPassword } from './password'

export async function ensureDevUsers() {
  const tenantId = 'default'

  const ensureUser = async (input: {
    username: string
    name: string
    role: string
    password: string
  }) => {
    const existing = await prisma.user.findUnique({
      where: { tenantId_username: { tenantId, username: input.username } }
    })

    if (!existing) {
      await prisma.user.create({
        data: {
          tenantId,
          username: input.username,
          password: hashPassword(input.password),
          name: input.name,
          role: input.role,
          status: 'ACTIVE'
        }
      })
      return { created: true, username: input.username }
    }

    const updates: any = {}

    // Keep dev accounts always usable after accidental lockouts
    if ((existing.loginFailures ?? 0) !== 0 || existing.lockedUntil) {
      updates.loginFailures = 0
      updates.lockedUntil = null
    }

    // Ensure baseline dev credentials are consistent
    if (existing.status !== 'ACTIVE') updates.status = 'ACTIVE'
    if (existing.role !== input.role) updates.role = input.role
    if (existing.name !== input.name) updates.name = input.name

    if (!existing.password.startsWith('scrypt:')) {
      updates.password = hashPassword(input.password)
    }

    if (Object.keys(updates).length > 0) {
      await prisma.user.update({
        where: { id: existing.id },
        data: updates
      })
    }

    return { created: false, username: input.username }
  }

  const results = await Promise.all([
    ensureUser({ username: 'admin', name: '系统管理员', role: 'ADMIN', password: 'admin123' }),
    ensureUser({ username: 'teacher1', name: '张老师', role: 'TEACHER', password: 'password123' }),
    ensureUser({ username: 'teacher2', name: '李老师', role: 'TEACHER', password: 'password123' }),
    ensureUser({ username: 'teacher3', name: '王老师', role: 'TEACHER', password: 'password123' })
  ])

  const created = results.filter((r) => r.created).map((r) => r.username)
  return { created }
}
