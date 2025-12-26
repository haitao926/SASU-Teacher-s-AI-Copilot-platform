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
              user: { type: 'object' }
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
    async (request) => ({
      user: request.user ?? {}
    })
  )
}
