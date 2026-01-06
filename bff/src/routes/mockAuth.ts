import type { FastifyInstance } from 'fastify'
import config from '../config'

interface MockAuthBody {
  sub?: string
  roles?: string[]
  name?: string
  username?: string
  role?: string
}

export default async function registerMockAuth(app: FastifyInstance) {
  if (config.env === 'production') {
    app.log.info('mock auth route is disabled in production')
    return
  }

  app.post<{ Body: MockAuthBody }>(
    '/auth/mock',
    {
      schema: {
        tags: ['auth'],
        summary: 'Issue a short-lived JWT for local testing (disabled in production)',
        body: {
          type: 'object',
          properties: {
            sub: { type: 'string', description: 'subject / user id' },
            roles: { type: 'array', items: { type: 'string' } },
            name: { type: 'string' },
            username: { type: 'string' },
            role: { type: 'string' }
          },
          additionalProperties: false
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
                  role: { type: 'string' }
                }
              }
            }
          }
        }
      }
    },
    async (request) => {
      const {
        sub = 'teacher-001',
        roles = ['TEACHER'],
        name = '示例教师',
        username = 'teacher@example.com',
        role
      } = request.body ?? {}

      const token = app.jwt.sign(
        { sub, roles, name, username, role: role ?? roles[0] },
        { expiresIn: '1h' }
      )
      return {
        token,
        user: {
          id: sub,
          username,
          name,
          role: role ?? roles[0] ?? 'TEACHER'
        }
      }
    }
  )
}
