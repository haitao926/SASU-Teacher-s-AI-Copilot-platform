import type { FastifyInstance } from 'fastify'
import prisma from '../utils/prisma'
import { requirePermission } from '../utils/permissions'

type AuditLogQuery = {
  page?: string
  pageSize?: string
  keyword?: string
  operatorId?: string
  action?: string
  resource?: string
  from?: string
  to?: string
}

function toIsoOrNull(value: unknown): Date | null {
  if (!value) return null
  const date = new Date(String(value))
  if (Number.isNaN(date.getTime())) return null
  return date
}

export default async function registerAuditLogRoutes(app: FastifyInstance) {
  app.get<{ Querystring: AuditLogQuery }>(
    '/admin/audit-logs',
    {
      preHandler: [app.authenticate, requirePermission('audit.view')],
      schema: {
        tags: ['audit'],
        summary: 'List audit logs (admin)',
        security: [{ bearerAuth: [] }],
        querystring: {
          type: 'object',
          properties: {
            page: { type: 'string' },
            pageSize: { type: 'string' },
            keyword: { type: 'string' },
            operatorId: { type: 'string' },
            action: { type: 'string' },
            resource: { type: 'string' },
            from: { type: 'string' },
            to: { type: 'string' }
          }
        }
      }
    },
    async (request) => {
      const { page = '1', pageSize = '20', keyword = '', operatorId, action, resource, from, to } = request.query as AuditLogQuery
      const pageNum = Math.max(parseInt(page, 10) || 1, 1)
      const sizeNum = Math.min(Math.max(parseInt(pageSize, 10) || 20, 1), 100)

      const where: any = {}
      if (operatorId) where.operatorId = String(operatorId).trim()
      if (action) where.action = String(action).trim()
      if (resource) where.resource = String(resource).trim()

      const fromDate = toIsoOrNull(from)
      const toDate = toIsoOrNull(to)
      if (fromDate || toDate) {
        where.createdAt = {}
        if (fromDate) where.createdAt.gte = fromDate
        if (toDate) where.createdAt.lte = toDate
      }

      const kw = keyword.trim()
      if (kw) {
        where.OR = [
          { operatorId: { contains: kw } },
          { resource: { contains: kw } },
          { resourceId: { contains: kw } },
          { details: { contains: kw } }
        ]
      }

      const [total, rows] = await prisma.$transaction([
        prisma.auditLog.count({ where }),
        prisma.auditLog.findMany({
          where,
          orderBy: { createdAt: 'desc' },
          skip: (pageNum - 1) * sizeNum,
          take: sizeNum
        })
      ])

      const operatorIds = Array.from(new Set(rows.map((r) => r.operatorId))).filter(Boolean)
      const users = operatorIds.length
        ? await prisma.user.findMany({
            where: { id: { in: operatorIds } },
            select: { id: true, username: true, name: true, role: true, tenantId: true }
          })
        : []
      const userMap = new Map(users.map((u) => [u.id, u]))

      const items = rows.map((r) => {
        const operator = userMap.get(r.operatorId)
        return {
          id: r.id,
          operatorId: r.operatorId,
          operator: operator
            ? {
                id: operator.id,
                username: operator.username,
                name: operator.name,
                role: operator.role,
                tenantId: operator.tenantId
              }
            : null,
          action: r.action,
          resource: r.resource,
          resourceId: r.resourceId,
          details: r.details,
          ipAddress: r.ipAddress,
          userAgent: r.userAgent,
          createdAt: r.createdAt.toISOString()
        }
      })

      return { items, total, page: pageNum, pageSize: sizeNum }
    }
  )
}

