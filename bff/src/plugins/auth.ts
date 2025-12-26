import fp from 'fastify-plugin'
import jwt from '@fastify/jwt'
import type { FastifyReply, FastifyRequest } from 'fastify'
import config from '../config'

declare module 'fastify' {
  interface FastifyInstance {
    authenticate: (request: FastifyRequest, reply: FastifyReply) => Promise<void>
  }

  interface FastifyRequest {
    user: string | object | Buffer
  }
}

export default fp(async (app) => {
  app.register(jwt, {
    secret: config.jwtSecret,
    decode: { complete: false }
  })

  app.decorate(
    'authenticate',
    async (request: FastifyRequest, reply: FastifyReply): Promise<void> => {
      try {
        await request.jwtVerify()
      } catch (err) {
        request.log.warn({ err }, 'jwt verification failed')
        reply.code(401).send({ code: 'UNAUTHORIZED', message: 'Invalid or missing token' })
      }
    }
  )
})
