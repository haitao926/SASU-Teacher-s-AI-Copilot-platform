import fp from 'fastify-plugin'
import rateLimit from '@fastify/rate-limit'
import config from '../config'

export default fp(async (app) => {
  await app.register(rateLimit, {
    max: config.rateLimit.max,
    timeWindow: config.rateLimit.timeWindow,
    ban: 0,
    errorResponseBuilder: () => ({
      code: 'RATE_LIMITED',
      message: 'Too many requests, please slow down.'
    })
  })
})
