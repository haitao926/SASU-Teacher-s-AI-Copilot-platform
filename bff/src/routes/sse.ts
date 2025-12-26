import type { FastifyInstance } from 'fastify'

export default async function registerSseRoutes(app: FastifyInstance) {
  app.get(
    '/stream/demo',
    {
      preHandler: app.authenticate,
      schema: {
        tags: ['stream'],
        summary: 'SSE demo stream (requires token)',
        response: {
          200: {
            description: 'text/event-stream',
            type: 'string'
          }
        }
      }
    },
    async (request, reply) => {
      // Set SSE headers
      reply.raw.writeHead(200, {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        Connection: 'keep-alive'
      })

      const sendEvent = (event: string, data: unknown) => {
        reply.raw.write(`event: ${event}\n`)
        reply.raw.write(`data: ${JSON.stringify(data)}\n\n`)
      }

      sendEvent('message', { step: 'connected', ts: Date.now() })

      let counter = 0
      const interval = setInterval(() => {
        counter += 1
        sendEvent('message', { step: 'tick', counter, ts: Date.now() })
        if (counter >= 3) {
          sendEvent('end', { status: 'done', ts: Date.now() })
          clearInterval(interval)
          reply.raw.end()
        }
      }, 1000)

      // Clean up on client disconnect
      request.raw.on('close', () => {
        clearInterval(interval)
        reply.raw.end()
      })

      return reply
    }
  )
}
