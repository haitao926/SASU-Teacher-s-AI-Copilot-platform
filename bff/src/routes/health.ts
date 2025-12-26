import type { FastifyInstance } from 'fastify'

export default async function registerHealthRoutes(app: FastifyInstance) {
  app.get(
    '/health',
    {
      schema: {
        tags: ['system'],
        summary: 'Health check',
        response: {
          200: {
            type: 'object',
            properties: {
              status: { type: 'string' },
              uptime: { type: 'number' }
            }
          }
        }
      }
    },
    async () => ({
      status: 'ok',
      uptime: process.uptime()
    })
  )
}
