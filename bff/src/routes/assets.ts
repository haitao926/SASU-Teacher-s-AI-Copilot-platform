import type { FastifyInstance } from 'fastify'
import {
  createAsset,
  getAssetForUser,
  listAssets,
  updateAsset,
  softDeleteAsset,
  ALLOWED_ASSET_TYPES,
  ALLOWED_VISIBILITY,
  restoreAsset
} from '../services/assets'
import { recordAudit } from '../services/audit'
import { hasPermission } from '../utils/permissions'

type AuthUser = { sub: string; role: string }

interface AssetListQuery {
  toolId?: string
  type?: string
  visibility?: string
  keyword?: string
  mine?: string
  page?: string
  pageSize?: string
  limit?: number
  offset?: number
}

interface AssetCreateBody {
  title: string
  summary?: string
  content?: string
  contentUrl?: string
  metadata?: Record<string, unknown>
  tags?: string[]
  type: string
  toolId?: string
  visibility?: string
}

interface AssetUpdateBody {
  title?: string
  summary?: string | null
  content?: string | null
  contentUrl?: string | null
  metadata?: Record<string, unknown> | null
  tags?: string[] | null
  type?: string
  toolId?: string | null
  visibility?: string
}

function coerceNumber(value: unknown): number | undefined {
  if (value === undefined || value === null) return undefined
  const num = Number(value)
  return Number.isFinite(num) ? num : undefined
}

function coerceInt(value: unknown): number | undefined {
  if (value === undefined || value === null) return undefined
  const num = Number.parseInt(String(value), 10)
  return Number.isFinite(num) ? num : undefined
}

