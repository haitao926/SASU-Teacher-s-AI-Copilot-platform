import type { FastifyInstance } from 'fastify'
import prisma from '../utils/prisma'
import { requirePermission } from '../utils/permissions'

interface EntryBody {
  name: string
  description: string
  icon: string
  url: string
  status: string
  featured?: boolean
  order: number
  group: string
  tags?: string[] | string
  usage?: number
}

export default async function registerEntryRoutes(app: FastifyInstance) {
  const adminOnly = requirePermission('entries.manage')

  // Public: Get all entries and groups (for HomePage)
  app.get('/entries/config', {
    schema: {
      tags: ['entries'],
      summary: 'Get all groups and entries',
      response: {
        200: {
          type: 'object',
          properties: {
            groups: { type: 'array' },
            entries: { type: 'array' }
          }
        }
      }
    }
  }, async (request, reply) => {
    const [groups, entries] = await Promise.all([
      prisma.group.findMany({ orderBy: { order: 'asc' } }),
      prisma.entry.findMany({ orderBy: { order: 'asc' } })
    ])

    // Convert tags from string to array for frontend compatibility if needed, 
    // or frontend can handle string splitting. 
    // Here we return as is, but let's parse tags if they are JSON strings.
    const formattedEntries = entries.map(e => ({
      ...e,
      tags: e.tags ? e.tags.split(',').filter(Boolean) : []
    }))

    return { groups, entries: formattedEntries }
  })

  // Admin: Create Group
  app.post<{ Body: { name: string; icon: string; order: number } }>(
    '/admin/groups',
    { preValidation: [app.authenticate], preHandler: [adminOnly] },
    async (request, reply) => {
      const { name, icon, order } = request.body
      const group = await prisma.group.create({
        data: { name, icon, order }
      })
      return group
    }
  )

  // Admin: Update Group
  app.put<{ Params: { id: string }; Body: { name?: string; icon?: string; order?: number } }>(
    '/admin/groups/:id',
    { preValidation: [app.authenticate], preHandler: [adminOnly] },
    async (request, reply) => {
      const { id } = request.params
      const { name, icon, order } = request.body ?? {}
      const group = await prisma.group.update({
        where: { id },
        data: {
          name: name ?? undefined,
          icon: icon ?? undefined,
          order: order ?? undefined
        }
      })
      return group
    }
  )

  // Admin: Delete Group (only when empty)
  app.delete<{ Params: { id: string } }>(
    '/admin/groups/:id',
    { preValidation: [app.authenticate], preHandler: [adminOnly] },
    async (request, reply) => {
      const { id } = request.params
      const count = await prisma.entry.count({ where: { groupId: id } })
      if (count > 0) {
        return reply.code(400).send({ message: 'Group is not empty; please delete/move entries first.' })
      }
      await prisma.group.delete({ where: { id } })
      return { success: true }
    }
  )

  // Admin: Create Entry
  app.post<{ Body: EntryBody }>(
    '/admin/entries',
    { preValidation: [app.authenticate], preHandler: [adminOnly] },
    async (request, reply) => {
      const body = request.body
      // Handle tags array -> string
      const tagsString = Array.isArray(body.tags) ? body.tags.join(',') : body.tags

      const entry = await prisma.entry.create({
        data: {
          name: body.name,
          description: body.description,
          icon: body.icon,
          url: body.url,
          status: body.status,
          featured: body.featured,
          order: body.order,
          groupId: body.group, // Frontend sends 'group' ID
          tags: tagsString
        }
      })
      return entry
    }
  )

  // Admin: Update Entry
  app.put<{ Params: { id: string }; Body: EntryBody }>(
    '/admin/entries/:id',
    { preValidation: [app.authenticate], preHandler: [adminOnly] },
    async (request, reply) => {
      const { id } = request.params
      const body = request.body
      const tagsString = Array.isArray(body.tags) ? body.tags.join(',') : body.tags

      const entry = await prisma.entry.update({
        where: { id },
        data: {
          name: body.name,
          description: body.description,
          icon: body.icon,
          url: body.url,
          status: body.status,
          featured: body.featured,
          order: body.order,
          groupId: body.group,
          tags: tagsString,
          usage: body.usage
        }
      })
      return entry
    }
  )

  // Admin: Delete Entry
  app.delete<{ Params: { id: string } }>(
    '/admin/entries/:id',
    { preValidation: [app.authenticate], preHandler: [adminOnly] },
    async (request, reply) => {
      const { id } = request.params
      await prisma.entry.delete({ where: { id } })
      return { success: true }
    }
  )
  
  // Public: Record Usage (Click)
  app.post<{ Params: { id: string } }>(
    '/entries/:id/click',
    async (request, reply) => {
      const { id } = request.params
      await prisma.entry.update({
        where: { id },
        data: { usage: { increment: 1 } }
      })
      return { success: true }
    }
  )
}
