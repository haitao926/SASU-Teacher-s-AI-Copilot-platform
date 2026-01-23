import type { FastifyInstance } from 'fastify'
import prisma from '../utils/prisma'
import { hasPermission } from '../utils/permissions'

type AuthUser = { sub: string; role?: string }

type LearningEventInput = {
  action: string
  appCode?: string
  targetType?: string
  targetId?: string
  payload?: unknown
  occurredAt?: string
}

function toIsoOrNull(value: unknown): Date | null {
  if (!value) return null
  const date = new Date(String(value))
  if (Number.isNaN(date.getTime())) return null
  return date
}

function serializePayload(payload: unknown): string | null {
  if (payload === undefined) return null
  if (payload === null) return null
  try {
    return JSON.stringify(payload)
  } catch {
    return null
  }
}

export default async function registerEventRoutes(app: FastifyInstance) {
  // Micro-apps report user actions for learning analytics.
  // Supports both single-event and batch reporting.
  app.post<{ Body: { events?: LearningEventInput[] } & Partial<LearningEventInput> }>(
    '/events',
    {
      preHandler: [app.authenticate],
      schema: {
        tags: ['events'],
        summary: 'Report learning events (single or batch)',
        security: [{ bearerAuth: [] }],
        body: {
          type: 'object',
          properties: {
            events: {
              type: 'array',
              items: {
                type: 'object',
                required: ['action'],
                properties: {
                  action: { type: 'string', minLength: 1 },
                  appCode: { type: 'string' },
                  targetType: { type: 'string' },
                  targetId: { type: 'string' },
                  occurredAt: { type: 'string' },
                  payload: {}
                }
              }
            },
            action: { type: 'string' },
            appCode: { type: 'string' },
            targetType: { type: 'string' },
            targetId: { type: 'string' },
            occurredAt: { type: 'string' },
            payload: {}
          }
        },
        response: {
          200: {
            type: 'object',
            properties: {
              success: { type: 'boolean' },
              count: { type: 'number' }
            }
          }
        }
      }
    },
    async (request, reply) => {
      const user = request.user as AuthUser
      const tenantId = request.tenantId ?? 'default'
      const actorId = user?.sub
      if (!actorId) {
        return reply.code(401).send({ message: 'Invalid token' })
      }

      const body = request.body as any
      const inputs: LearningEventInput[] = Array.isArray(body?.events) ? body.events : [body]
      const now = new Date()

      const data = inputs
        .map((e) => ({
          action: String(e?.action ?? '').trim(),
          appCode: e?.appCode ? String(e.appCode).trim() : null,
          targetType: e?.targetType ? String(e.targetType).trim() : null,
          targetId: e?.targetId ? String(e.targetId).trim() : null,
          payload: serializePayload(e?.payload),
          occurredAt: toIsoOrNull(e?.occurredAt) ?? now
        }))
        .filter((e) => e.action.length > 0)

      if (data.length === 0) {
        return reply.code(400).send({ message: 'events is required' })
      }

      await prisma.learningEvent.createMany({
        data: data.map((e) => ({
          tenantId,
          actorId,
          actorRole: user.role ?? null,
          appCode: e.appCode,
          action: e.action,
          targetType: e.targetType,
          targetId: e.targetId,
          payload: e.payload,
          occurredAt: e.occurredAt
        }))
      })

      return { success: true, count: data.length }
    }
  )

  // Recent events (for debugging / dashboards).
  app.get<{ Querystring: { limit?: string; from?: string; to?: string } }>(
    '/events/recent',
    {
      preHandler: [app.authenticate],
      schema: {
        tags: ['events'],
        summary: 'List recent learning events (scoped by role)',
        security: [{ bearerAuth: [] }],
        querystring: {
          type: 'object',
          properties: {
            limit: { type: 'string' },
            from: { type: 'string' },
            to: { type: 'string' }
          }
        }
      }
    },
    async (request) => {
      const user = request.user as AuthUser
      const tenantId = request.tenantId ?? 'default'
      const limit = Math.min(Math.max(Number.parseInt(request.query.limit ?? '50', 10) || 50, 1), 200)

      const from = toIsoOrNull(request.query.from)
      const to = toIsoOrNull(request.query.to)

      const where: any = { tenantId }
      if (from || to) {
        where.occurredAt = {}
        if (from) where.occurredAt.gte = from
        if (to) where.occurredAt.lte = to
      }
      if (user.role !== 'ADMIN' && !hasPermission(user, 'events.view_all')) {
        where.actorId = user.sub
      }

      const rows = await prisma.learningEvent.findMany({
        where,
        orderBy: { occurredAt: 'desc' },
        take: limit
      })

      return rows.map((e) => ({
        id: e.id,
        tenantId: e.tenantId,
        actorId: e.actorId,
        actorRole: e.actorRole,
        appCode: e.appCode,
        action: e.action,
        targetType: e.targetType,
        targetId: e.targetId,
        payload: e.payload ? safeParseJson(e.payload) : null,
        occurredAt: e.occurredAt.toISOString(),
        createdAt: e.createdAt.toISOString()
      }))
    }
  )

  // Aggregation endpoint for dashboards.
  app.get<{ Querystring: { from?: string; to?: string } }>(
    '/events/stats',
    {
      preHandler: [app.authenticate],
      schema: {
        tags: ['events'],
        summary: 'Aggregate learning events (scoped by role)',
        security: [{ bearerAuth: [] }],
        querystring: {
          type: 'object',
          properties: {
            from: { type: 'string' },
            to: { type: 'string' }
          }
        }
      }
    },
    async (request) => {
      const user = request.user as AuthUser
      const tenantId = request.tenantId ?? 'default'

      const now = new Date()
      const defaultFrom = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
      const from = toIsoOrNull(request.query.from) ?? defaultFrom
      const to = toIsoOrNull(request.query.to) ?? now

      const where: any = {
        tenantId,
        occurredAt: { gte: from, lte: to }
      }
      if (user.role !== 'ADMIN' && !hasPermission(user, 'events.view_all')) {
        where.actorId = user.sub
      }

      const [byActionRaw, byAppRaw, total] = await Promise.all([
        prisma.learningEvent.groupBy({
          by: ['action'],
          where,
          _count: { _all: true }
        }),
        prisma.learningEvent.groupBy({
          by: ['appCode'],
          where,
          _count: { _all: true }
        }),
        prisma.learningEvent.count({ where })
      ])

      const byAction = byActionRaw
        .map((row) => ({ action: row.action, count: row._count._all }))
        .sort((a, b) => b.count - a.count)

      const byApp = byAppRaw
        .map((row) => ({ appCode: row.appCode ?? 'unknown', count: row._count._all }))
        .sort((a, b) => b.count - a.count)

      return {
        range: { from: from.toISOString(), to: to.toISOString() },
        scope: user.role === 'ADMIN' || hasPermission(user, 'events.view_all') ? 'tenant' : 'user',
        total,
        byAction,
        byApp
      }
    }
  )
}

function safeParseJson(value: string) {
  try {
    return JSON.parse(value)
  } catch {
    return null
  }
}
