import type { FastifyInstance } from 'fastify'
import prisma from '../utils/prisma'
import { requirePermission } from '../utils/permissions'

type PortalUiPayload = {
  homeTitle: string
  homeSubtitle: string
  tipsEnabled: boolean
  tipsTitle: string
  tipsContent: string
}

function resolveTenantId(request: any): string {
  const headerTenant = (request.headers as any)?.['x-tenant-id']
  const tenantId = typeof headerTenant === 'string' ? headerTenant.trim() : ''
  return tenantId || 'default'
}

function formatPortalUi(row: any): PortalUiPayload & { tenantId: string } {
  return {
    tenantId: row.tenantId,
    homeTitle: row.homeTitle,
    homeSubtitle: row.homeSubtitle,
    tipsEnabled: !!row.tipsEnabled,
    tipsTitle: row.tipsTitle,
    tipsContent: row.tipsContent
  }
}

export default async function registerPortalRoutes(app: FastifyInstance) {
  const adminOnly = requirePermission('portal.manage')

  let ensured = false
  const ensureTable = async () => {
    if (ensured) return
    ensured = true

    await prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS "PortalUiConfig" (
        "id" TEXT NOT NULL PRIMARY KEY,
        "tenantId" TEXT NOT NULL DEFAULT 'default',
        "homeTitle" TEXT NOT NULL DEFAULT '常用应用',
        "homeSubtitle" TEXT NOT NULL DEFAULT '您收藏的教学工具，触手可及',
        "tipsEnabled" BOOLEAN NOT NULL DEFAULT true,
        "tipsTitle" TEXT NOT NULL DEFAULT 'AI 提问小技巧',
        "tipsContent" TEXT NOT NULL DEFAULT '试着给 AI 一个具体的“身份”，比如“你是一位有20年经验的中学数学老师”，它的回答会更专业哦。',
        "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updatedAt" DATETIME NOT NULL
      );
    `)

    await prisma.$executeRawUnsafe(`
      CREATE UNIQUE INDEX IF NOT EXISTS "PortalUiConfig_tenantId_key" ON "PortalUiConfig"("tenantId");
    `)

    await prisma.$executeRawUnsafe(`
      CREATE INDEX IF NOT EXISTS "PortalUiConfig_tenantId_idx" ON "PortalUiConfig"("tenantId");
    `)
  }

  const getOrCreate = async (tenantId: string) => {
    await ensureTable()
    return prisma.portalUiConfig.upsert({
      where: { tenantId },
      create: {
        tenantId
      },
      update: {}
    })
  }

  // Public: Portal UI settings (copy / tips)
  app.get(
    '/portal/settings',
    {
      schema: {
        tags: ['portal'],
        summary: 'Get portal UI settings',
        response: {
          200: {
            type: 'object',
            properties: {
              tenantId: { type: 'string' },
              homeTitle: { type: 'string' },
              homeSubtitle: { type: 'string' },
              tipsEnabled: { type: 'boolean' },
              tipsTitle: { type: 'string' },
              tipsContent: { type: 'string' }
            }
          }
        }
      }
    },
    async (request) => {
      const tenantId = resolveTenantId(request)
      const row = await getOrCreate(tenantId)
      return formatPortalUi(row)
    }
  )

  // Admin: Get settings
  app.get(
    '/admin/portal/settings',
    {
      preValidation: [app.authenticate],
      preHandler: [adminOnly],
      schema: {
        tags: ['portal'],
        summary: 'Get portal UI settings (admin)',
        security: [{ bearerAuth: [] }]
      }
    },
    async (request) => {
      const tenantId = request.tenantId || 'default'
      const row = await getOrCreate(tenantId)
      return formatPortalUi(row)
    }
  )

  // Admin: Update settings
  app.put<{ Body: Partial<PortalUiPayload> }>(
    '/admin/portal/settings',
    {
      preValidation: [app.authenticate],
      preHandler: [adminOnly],
      schema: {
        tags: ['portal'],
        summary: 'Update portal UI settings (admin)',
        security: [{ bearerAuth: [] }],
        body: {
          type: 'object',
          properties: {
            homeTitle: { type: 'string' },
            homeSubtitle: { type: 'string' },
            tipsEnabled: { type: 'boolean' },
            tipsTitle: { type: 'string' },
            tipsContent: { type: 'string' }
          }
        }
      }
    },
    async (request) => {
      const tenantId = request.tenantId || 'default'
      await ensureTable()

      const body = request.body ?? {}

      const sanitizeText = (value: unknown, fallback: string) => {
        if (typeof value !== 'string') return fallback
        const trimmed = value.trim()
        return trimmed || fallback
      }

      const updateData = {
        homeTitle: body.homeTitle === undefined ? undefined : sanitizeText(body.homeTitle, '常用应用'),
        homeSubtitle: body.homeSubtitle === undefined ? undefined : sanitizeText(body.homeSubtitle, '您收藏的教学工具，触手可及'),
        tipsEnabled: body.tipsEnabled === undefined ? undefined : !!body.tipsEnabled,
        tipsTitle: body.tipsTitle === undefined ? undefined : sanitizeText(body.tipsTitle, 'AI 提问小技巧'),
        tipsContent:
          body.tipsContent === undefined
            ? undefined
            : sanitizeText(body.tipsContent, '试着给 AI 一个具体的“身份”，比如“你是一位有20年经验的中学数学老师”，它的回答会更专业哦。'),
      }

      const row = await prisma.portalUiConfig.upsert({
        where: { tenantId },
        create: {
          tenantId,
          ...Object.fromEntries(Object.entries(updateData).filter(([, v]) => v !== undefined))
        } as any,
        update: updateData
      })

      return formatPortalUi(row)
    }
  )
}
