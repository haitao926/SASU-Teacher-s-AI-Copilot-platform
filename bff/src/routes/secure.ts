import type { FastifyInstance } from 'fastify'
import prisma from '../utils/prisma'
import { getPermissionsFromUserRecord } from '../utils/permissions'
import { getTeachingProfileFromUserRecord } from '../utils/userMetadata'

export default async function registerSecureRoutes(app: FastifyInstance) {
  app.get(
    '/whoami',
    {
      preHandler: app.authenticate,
      schema: {
        tags: ['auth'],
        summary: 'Inspect current user (requires token)',
        response: {
          200: {
            type: 'object',
            properties: {
              user: {
                type: 'object',
                properties: {
                  id: { type: 'string' },
                  name: { type: 'string' },
                  username: { type: 'string' },
                  role: { type: 'string' },
                  status: { type: 'string' },
                  roles: { type: 'array', items: { type: 'string' } },
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
              code: { type: 'string' },
              message: { type: 'string' }
            }
          }
        }
      }
    },
    async (request) => {
      const u = request.user as Record<string, any> | undefined
      const sub = typeof u?.sub === 'string' ? u.sub : ''

      if (sub) {
        const record = await prisma.user.findUnique({
          where: { id: sub },
          select: { id: true, username: true, name: true, role: true, status: true, metadata: true }
        })

        if (record) {
          const permissions = getPermissionsFromUserRecord(record)
          const teaching = getTeachingProfileFromUserRecord(record)
          return {
            user: {
              id: record.id,
              name: record.name,
              username: record.username,
              role: record.role,
              roles: [record.role],
              permissions,
              status: record.status,
              subjects: teaching.subjects,
              classes: teaching.classes
            }
          }
        }
      }

      return {
        user: {
          id: u?.sub ?? '',
          name: u?.name ?? '教师',
          username: u?.username ?? '',
          role: u?.role ?? (Array.isArray(u?.roles) ? u?.roles[0] : undefined) ?? 'TEACHER',
          status: u?.status ?? 'ACTIVE',
          roles: Array.isArray(u?.roles) ? u?.roles : [],
          permissions: Array.isArray(u?.permissions) ? u?.permissions : [],
          subjects: [],
          classes: []
        }
      }
    }
  )
}
