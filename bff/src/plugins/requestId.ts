import fp from 'fastify-plugin'
import { randomUUID } from 'crypto'
import type { FastifyRequest } from 'fastify'

export default fp(async (app) => {
  app.addHook('onRequest', async (request, reply) => {
    const headerId = request.headers['x-request-id']
    const requestId =
      typeof headerId === 'string' && headerId.trim().length > 0
        ? headerId
        : randomUUID()

    // Fastify 自带 request.id，但这里确保一致性并回传
    ;(request as FastifyRequest & { requestId?: string }).requestId = requestId
    reply.header('x-request-id', requestId)
  })
})
