import fastify from 'fastify'
import cors from '@fastify/cors'
import swagger from '@fastify/swagger'
import swaggerUI from '@fastify/swagger-ui'
import config from './config'
import authPlugin from './plugins/auth'
import rateLimitPlugin from './plugins/rateLimit'
import requestIdPlugin from './plugins/requestId'
import registerHealthRoutes from './routes/health'
import registerSecureRoutes from './routes/secure'
import registerSseRoutes from './routes/sse'
import registerMockAuth from './routes/mockAuth'
import pkg from '../package.json'

const buildServer = async () => {
  const app = fastify({
    logger: true,
    trustProxy: true
  })

  await app.register(cors, {
    origin: config.corsOrigin === '*'
      ? true
      : config.corsOrigin.split(',').map((item) => item.trim())
  })

  await app.register(requestIdPlugin)
  await app.register(rateLimitPlugin)
  await app.register(authPlugin)

  await app.register(swagger, {
    openapi: {
      info: {
        title: 'IAI Teaching BFF',
        version: pkg.version,
        description: 'Gateway/BFF for portal and AI tools'
      },
      servers: [{ url: `http://${config.host}:${config.port}`, description: 'local' }]
    },
    exposeRoute: true
  } as any)

  await app.register(swaggerUI, {
    routePrefix: '/docs',
    staticCSP: true
  })

  app.register(registerHealthRoutes, { prefix: '/api' })
  app.register(registerMockAuth, { prefix: '/api' })
  app.register(registerSecureRoutes, { prefix: '/api' })
  app.register(registerSseRoutes, { prefix: '/api' })

  app.setErrorHandler((err, request, reply) => {
    request.log.error({ err }, 'unhandled error')
    const status = err.statusCode ?? 500
    reply.code(status).send({
      code: err.code ?? 'INTERNAL_ERROR',
      message: err.message ?? 'Internal server error'
    })
  })

  return app
}

const start = async () => {
  const app = await buildServer()
  try {
    await app.listen({ port: config.port, host: config.host })
    app.log.info(`BFF ready on http://${config.host}:${config.port}`)
  } catch (err) {
    app.log.error(err)
    process.exit(1)
  }
}

if (require.main === module) {
  start()
}

export default buildServer
