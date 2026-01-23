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
    tenantId?: string
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

        const u = request.user as any
        const headerTenant = (request.headers as any)?.['x-tenant-id']
        const headerTenantId = typeof headerTenant === 'string' ? headerTenant.trim() : ''
        const tokenTenantId = typeof u?.tenantId === 'string' ? u.tenantId.trim() : ''

        if (tokenTenantId) {
          if (headerTenantId && headerTenantId !== tokenTenantId) {
            reply.code(400).send({
              code: 'TENANT_MISMATCH',
              message: 'x-tenant-id does not match token tenantId'
            })
            return
          }
          request.tenantId = tokenTenantId
        } else {
          // Backward compatible: older tokens may not include tenantId
          request.tenantId = headerTenantId || 'default'
          if (u && typeof u === 'object') {
            u.tenantId = request.tenantId
          }
        }
      } catch (err) {
        request.log.warn({ err }, 'jwt verification failed')
        reply.code(401).send({ code: 'UNAUTHORIZED', message: 'Invalid or missing token' })
      }
    }
  )
})
