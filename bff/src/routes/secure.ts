import type { FastifyInstance } from 'fastify'

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
                  roles: { type: 'array', items: { type: 'string' } }
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
      return {
        user: {
          id: u?.sub ?? '',
          name: u?.name ?? '教师',
          username: u?.username ?? '',
          role: u?.role ?? (Array.isArray(u?.roles) ? u?.roles[0] : undefined) ?? 'TEACHER',
          roles: Array.isArray(u?.roles) ? u?.roles : []
        }
      }
    }
  )
}