export default async function registerAssetRoutes(app: FastifyInstance) {
  app.get<{ Querystring: AssetListQuery }>(
    '/assets',
    {
      preHandler: [app.authenticate],
      schema: {
        tags: ['assets'],
        summary: 'List accessible assets',
        security: [{ bearerAuth: [] }],
        querystring: {
          type: 'object',
          properties: {
            toolId: { type: 'string' },
            type: { type: 'string', enum: ALLOWED_ASSET_TYPES },
            visibility: { type: 'string', enum: ALLOWED_VISIBILITY },
            keyword: { type: 'string' },
            mine: { type: 'string' },
            page: { type: 'string' },
            pageSize: { type: 'string' },
            limit: { type: 'number', minimum: 1, maximum: 100 },
            offset: { type: 'number', minimum: 0 }
          }
        }
      }
    },
    async (request, reply) => {
      const user = request.user as AuthUser
      const tenantId = request.tenantId ?? 'default'
      const isAssetAdmin = user.role === 'ADMIN' || hasPermission(user, 'assets.manage_all')
      const effectiveRole = isAssetAdmin ? 'ADMIN' : user.role
      const mine = String((request.query as any)?.mine ?? '').toLowerCase() === 'true'
      const limitFromQuery = coerceNumber(request.query.limit)
      const offsetFromQuery = coerceNumber(request.query.offset)
      const page = coerceInt(request.query.page) ?? 1
      const pageSize = Math.min(Math.max(coerceInt(request.query.pageSize) ?? 20, 1), 100)

      const limit = limitFromQuery ?? pageSize
      const offset = offsetFromQuery ?? (Math.max(page, 1) - 1) * pageSize

      try {
        const result = await listAssets({
          tenantId,
          userId: user.sub,
          role: effectiveRole,
          keyword: request.query.keyword,
          toolId: request.query.toolId,
          type: request.query.type,
          visibility: request.query.visibility,
          mine,
          limit,
          offset
        })
        return {
          ...result,
          page: Math.floor(result.offset / result.limit) + 1,
          pageSize: result.limit
        }
      } catch (err) {
        request.log.warn({ err }, 'failed to list assets')
        return reply.code(400).send({ message: (err as Error).message })
      }
    }
  )

  app.post<{ Body: AssetCreateBody }>(
    '/assets',
    {
      preHandler: [app.authenticate],
      schema: {
        tags: ['assets'],
        summary: 'Create an asset',
        security: [{ bearerAuth: [] }],
        body: {
          type: 'object',
          required: ['title', 'type'],
          properties: {
            title: { type: 'string' },
            summary: { type: 'string' },
            content: { type: 'string' },
            contentUrl: { type: 'string' },
            metadata: { type: 'object' },
            tags: { type: 'array', items: { type: 'string' } },
            type: { type: 'string', enum: ALLOWED_ASSET_TYPES },
            toolId: { type: 'string' },
            visibility: { type: 'string', enum: ALLOWED_VISIBILITY }
          }
        }
      }
    },
    async (request, reply) => {
      const user = request.user as AuthUser
      const tenantId = request.tenantId ?? 'default'
      const isAssetAdmin = user.role === 'ADMIN' || hasPermission(user, 'assets.manage_all')
      const effectiveRole = isAssetAdmin ? 'ADMIN' : user.role

      if (user.role === 'VIEWER' && !isAssetAdmin) {
        return reply.code(403).send({ message: 'Forbidden' })
      }
      if (request.body.visibility === 'PUBLIC' && !isAssetAdmin) {
        return reply.code(403).send({ message: 'Only admin can set PUBLIC visibility' })
      }
      if (!request.body.content && !request.body.contentUrl) {
        return reply.code(400).send({ message: 'content 或 contentUrl 需至少提供一项' })
      }

      try {
        const asset = await createAsset({
          tenantId,
          authorId: user.sub,
          title: request.body.title,
          summary: request.body.summary,
          content: request.body.content,
          contentUrl: request.body.contentUrl,
          metadata: request.body.metadata,
          tags: request.body.tags,
          type: request.body.type,
          toolId: request.body.toolId,
          visibility: request.body.visibility
        })
        await recordAudit({
          operatorId: user.sub,
          action: 'CREATE',
          resource: 'Asset',
          resourceId: asset.id,
          details: {
            title: asset.title,
            type: asset.type,
            visibility: asset.visibility,
            toolId: asset.toolId
          },
          request
        })
        return asset
      } catch (err) {
        request.log.warn({ err }, 'failed to create asset')
        return reply.code(400).send({ message: (err as Error).message })
      }
    }
  )

  app.put<{ Params: { id: string }; Body: AssetUpdateBody }>(
    '/assets/:id',
    {
      preHandler: [app.authenticate],
      schema: {
        tags: ['assets'],
        summary: 'Update an asset',
        security: [{ bearerAuth: [] }],
        params: {
          type: 'object',
          properties: {
            id: { type: 'string' }
          }
        },
        body: {
          type: 'object',
          properties: {
            title: { type: 'string' },
            summary: { type: ['string', 'null'] as any },
            content: { type: ['string', 'null'] as any },
            contentUrl: { type: ['string', 'null'] as any },
            metadata: { type: ['object', 'null'] as any },
            tags: { type: ['array', 'null'] as any, items: { type: 'string' } },
            type: { type: 'string', enum: ALLOWED_ASSET_TYPES },
            toolId: { type: ['string', 'null'] as any },
            visibility: { type: 'string', enum: ALLOWED_VISIBILITY }
          }
        }
      }
    },
    async (request, reply) => {
      const user = request.user as AuthUser
      const tenantId = request.tenantId ?? 'default'
      const isAssetAdmin = user.role === 'ADMIN' || hasPermission(user, 'assets.manage_all')
      const effectiveRole = isAssetAdmin ? 'ADMIN' : user.role

      if (user.role === 'VIEWER' && !isAssetAdmin) {
        return reply.code(403).send({ message: 'Forbidden' })
      }
      if (request.body.visibility === 'PUBLIC' && !isAssetAdmin) {
        return reply.code(403).send({ message: 'Only admin can set PUBLIC visibility' })
      }

      // Prevent accidentally clearing both content & contentUrl.
      if (request.body.content === null && request.body.contentUrl === null) {
        return reply.code(400).send({ message: 'content 与 contentUrl 不可同时清空' })
      }

      try {
        const updated = await updateAsset(request.params.id, tenantId, user.sub, effectiveRole, request.body)
        if (updated === null) {
          return reply.code(404).send({ message: '资产不存在' })
        }
        if (updated === false) {
          return reply.code(403).send({ message: '无权限编辑该资产' })
        }

        await recordAudit({
          operatorId: user.sub,
          action: 'UPDATE',
          resource: 'Asset',
          resourceId: updated.id,
          details: {
            title: updated.title,
            type: updated.type,
            visibility: updated.visibility,
            toolId: updated.toolId
          },
          request
        })

        return updated
      } catch (err) {
        request.log.warn({ err }, 'failed to update asset')
        return reply.code(400).send({ message: (err as Error).message })
      }
    }
  )

  app.get<{ Params: { id: string } }>(
    '/assets/:id',
    {
      preHandler: [app.authenticate],
      schema: {
        tags: ['assets'],
        summary: 'Get asset detail',
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
      const user = request.user as AuthUser
      const tenantId = request.tenantId ?? 'default'
      const isAssetAdmin = user.role === 'ADMIN' || hasPermission(user, 'assets.manage_all')
      const effectiveRole = isAssetAdmin ? 'ADMIN' : user.role

      const asset = await getAssetForUser(request.params.id, tenantId, user.sub, effectiveRole)
      if (!asset) {
        return reply.code(404).send({ message: '资产不存在或无权限访问' })
      }
      return asset
    }
  )

  app.delete<{ Params: { id: string } }>(
    '/assets/:id',
    {
      preHandler: [app.authenticate],
      schema: {
        tags: ['assets'],
        summary: 'Soft delete an asset',
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
      const user = request.user as AuthUser
      const tenantId = request.tenantId ?? 'default'
      const isAssetAdmin = user.role === 'ADMIN' || hasPermission(user, 'assets.manage_all')
      const effectiveRole = isAssetAdmin ? 'ADMIN' : user.role

      const result = await softDeleteAsset(request.params.id, tenantId, user.sub, effectiveRole)
      if (result === null) {
        return reply.code(404).send({ message: '资产不存在' })
      }
      if (result === false) {
        return reply.code(403).send({ message: '无权限删除该资产' })
      }
      await recordAudit({
        operatorId: user.sub,
        action: 'DELETE',
        resource: 'Asset',
        resourceId: request.params.id,
        details: { reason: 'soft-delete' },
        request
      })
      return { success: true }
    }
  )

  app.post<{ Params: { id: string } }>(
    '/assets/:id/restore',
    {
      preHandler: [app.authenticate],
      schema: {
        tags: ['assets'],
        summary: 'Restore a soft-deleted asset',
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
      const user = request.user as AuthUser
      const tenantId = request.tenantId ?? 'default'
      const isAssetAdmin = user.role === 'ADMIN' || hasPermission(user, 'assets.manage_all')
      const effectiveRole = isAssetAdmin ? 'ADMIN' : user.role

      const result = await restoreAsset(request.params.id, tenantId, user.sub, effectiveRole)
      if (result === null) {
        return reply.code(404).send({ message: '资产不存在' })
      }
      if (result === false) {
        return reply.code(403).send({ message: '无权限恢复该资产' })
      }
      await recordAudit({
        operatorId: user.sub,
        action: 'RESTORE',
        resource: 'Asset',
        resourceId: request.params.id,
        request
      })
      return { success: true }
    }
  )
}
