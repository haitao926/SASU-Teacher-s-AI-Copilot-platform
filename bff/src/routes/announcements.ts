import type { FastifyInstance } from 'fastify'
import { createAnnouncement, deleteAnnouncement, listAnnouncements } from '../services/announcements'
import { requirePermission } from '../utils/permissions'

export default async function registerAnnouncementRoutes(app: FastifyInstance) {
  // Public: Get all announcements
  app.get(
    '/announcements',
    {
      schema: {
        tags: ['announcements'],
        summary: 'Get all announcements',
        response: {
          200: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                id: { type: 'string' },
                title: { type: 'string' },
                content: { type: 'string' },
                tag: { type: 'string', nullable: true },
                tagType: { type: 'string' },
                pinned: { type: 'boolean' },
                time: { type: 'string' } // Mapped from createdAt
              }
            }
          }
        }
      }
    },
    async () => listAnnouncements()
  )

  // Protected: Create announcement (Admin only)
  app.post<{ Body: { title: string; content: string; tag?: string; tagType?: string; pinned?: boolean } }>(
    '/announcements',
    {
      preHandler: [app.authenticate, requirePermission('announcements.manage')], // Ensure user is logged in
      schema: {
        tags: ['announcements'],
        summary: 'Create announcement',
        security: [{ bearerAuth: [] }],
        body: {
          type: 'object',
          required: ['title', 'content'],
          properties: {
            title: { type: 'string' },
            content: { type: 'string' },
            tag: { type: 'string' },
            tagType: { type: 'string' },
            pinned: { type: 'boolean' }
          }
        }
      }
    },
    async (request, reply) => {
      const user = request.user as { role: string; sub: string }

      const newItem = await createAnnouncement(request.body, user.sub)
      return newItem
    }
  )

  // Protected: Delete announcement
  app.delete<{ Params: { id: string } }>(
    '/announcements/:id',
    {
      preHandler: [app.authenticate, requirePermission('announcements.manage')],
      schema: {
        tags: ['announcements'],
        summary: 'Delete announcement',
        security: [{ bearerAuth: [] }],
        params: {
          type: 'object',
          properties: {
            id: { type: 'string' }
          }
        }
      }
    },
    async (request, reply) => {
      const { id } = request.params
      return deleteAnnouncement(id)
    }
  )
}
