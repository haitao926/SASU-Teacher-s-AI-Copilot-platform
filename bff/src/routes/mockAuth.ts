import type { FastifyInstance } from 'fastify'
import config from '../config'

interface MockAuthBody {
  sub?: string
  roles?: string[]
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
            roles: { type: 'array', items: { type: 'string' } }
          },
          additionalProperties: false
        },
        response: {
          200: {
            type: 'object',
            properties: {
              token: { type: 'string' }
            }
          }
        }
      }
    },
    async (request) => {
      const { sub = 'demo-user', roles = ['teacher'] } = request.body ?? {}
      const token = app.jwt.sign(
        { sub, roles },
        { expiresIn: '1h' }
      )
      return { token }
    }
  )
}
