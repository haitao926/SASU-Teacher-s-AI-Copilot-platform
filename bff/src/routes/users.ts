import type { FastifyInstance } from 'fastify'
import prisma from '../utils/prisma'

export default async function registerUserRoutes(app: FastifyInstance) {
  // Get all users (ADMIN only)
  app.get(
    '/users',
    {
      preHandler: [app.authenticate],
      schema: {
        tags: ['users'],
        summary: 'Get all users',
        response: {
          200: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                id: { type: 'string' },
                username: { type: 'string' },
                name: { type: 'string' },
                role: { type: 'string' },
                createdAt: { type: 'string' }
              }
            }
          }
        }
      }
    },
    async (request, reply) => {
      const user = request.user as any
      if (user.role !== 'ADMIN') {
        return reply.code(403).send({ message: 'Forbidden' })
      }

      const users = await prisma.user.findMany({
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          username: true,
          name: true,
          role: true,
          createdAt: true
          // Password not returned
        }
      })
      return users
    }
  )

  // Create user (ADMIN only)
  app.post<{ Body: { username: string; password: string; name: string; role: string } }>(
    '/users',
    {
      preHandler: [app.authenticate],
      schema: {
        tags: ['users'],
        summary: 'Create a new user',
        body: {
          type: 'object',
          required: ['username', 'password', 'name'],
          properties: {
            username: { type: 'string' },
            password: { type: 'string' },
            name: { type: 'string' },
            role: { type: 'string', enum: ['ADMIN', 'TEACHER'], default: 'TEACHER' }
          }
        }
      }
    },
    async (request, reply) => {
      const user = request.user as any
      if (user.role !== 'ADMIN') {
        return reply.code(403).send({ message: 'Forbidden' })
      }

      const { username, password, name, role } = request.body

      try {
        const newUser = await prisma.user.create({
          data: {
            username,
            password, // Storing plain text as per current project convention (upgrade later)
            name,
            role: role || 'TEACHER'
          },
          select: {
            id: true,
            username: true,
            name: true,
            role: true,
            createdAt: true
          }
        })
        return newUser
      } catch (e: any) {
        if (e.code === 'P2002') {
          return reply.code(409).send({ message: 'Username already exists' })
        }
        throw e
      }
    }
  )

  // Update user (ADMIN only)
  app.put<{ Params: { id: string }; Body: { name?: string; password?: string; role?: string } }>(
    '/users/:id',
    {
      preHandler: [app.authenticate],
      schema: {
        tags: ['users'],
        summary: 'Update user',
        params: {
          type: 'object',
          properties: {
            id: { type: 'string' }
          }
        },
        body: {
          type: 'object',
          properties: {
            name: { type: 'string' },
            password: { type: 'string' },
            role: { type: 'string', enum: ['ADMIN', 'TEACHER'] }
          }
        }
      }
    },
    async (request, reply) => {
      const user = request.user as any
      if (user.role !== 'ADMIN') {
        return reply.code(403).send({ message: 'Forbidden' })
      }

      const { id } = request.params
      const { name, password, role } = request.body

      const data: any = {}
      if (name) data.name = name
      if (password) data.password = password
      if (role) data.role = role

      const updatedUser = await prisma.user.update({
        where: { id },
        data,
        select: {
          id: true,
          username: true,
          name: true,
          role: true,
          createdAt: true
        }
      })
      return updatedUser
    }
  )

  // Delete user (ADMIN only)
  app.delete<{ Params: { id: string } }>(
    '/users/:id',
    {
      preHandler: [app.authenticate],
      schema: {
        tags: ['users'],
        summary: 'Delete user',
        params: {
          type: 'object',
          properties: {
            id: { type: 'string' }
          }
        }
      }
    },
    async (request, reply) => {
      const user = request.user as any
      if (user.role !== 'ADMIN') {
        return reply.code(403).send({ message: 'Forbidden' })
      }

      const { id } = request.params

      // Prevent deleting self (optional but good practice)
      if (user.sub === id) {
        return reply.code(400).send({ message: 'Cannot delete yourself' })
      }

      await prisma.user.delete({
        where: { id }
      })

      return { success: true }
    }
  )
}
