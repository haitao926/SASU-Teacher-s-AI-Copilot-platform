import type { FastifyInstance } from 'fastify'
import prisma from '../utils/prisma'
import { verifyPassword } from '../utils/password'

export default async function registerAuthRoutes(app: FastifyInstance) {
  app.post<{ Body: { username: string; password: string } }>(
    '/auth/login',
    {
      schema: {
        tags: ['auth'],
        summary: 'Login to get access token',
        body: {
          type: 'object',
          required: ['username', 'password'],
          properties: {
            username: { type: 'string' },
            password: { type: 'string' }
          }
        },
        response: {
          200: {
            type: 'object',
            properties: {
              token: { type: 'string' },
              user: {
                type: 'object',
                properties: {
                  id: { type: 'string' },
                  username: { type: 'string' },
                  name: { type: 'string' },
                  role: { type: 'string' }
                }
              }
            }
          },
          401: {
            type: 'object',
            properties: {
              message: { type: 'string' }
            }
          }
        }
      }
    },
    async (request, reply) => {
      const { username, password } = request.body

      const user = await prisma.user.findUnique({
        where: { username }
      })

      if (!user || !verifyPassword(password, user.password)) {
        return reply.code(401).send({ message: 'Invalid credentials' })
      }

      const token = app.jwt.sign(
        { sub: user.id, username: user.username, role: user.role },
        { expiresIn: '7d' }
      )

      return {
        token,
        user: {
          id: user.id,
          username: user.username,
          name: user.name,
          role: user.role
        }
      }
    }
  )
}
