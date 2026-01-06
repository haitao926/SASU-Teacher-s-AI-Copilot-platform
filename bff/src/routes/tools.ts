import type { FastifyInstance } from 'fastify'
import config from '../config'
import {
  listTools,
  createTool,
  updateTool,
  softDeleteTool,
  restoreTool,
  ALLOWED_TOOL_STATUS
} from '../services/tools'
import { recordAudit } from '../services/audit'
import { getTenantId } from '../utils/tenant'

interface OptimizePromptBody {
  prompt: string
  audience?: string
  context?: string
  outputFormat?: string
}

type AuthUser = { sub: string; role: string }

export default async function registerToolsRoutes(app: FastifyInstance) {
  app.get<{ Querystring: { tenantId?: string; category?: string; status?: string; includeDisabled?: boolean } }>(
    '/tools',
    {
      schema: {
        tags: ['tools'],
        summary: 'List tools for menu rendering',
        querystring: {
          type: 'object',
          properties: {
            tenantId: { type: 'string' },
            category: { type: 'string' },
            status: { type: 'string' },
            includeDisabled: { type: 'boolean' }
          }
        },
        response: {
          200: {
            type: 'object',
            properties: {
              items: {
                type: 'array',
                items: {
                  type: 'object',
                  properties: {
                    id: { type: 'string' },
                    tenantId: { type: 'string' },
                    code: { type: 'string' },
                    name: { type: 'string' },
                    description: { type: 'string', nullable: true },
                    icon: { type: 'string' },
                    route: { type: 'string' },
                    category: { type: 'string' },
                    tags: { type: 'array', items: { type: 'string' } },
                    status: { type: 'string' },
                    isEnabled: { type: 'boolean' },
                    order: { type: 'number' },
                    createdAt: { type: 'string' },
                    updatedAt: { type: 'string' }
                  }
                }
              }
            }
          }
        }
      }
    },
    async (request) => {
      const { tenantId, category, status, includeDisabled } = request.query
      const items = await listTools({
        tenantId: tenantId ?? 'default',
        category: category ?? undefined,
        status: status ? status.toUpperCase() : undefined,
        includeDisabled: includeDisabled ?? false
      })
      return { items }
    }
  )

  app.post<{
    Body: {
      code: string
      name: string
      description?: string
      icon: string
      route: string
      category: string
      tags?: string[]
      status?: string
      isEnabled?: boolean
      order?: number
      ownerId?: string
    }
  }>(
    '/tools',
    {
      preHandler: [app.authenticate],
      schema: {
        tags: ['tools'],
        summary: 'Create a tool (admin)',
        security: [{ bearerAuth: [] }],
        body: {
          type: 'object',
          required: ['code', 'name', 'icon', 'route', 'category'],
          properties: {
            code: { type: 'string' },
            name: { type: 'string' },
            description: { type: 'string' },
            icon: { type: 'string' },
            route: { type: 'string' },
            category: { type: 'string' },
            tags: { type: 'array', items: { type: 'string' } },
            status: { type: 'string', enum: ALLOWED_TOOL_STATUS },
            isEnabled: { type: 'boolean' },
            order: { type: 'number' },
            ownerId: { type: 'string' }
          }
        }
      }
    },
    async (request, reply) => {
      const user = request.user as AuthUser
      if (user.role !== 'ADMIN') {
        return reply.code(403).send({ message: 'Forbidden' })
      }

      try {
        const tool = await createTool({
          tenantId: getTenantId(request.headers),
          ...request.body
        })
        await recordAudit({
          operatorId: user.sub,
          action: 'CREATE',
          resource: 'Tool',
          resourceId: tool.id,
          details: {
            code: tool.code,
            status: tool.status,
            isEnabled: tool.isEnabled
          },
          request
        })
        return tool
      } catch (err) {
        request.log.warn({ err }, 'failed to create tool')
        return reply.code(400).send({ message: (err as Error).message })
      }
    }
  )

  app.put<{
    Params: { id: string }
    Body: {
      name?: string
      description?: string
      icon?: string
      route?: string
      category?: string
      tags?: string[]
      status?: string
      isEnabled?: boolean
      order?: number
      ownerId?: string | null
      deletedAt?: string | null
    }
  }>(
    '/tools/:id',
    {
      preHandler: [app.authenticate],
      schema: {
        tags: ['tools'],
        summary: 'Update a tool (admin)',
        security: [{ bearerAuth: [] }],
        params: {
          type: 'object',
          properties: { id: { type: 'string' } }
        },
        body: {
          type: 'object',
          properties: {
            name: { type: 'string' },
            description: { type: 'string' },
            icon: { type: 'string' },
            route: { type: 'string' },
            category: { type: 'string' },
            tags: { type: 'array', items: { type: 'string' } },
            status: { type: 'string', enum: ALLOWED_TOOL_STATUS },
            isEnabled: { type: 'boolean' },
            order: { type: 'number' },
            ownerId: { type: 'string', nullable: true },
            deletedAt: { type: 'string', nullable: true, format: 'date-time' }
          }
        }
      }
    },
    async (request, reply) => {
      const user = request.user as AuthUser
      if (user.role !== 'ADMIN') {
        return reply.code(403).send({ message: 'Forbidden' })
      }

      try {
        const updated = await updateTool(
          request.params.id,
          getTenantId(request.headers),
          request.body
        )
        if (!updated) {
          return reply.code(404).send({ message: 'Tool not found' })
        }
        await recordAudit({
          operatorId: user.sub,
          action: 'UPDATE',
          resource: 'Tool',
          resourceId: updated.id,
          details: {
            status: updated.status,
            isEnabled: updated.isEnabled,
            order: updated.order
          },
          request
        })
        return updated
      } catch (err) {
        request.log.warn({ err }, 'failed to update tool')
        return reply.code(400).send({ message: (err as Error).message })
      }
    }
  )

  app.delete<{ Params: { id: string } }>(
    '/tools/:id',
    {
      preHandler: [app.authenticate],
      schema: {
        tags: ['tools'],
        summary: 'Soft delete a tool (admin)',
        security: [{ bearerAuth: [] }],
        params: {
          type: 'object',
          properties: { id: { type: 'string' } }
        }
      }
    },
    async (request, reply) => {
      const user = request.user as AuthUser
      if (user.role !== 'ADMIN') {
        return reply.code(403).send({ message: 'Forbidden' })
      }

      const ok = await softDeleteTool(request.params.id, getTenantId(request.headers))
      if (ok === null) {
        return reply.code(404).send({ message: 'Tool not found' })
      }
      await recordAudit({
        operatorId: user.sub,
        action: 'DELETE',
        resource: 'Tool',
        resourceId: request.params.id,
        details: { reason: 'soft-delete' },
        request
      })
      return { success: true }
    }
  )

  app.post<{ Params: { id: string } }>(
    '/tools/:id/restore',
    {
      preHandler: [app.authenticate],
      schema: {
        tags: ['tools'],
        summary: 'Restore a soft-deleted tool (admin)',
        security: [{ bearerAuth: [] }],
        params: {
          type: 'object',
          properties: { id: { type: 'string' } }
        }
      }
    },
    async (request, reply) => {
      const user = request.user as AuthUser
      if (user.role !== 'ADMIN') {
        return reply.code(403).send({ message: 'Forbidden' })
      }

      const ok = await restoreTool(request.params.id, getTenantId(request.headers))
      if (ok === null) {
        return reply.code(404).send({ message: 'Tool not found' })
      }
      await recordAudit({
        operatorId: user.sub,
        action: 'RESTORE',
        resource: 'Tool',
        resourceId: request.params.id,
        request
      })
      return { success: true }
    }
  )

  app.post<{ Body: OptimizePromptBody }>(
    '/tools/optimize_prompt',
    {
      schema: {
        tags: ['tools'],
        summary: 'Optimize a raw prompt for teaching scenarios',
        body: {
          type: 'object',
          required: ['prompt'],
          properties: {
            prompt: { type: 'string', minLength: 1 },
            audience: { type: 'string' },
            context: { type: 'string' },
            outputFormat: { type: 'string' }
          }
        },
        response: {
          200: {
            type: 'object',
            properties: {
              optimizedPrompt: { type: 'string' },
              suggestions: { type: 'array', items: { type: 'string' } },
              tokensEstimated: { type: 'number' }
            }
          }
        }
      }
    },
    async (request) => {
      const { prompt, audience, context, outputFormat } = request.body
      const normalized = prompt.trim()

      const suggestions: string[] = []
      if (!normalized.toLowerCase().includes('step')) {
        suggestions.push('拆分步骤，便于模型逐条完成。')
      }
      if (!normalized.toLowerCase().includes('format')) {
        suggestions.push('声明输出格式，例如 Markdown/列表/JSON。')
      }
      if (!normalized.toLowerCase().includes('constraints') && !normalized.toLowerCase().includes('约束')) {
        suggestions.push('添加约束条件（字数、学段、学科、难度等）。')
      }

      const optimizedPrompt = [
        '你是一位资深的一线教师与教研员，请严格遵守以下要求输出内容。',
        audience ? `目标受众：${audience}` : null,
        context ? `教学背景：${context}` : null,
        '工作方式：',
        '- 先给出思考要点，再给出最终答案。',
        '- 保留关键信息，避免杜撰；必要时说明假设。',
        '- 输出前自检，确保格式与教学场景匹配。',
        '',
        '任务：',
        normalized,
        outputFormat ? `\n输出格式：${outputFormat}` : '\n输出格式：使用 Markdown，必要时包含公式（LaTeX）。'
      ]
        .filter(Boolean)
        .join('\n')

      return {
        optimizedPrompt,
        suggestions,
        tokensEstimated: Math.round(optimizedPrompt.length / 4) // 粗略估算
      }
    }
  )

  app.get(
    '/quota',
    {
      schema: {
        tags: ['tools'],
        summary: 'Get today quota usage (mock)',
        response: {
          200: {
            type: 'object',
            properties: {
              provider: { type: 'string' },
              limit: { type: 'number' },
              used: { type: 'number' },
              remaining: { type: 'number' },
              resetAt: { type: 'string' }
            }
          }
        }
      }
    },
    async () => {
      const limit = config.quota.dailyLimit
      const used = Math.floor(limit * 0.3)
      const resetAt = new Date()
      resetAt.setHours(23, 59, 59, 999)

      return {
        provider: config.llm.provider,
        limit,
        used,
        remaining: Math.max(limit - used, 0),
        resetAt: resetAt.toISOString()
      }
    }
  )
}
