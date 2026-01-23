import fastify from 'fastify'
import cors from '@fastify/cors'
import swagger from '@fastify/swagger'
import swaggerUI from '@fastify/swagger-ui'
import multipart from '@fastify/multipart'
import config from './config'
import authPlugin from './plugins/auth'
import rateLimitPlugin from './plugins/rateLimit'
import requestIdPlugin from './plugins/requestId'
import registerHealthRoutes from './routes/health'
import registerSecureRoutes from './routes/secure'
import registerSseRoutes from './routes/sse'
import registerMockAuth from './routes/mockAuth'
import registerAuthRoutes from './routes/auth'
import registerAnnouncementRoutes from './routes/announcements'
import registerScoreRoutes from './routes/academic/scores'
import registerTranscriptRoutes from './routes/academic/transcript'
import registerUserRoutes from './routes/users'
import registerToolsRoutes from './routes/tools'
import registerAssetRoutes from './routes/assets'
import registerOcrRoutes from './routes/ocr'
import registerChatRoutes from './routes/chat'
import registerGradingRoutes from './routes/grading'
import registerQuizRoutes from './routes/quizzes'
import registerStudentRoutes from './routes/students'
import registerEntryRoutes from './routes/entries'
import registerQuestionRoutes from './routes/questions'
import registerEventRoutes from './routes/events'
import registerPortalRoutes from './routes/portal'
import registerAuditLogRoutes from './routes/auditLogs'
import { ensureDevUsers } from './utils/devSeed'
import pkg from '../package.json'

const buildServer = async () => {
  if (config.env !== 'development' && (!config.jwtSecret || config.jwtSecret === 'dev-secret-change-me')) {
    throw new Error('Invalid JWT_SECRET: please set a strong secret in production.')
  }

  const app = fastify({
    logger: true,
    bodyLimit: 50 * 1024 * 1024 // 50MB
  })

  if (config.env !== 'development' && config.corsOrigin === '*') {
    app.log.warn('CORS_ORIGIN is "*"; consider restricting to trusted domains in production.')
  }

  await app.register(cors, {
    origin: config.corsOrigin === '*'
      ? true
      : config.corsOrigin.split(',').map((item) => item.trim())
  })

  await app.register(requestIdPlugin)
  await app.register(rateLimitPlugin)
  await app.register(authPlugin)
  await app.register(multipart, {
    limits: {
      fileSize: 50 * 1024 * 1024 // 50MB
    }
  })

  await app.register(swagger, {
    openapi: {
      info: {
        title: 'IAI Teaching BFF',
        version: pkg.version,
        description: 'Gateway/BFF for portal and AI tools',
        components: {
          securitySchemes: {
            bearerAuth: {
              type: 'http',
              scheme: 'bearer',
              bearerFormat: 'JWT'
            }
          }
        }
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
  app.register(registerAuthRoutes, { prefix: '/api' })
  app.register(registerAnnouncementRoutes, { prefix: '/api' })
  app.register(registerScoreRoutes, { prefix: '/api/academic/scores' })
  app.register(registerTranscriptRoutes, { prefix: '/api/academic/transcript' })
  app.register(registerUserRoutes, { prefix: '/api' })
  app.register(registerToolsRoutes, { prefix: '/api' })
  app.register(registerAssetRoutes, { prefix: '/api' })
  app.register(registerGradingRoutes, { prefix: '/api' })
  app.register(registerQuizRoutes, { prefix: '/api' })
  app.register(registerOcrRoutes, { prefix: '/api' })
  app.register(registerChatRoutes, { prefix: '/api' })
  app.register(registerStudentRoutes, { prefix: '/api' })
  app.register(registerEntryRoutes, { prefix: '/api' })
  app.register(registerQuestionRoutes, { prefix: '/api' })
  app.register(registerEventRoutes, { prefix: '/api' })
  app.register(registerPortalRoutes, { prefix: '/api' })
  app.register(registerAuditLogRoutes, { prefix: '/api' })

  app.setErrorHandler((err: any, request: any, reply: any) => {
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
    if (config.env === 'development') {
      const seeded = await ensureDevUsers()
      if (seeded.created.length > 0) {
        app.log.info({ users: seeded.created }, 'seeded dev users')
      }
    }
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
