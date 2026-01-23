import type { FastifyInstance } from 'fastify'
import prisma from '../utils/prisma'
import { hashPassword, verifyPassword } from '../utils/password'
import { getPermissionsFromUserRecord, parseUserMetadata, requirePermission, sanitizePermissions } from '../utils/permissions'
import { applyTeachingUpdates, getTeachingProfileFromUserRecord, normalizeStringArray } from '../utils/userMetadata'

interface UserBody {
  username?: string
  name?: string
  password?: string
  role?: 'ADMIN' | 'TEACHER' | 'VIEWER'
  status?: 'ACTIVE' | 'DISABLED' | 'PENDING'
  permissions?: string[]
  subjects?: string[]
  classes?: string[]
}

export default async function registerUserRoutes(app: FastifyInstance) {
  const adminOnly = requirePermission('users.manage')
  const getTenant = (request: any) => (request.tenantId as string) || 'default'

  // List users (pagination + filters)
  app.get(
    '/users',
    {
      preHandler: [app.authenticate, adminOnly],
      schema: {
        tags: ['users'],
        summary: 'List users with pagination',
        querystring: {
          type: 'object',
          properties: {
            page: { type: 'string' },
            pageSize: { type: 'string' },
            keyword: { type: 'string' },
            role: { type: 'string' },
            status: { type: 'string' }
          }
        }
    }
  },
    async (request) => {
      const tenantId = getTenant(request)
      const { page = '1', pageSize = '20', keyword = '', role, status } = request.query as any
      const pageNum = Math.max(parseInt(page, 10) || 1, 1)
      const sizeNum = Math.min(Math.max(parseInt(pageSize, 10) || 20, 1), 100)
      const where: any = { tenantId }
      if (keyword) {
        where.OR = [
          { username: { contains: keyword } },
          { name: { contains: keyword } }
        ]
      }
      if (role) where.role = role
      if (status) {
        if (status === 'LOCKED') {
          where.lockedUntil = { gt: new Date() }
        } else {
          where.status = status
        }
      }

      const [total, items] = await prisma.$transaction([
        prisma.user.count({ where }),
        prisma.user.findMany({
          where,
          orderBy: { createdAt: 'desc' },
          skip: (pageNum - 1) * sizeNum,
          take: sizeNum,
          select: {
            id: true,
            username: true,
            name: true,
            role: true,
            status: true,
            createdAt: true,
            lastLoginAt: true,
            loginFailures: true,
            lockedUntil: true,
            metadata: true
          }
        })
      ])

      const normalized = items.map((u) => {
        const teaching = getTeachingProfileFromUserRecord(u)
        return {
          id: u.id,
          username: u.username,
          name: u.name,
          role: u.role,
          status: u.status,
          createdAt: u.createdAt,
          lastLoginAt: u.lastLoginAt,
          loginFailures: u.loginFailures,
          lockedUntil: u.lockedUntil,
          subjects: teaching.subjects,
          classes: teaching.classes,
          permissions: getPermissionsFromUserRecord(u)
        }
      })

      return { items: normalized, total, page: pageNum, pageSize: sizeNum }
    }
  )

  // Create user
  app.post<{ Body: UserBody }>(
    '/users',
    {
      preHandler: [app.authenticate, adminOnly],
      schema: {
        tags: ['users'],
        summary: 'Create user',
        body: {
          type: 'object',
          required: ['username', 'password', 'name'],
          properties: {
            username: { type: 'string' },
            password: { type: 'string' },
            name: { type: 'string' },
            role: { type: 'string', enum: ['ADMIN', 'TEACHER', 'VIEWER'], default: 'TEACHER' },
            status: { type: 'string', enum: ['ACTIVE', 'DISABLED', 'PENDING'], default: 'ACTIVE' },
            subjects: { type: 'array', items: { type: 'string' } },
            classes: { type: 'array', items: { type: 'string' } }
          }
        }
    }
  },
    async (request, reply) => {
      const tenantId = getTenant(request)
      const { username, password, name, role = 'TEACHER', status = 'ACTIVE', permissions, subjects, classes } = request.body

      if (!username || !password || !name) {
        return reply.code(400).send({ message: 'Missing required fields' })
      }
      if (!['ADMIN', 'TEACHER', 'VIEWER'].includes(role)) {
        return reply.code(400).send({ message: 'Invalid role' })
      }
      if (!['ACTIVE', 'DISABLED', 'PENDING'].includes(status)) {
        return reply.code(400).send({ message: 'Invalid status' })
      }

      const normalizedPermissions = sanitizePermissions(permissions)
      const meta: Record<string, unknown> = {}
      if (normalizedPermissions.length > 0) {
        meta.permissions = normalizedPermissions
      }

      if (subjects !== undefined || classes !== undefined) {
        const teachingUpdates: Record<string, unknown> = {}
        if (subjects !== undefined) teachingUpdates.subjects = subjects
        if (classes !== undefined) teachingUpdates.classes = classes
        applyTeachingUpdates(meta, teachingUpdates)
      }

      const metadata = Object.keys(meta).length > 0 ? JSON.stringify(meta) : null

      try {
        const user = await prisma.user.create({
          data: {
            tenantId,
            username,
            password: hashPassword(password),
            name,
            role,
            status,
            metadata
          },
          select: {
            id: true,
            username: true,
            name: true,
            role: true,
            status: true,
            createdAt: true
          }
        })
        const teaching = getTeachingProfileFromUserRecord({ metadata })
        return { ...user, subjects: teaching.subjects, classes: teaching.classes, permissions: getPermissionsFromUserRecord({ role: user.role, metadata }) }
      } catch (e: any) {
        if (e.code === 'P2002') {
          return reply.code(409).send({ message: 'Username already exists' })
        }
        throw e
      }
    }
  )

  // Update user
  app.put<{ Params: { id: string }; Body: UserBody }>(
    '/users/:id',
    {
      preHandler: [app.authenticate, adminOnly],
      schema: {
        tags: ['users'],
        summary: 'Update user',
        params: {
          type: 'object',
          properties: { id: { type: 'string' } }
        },
        body: {
          type: 'object',
          properties: {
            username: { type: 'string' },
            name: { type: 'string' },
            password: { type: 'string' },
            role: { type: 'string', enum: ['ADMIN', 'TEACHER', 'VIEWER'] },
            status: { type: 'string', enum: ['ACTIVE', 'DISABLED', 'PENDING'] },
            subjects: { type: 'array', items: { type: 'string' } },
            classes: { type: 'array', items: { type: 'string' } }
          }
        }
      }
    },
    async (request, reply) => {
      const { id } = request.params
      const { name, password, role, status, permissions, subjects, classes } = request.body

      if (request.user && (request.user as any).sub === id && status === 'DISABLED') {
        return reply.code(400).send({ message: 'Cannot disable yourself' })
      }

      const data: any = {}
      if (name) data.name = name
      if (role) data.role = role
      if (status) data.status = status
      if (password) data.password = hashPassword(password)

      if (permissions !== undefined || subjects !== undefined || classes !== undefined) {
        const existing = await prisma.user.findUnique({
          where: { id },
          select: { metadata: true, role: true }
        })
        if (!existing) return reply.code(404).send({ message: 'User not found' })

        const meta = parseUserMetadata(existing.metadata)
        if (permissions !== undefined) {
          const normalizedPermissions = sanitizePermissions(permissions)
          if (normalizedPermissions.length > 0) {
            meta.permissions = normalizedPermissions
          } else {
            delete meta.permissions
          }
        }
        if (subjects !== undefined || classes !== undefined) {
          const teachingUpdates: Record<string, unknown> = {}
          if (subjects !== undefined) teachingUpdates.subjects = subjects
          if (classes !== undefined) teachingUpdates.classes = classes
          applyTeachingUpdates(meta, teachingUpdates)
        }
        data.metadata = Object.keys(meta).length > 0 ? JSON.stringify(meta) : null
      }

      const user = await prisma.user.update({
        where: { id },
        data,
        select: {
          id: true,
          username: true,
          name: true,
          role: true,
          status: true,
          createdAt: true,
          metadata: true
        }
      })
      const teaching = getTeachingProfileFromUserRecord(user)
      return {
        id: user.id,
        username: user.username,
        name: user.name,
        role: user.role,
        status: user.status,
        createdAt: user.createdAt,
        subjects: teaching.subjects,
        classes: teaching.classes,
        permissions: getPermissionsFromUserRecord(user)
      }
    }
  )

  // Reset password (admin)
  app.post<{ Params: { id: string }; Body: { newPassword?: string } }>(
    '/users/:id/reset-password',
    {
      preHandler: [app.authenticate, adminOnly],
      schema: {
        tags: ['users'],
        summary: 'Reset user password',
        params: { type: 'object', properties: { id: { type: 'string' } } },
        body: {
          type: 'object',
          properties: { newPassword: { type: 'string' } }
        }
      }
    },
    async (request, reply) => {
      const { id } = request.params
      const newPassword = request.body?.newPassword || Math.random().toString(36).slice(2, 10)

      await prisma.user.update({
        where: { id },
        data: { password: hashPassword(newPassword), loginFailures: 0, lockedUntil: null }
      })

      return { success: true, tempPassword: newPassword }
    }
  )

  // Unlock account (admin)
  app.post<{ Params: { id: string } }>(
    '/users/:id/unlock',
    {
      preHandler: [app.authenticate, adminOnly],
      schema: {
        tags: ['users'],
        summary: 'Unlock user account (clear lockout)',
        params: { type: 'object', properties: { id: { type: 'string' } } }
      }
    },
    async (request) => {
      const { id } = request.params
      await prisma.user.update({
        where: { id },
        data: { loginFailures: 0, lockedUntil: null }
      })
      return { success: true }
    }
  )

  // Export users CSV (admin)
  app.get(
    '/users/export',
    {
      preHandler: [app.authenticate, adminOnly],
      schema: {
        tags: ['users'],
        summary: 'Export users as CSV'
      }
  },
    async (_request, reply) => {
      const tenantId = getTenant(_request)
      const users = await prisma.user.findMany({
        where: { tenantId },
        orderBy: [{ role: 'asc' }, { username: 'asc' }]
      })
      const header = 'username,name,role,status,subjects,classes\n'
      const body = users.map((u) => {
        const teaching = getTeachingProfileFromUserRecord(u)
        const subjects = teaching.subjects.join('|')
        const classes = teaching.classes.join('|')
        return `${u.username},${u.name},${u.role},${u.status},${subjects},${classes}`
      }).join('\n')
      reply.header('Content-Type', 'text/csv; charset=utf-8')
      reply.send(header + body)
    }
  )

  // Import teachers in bulk (admin)
  app.post<{ Body: { users: UserBody[] } }>(
    '/users/import',
    {
      preHandler: [app.authenticate, adminOnly],
      schema: {
        tags: ['users'],
        summary: 'Import users (bulk upsert)',
        body: {
          type: 'object',
          required: ['users'],
          properties: {
            users: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  username: { type: 'string' },
                  name: { type: 'string' },
                  password: { type: 'string' },
                  role: { type: 'string' },
                  status: { type: 'string' },
                  subjects: { type: 'array', items: { type: 'string' } },
                  classes: { type: 'array', items: { type: 'string' } }
                }
              }
            }
          }
        }
      }
  },
    async (request, reply) => {
      const tenantId = getTenant(request)
      const list = request.body?.users
      if (!Array.isArray(list) || list.length === 0) {
        return reply.code(400).send({ message: 'users is required' })
      }

      let created = 0
      let updated = 0
      const tempPasswords: { username: string; password: string }[] = []

      for (const item of list) {
        if (!item.username || !item.name) continue
        const role = item.role && ['ADMIN', 'TEACHER', 'VIEWER'].includes(item.role) ? item.role : 'TEACHER'
        const status = item.status && ['ACTIVE', 'DISABLED', 'PENDING'].includes(item.status) ? item.status : 'ACTIVE'
        const password = item.password || Math.random().toString(36).slice(2, 10)
        const hasSubjects = item.subjects !== undefined
        const hasClasses = item.classes !== undefined
        const subjects = hasSubjects ? normalizeStringArray(item.subjects) : undefined
        const classes = hasClasses ? normalizeStringArray(item.classes) : undefined

        const existing = await prisma.user.findUnique({
          where: { tenantId_username: { tenantId, username: item.username } }
        })

        if (!existing) {
          const meta: Record<string, unknown> = {}
          if (hasSubjects || hasClasses) {
            const teachingUpdates: Record<string, unknown> = {}
            if (hasSubjects) teachingUpdates.subjects = subjects
            if (hasClasses) teachingUpdates.classes = classes
            applyTeachingUpdates(meta, teachingUpdates)
          }
          await prisma.user.create({
            data: {
              tenantId,
              username: item.username,
              name: item.name,
              password: hashPassword(password),
              role,
              status,
              metadata: Object.keys(meta).length > 0 ? JSON.stringify(meta) : null
            }
          })
          created++
          if (!item.password) tempPasswords.push({ username: item.username, password })
        } else {
          const data: any = {
            name: item.name,
            role,
            status,
            password: item.password ? hashPassword(item.password) : existing.password
          }

          if (hasSubjects || hasClasses) {
            const meta = parseUserMetadata(existing.metadata)
            const teachingUpdates: Record<string, unknown> = {}
            if (hasSubjects) teachingUpdates.subjects = subjects
            if (hasClasses) teachingUpdates.classes = classes
            applyTeachingUpdates(meta, teachingUpdates)
            data.metadata = Object.keys(meta).length > 0 ? JSON.stringify(meta) : null
          }
          await prisma.user.update({
            where: { id: existing.id },
            data
          })
          updated++
        }
      }

      return { success: true, created, updated, tempPasswords }
    }
  )

  // Soft delete => disable
  app.delete<{ Params: { id: string } }>(
    '/users/:id',
    {
      preHandler: [app.authenticate, adminOnly],
      schema: {
        tags: ['users'],
        summary: 'Disable user',
        params: { type: 'object', properties: { id: { type: 'string' } } }
      }
    },
    async (request, reply) => {
      const { id } = request.params
      if (request.user && (request.user as any).sub === id) {
        return reply.code(400).send({ message: 'Cannot disable yourself' })
      }
      await prisma.user.update({
        where: { id },
        data: { status: 'DISABLED' }
      })
      return { success: true }
    }
  )

  // Self update profile
  app.put<{ Body: { name?: string } }>('/me',
    {
      preHandler: [app.authenticate],
      schema: {
        tags: ['users'],
        summary: 'Update current user profile',
        body: { type: 'object', properties: { name: { type: 'string' } } }
      }
    },
    async (request) => {
      const u = request.user as any
      const data: any = {}
      if (request.body?.name) data.name = request.body.name
      const user = await prisma.user.update({
        where: { id: u.sub },
        data,
        select: { id: true, username: true, name: true, role: true, status: true }
      })
      return user
    }
  )

  // Self change password
  app.put<{ Body: { oldPassword: string; newPassword: string } }>('/me/password',
    {
      preHandler: [app.authenticate],
      schema: {
        tags: ['users'],
        summary: 'Change password for current user',
        body: {
          type: 'object',
          required: ['oldPassword', 'newPassword'],
          properties: {
            oldPassword: { type: 'string' },
            newPassword: { type: 'string' }
          }
        }
      }
    },
    async (request, reply) => {
      const u = request.user as any
      const user = await prisma.user.findUnique({ where: { id: u.sub } })
      if (!user) return reply.code(404).send({ message: 'User not found' })
      if (!request.body?.oldPassword || !request.body?.newPassword) {
        return reply.code(400).send({ message: 'Missing password' })
      }
      if (!verifyPassword(request.body.oldPassword, user.password)) {
        return reply.code(401).send({ message: 'Old password incorrect' })
      }

      await prisma.user.update({
        where: { id: u.sub },
        data: { password: hashPassword(request.body.newPassword), loginFailures: 0, lockedUntil: null }
      })

      return { success: true }
    })
}
