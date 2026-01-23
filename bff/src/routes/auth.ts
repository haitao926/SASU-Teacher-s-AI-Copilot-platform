import type { FastifyInstance } from 'fastify'
import prisma from '../utils/prisma'
import { verifyPassword, hashPassword } from '../utils/password'
import { getTenantId } from '../utils/tenant'
import { getPermissionsFromUserRecord } from '../utils/permissions'
import { getTeachingProfileFromUserRecord } from '../utils/userMetadata'

export default async function registerAuthRoutes(app: FastifyInstance) {
  // Self registration (teacher, pending approval)
  app.post<{ Body: { username: string; password: string; name: string } }>(
    '/auth/register',
    {
      schema: {
        tags: ['auth'],
        summary: 'Self register as teacher (status=PENDING)',
        body: {
          type: 'object',
          required: ['username', 'password', 'name'],
          properties: {
            username: { type: 'string' },
            password: { type: 'string' },
            name: { type: 'string' }
          }
        }
      }
    },
    async (request, reply) => {
      const tenantId = getTenantId(request.headers as any)
      const { username, password, name } = request.body
      try {
        const user = await prisma.user.create({
          data: {
            tenantId,
            username,
            password: hashPassword(password),
            name,
            role: 'TEACHER',
            status: 'PENDING'
          },
          select: {
            id: true,
            username: true,
            name: true,
            role: true,
            status: true
          }
        })
        return user
      } catch (e: any) {
        if (e.code === 'P2002') {
          return reply.code(409).send({ message: 'Username already exists' })
        }
        throw e
      }
    }
  )

  app.post<{ Body: { username: string; password: string } }>(
    '/auth/login',
    {
      schema: {
        tags: ['auth'],
        summary: 'Login to get access token',
        body: {
          type: 'object',
          required: ['username', 'password'],
          properties: {
            username: { type: 'string' },
            password: { type: 'string' }
          }
        },
        response: {
          200: {
            type: 'object',
            properties: {
              token: { type: 'string' },
              user: {
                type: 'object',
                properties: {
                  id: { type: 'string' },
                  username: { type: 'string' },
                  name: { type: 'string' },
                  role: { type: 'string' },
                  status: { type: 'string' },
                  permissions: { type: 'array', items: { type: 'string' } },
                  subjects: { type: 'array', items: { type: 'string' } },
                  classes: { type: 'array', items: { type: 'string' } }
                }
              }
            }
          },
          401: {
            type: 'object',
            properties: {
              message: { type: 'string' }
            }
          },
          403: {
            type: 'object',
            properties: {
              message: { type: 'string' }
            }
          },
          423: {
            type: 'object',
            properties: {
              message: { type: 'string' }
            }
          }
        }
      }
    },
    async (request, reply) => {
      const tenantId = getTenantId(request.headers as any)
      const { username, password } = request.body

      const user = await prisma.user.findUnique({
        where: { tenantId_username: { tenantId, username } }
      })

      if (!user) {
        return reply.code(401).send({ message: 'Invalid credentials' })
      }

      if (user.status === 'DISABLED') {
        return reply.code(403).send({ message: 'User disabled' })
      }

      if (user.lockedUntil && user.lockedUntil.getTime() > Date.now()) {
        return reply.code(423).send({ message: 'Account locked, please try later' })
      }

      const ok = verifyPassword(password, user.password)
      if (!ok) {
        const failures = (user.loginFailures ?? 0) + 1
        const lockedUntil = failures >= 5 ? new Date(Date.now() + 15 * 60 * 1000) : null
        await prisma.user.update({
          where: { id: user.id },
          data: { loginFailures: failures, lockedUntil }
        })
        return reply.code(401).send({ message: 'Invalid credentials' })
      }

      await prisma.user.update({
        where: { id: user.id },
        data: { loginFailures: 0, lockedUntil: null, lastLoginAt: new Date() }
      })

      const permissions = getPermissionsFromUserRecord(user)
      const teaching = getTeachingProfileFromUserRecord(user)
      const token = app.jwt.sign(
        { sub: user.id, username: user.username, role: user.role, tenantId: user.tenantId, permissions },
        { expiresIn: '7d' }
      )

      return {
        token,
        user: {
          id: user.id,
          username: user.username,
          name: user.name,
          role: user.role,
          status: user.status,
          permissions,
          subjects: teaching.subjects,
          classes: teaching.classes
        }
      }
    }
  )
}
