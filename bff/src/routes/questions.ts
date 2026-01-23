import type { FastifyInstance } from 'fastify'
import prisma from '../utils/prisma'
import { getAssetForUser } from '../services/assets'
import { parseQuestionsFromText } from '../services/questionImport'
import { hasPermission, requirePermission } from '../utils/permissions'

interface QuestionBody {
  stem: string
  type: string
  options?: any
  answer?: any
  analysis?: string
  subject?: string
  grade?: string
  difficulty?: number
  knowledgePoints?: any
  attachments?: any
  sourceAssetId?: string | null
  status?: 'DRAFT' | 'PUBLISHED' | 'ARCHIVED'
}

export default async function registerQuestionRoutes(app: FastifyInstance) {
  const getTenant = (request: any) => (request.tenantId as string) || 'default'
  const isQuestionAdmin = (request: any) =>
    (request.user as any)?.role === 'ADMIN' || hasPermission(request.user, 'questions.manage_all')
  const isEditor = (request: any) => {
    const role = (request.user as any)?.role
    return role === 'ADMIN' || role === 'TEACHER' || hasPermission(request.user, 'questions.manage_all')
  }
  const adminOnly = requirePermission('questions.manage_all')

  const normalizeSourceAssetId = async (request: any, sourceAssetId?: string | null) => {
    if (sourceAssetId === undefined) return undefined
    if (sourceAssetId === null) return null
    const user = request.user as any
    const tenantId = getTenant(request)
    const normalized = sourceAssetId.toString().trim()
    if (!normalized) return null

    const asset = await getAssetForUser(normalized, tenantId, user?.sub ?? '', user?.role ?? '')
    if (!asset) {
      throw new Error('sourceAssetId 无效或无权限访问')
    }
    return normalized
  }

  // List questions
  app.get(
    '/questions',
    {
      preHandler: [app.authenticate],
      schema: {
        tags: ['questions'],
        summary: 'List questions',
        querystring: {
          type: 'object',
          properties: {
            page: { type: 'string' },
            pageSize: { type: 'string' },
            keyword: { type: 'string' },
            subject: { type: 'string' },
            grade: { type: 'string' },
            status: { type: 'string' },
            difficulty: { type: 'string' }
          }
        }
    }
  },
    async (request) => {
      const tenantId = getTenant(request)
      const { page = '1', pageSize = '20', keyword = '', subject, grade, status, difficulty } = request.query as any
      const pageNum = Math.max(parseInt(page, 10) || 1, 1)
      const sizeNum = Math.min(Math.max(parseInt(pageSize, 10) || 20, 1), 100)
      const where: any = { tenantId }
      if (keyword) {
        where.OR = [
          { stem: { contains: keyword } },
          { analysis: { contains: keyword } }
        ]
      }
      if (subject) where.subject = subject
      if (grade) where.grade = grade
      if (difficulty) where.difficulty = parseInt(difficulty, 10) || 0
      const user = request.user as any
      const isAdmin = isQuestionAdmin(request)
      if (status) {
        where.status = status
      } else if (!isAdmin) {
        where.OR = where.OR
          ? [...where.OR, { status: 'PUBLISHED' }, { createdBy: user?.sub ?? '' }]
          : [{ status: 'PUBLISHED' }, { createdBy: user?.sub ?? '' }]
      }

      const [total, items] = await prisma.$transaction([
        prisma.question.count({ where }),
        prisma.question.findMany({
          where,
          orderBy: { updatedAt: 'desc' },
          skip: (pageNum - 1) * sizeNum,
          take: sizeNum,
          select: {
            id: true,
            stem: true,
            type: true,
            subject: true,
            grade: true,
            difficulty: true,
            status: true,
            createdAt: true,
            updatedAt: true,
            createdBy: true
          }
        })
      ])

      return { items, total, page: pageNum, pageSize: sizeNum }
    }
  )

  // Detail
  app.get<{ Params: { id: string } }>(
    '/questions/:id',
    { preHandler: [app.authenticate] },
    async (request, reply) => {
      const tenantId = getTenant(request)
      const { id } = request.params
      const question = await prisma.question.findFirst({
        where: { id, tenantId }
      })
      if (!question) return reply.code(404).send({ message: 'Not found' })

      const user = request.user as any
      if (question.status !== 'PUBLISHED' && !isQuestionAdmin(request) && question.createdBy !== user?.sub) {
        return reply.code(403).send({ message: 'Forbidden' })
      }
      return question
    }
  )

  // Regenerate / clone a similar question (editor)
  app.post<{ Params: { id: string } }>(
    '/questions/:id/regenerate',
    { preHandler: [app.authenticate] },
    async (request, reply) => {
      const tenantId = getTenant(request)
      if (!isEditor(request)) {
        return reply.code(403).send({ message: 'Forbidden' })
      }

      const user = request.user as any
      const { id } = request.params
      const original = await prisma.question.findFirst({ where: { id, tenantId } })
      if (!original) return reply.code(404).send({ message: 'Not found' })

      if (original.status !== 'PUBLISHED' && !isQuestionAdmin(request) && original.createdBy !== user?.sub) {
        return reply.code(403).send({ message: 'Forbidden' })
      }

      const stem = original.stem?.trim()
        ? `${original.stem.trim()}（变式）`
        : '新题目（变式）'

      const created = await prisma.question.create({
        data: {
          tenantId,
          stem,
          type: original.type,
          options: original.options,
          answer: original.answer,
          analysis: original.analysis,
          subject: original.subject,
          grade: original.grade,
          difficulty: original.difficulty ?? 3,
          knowledgePoints: original.knowledgePoints,
          attachments: original.attachments,
          sourceAssetId: original.sourceAssetId,
          status: 'DRAFT',
          version: 1,
          createdBy: user?.sub,
          updatedBy: user?.sub
        },
        select: {
          id: true,
          stem: true,
          type: true,
          status: true,
          subject: true,
          grade: true,
          difficulty: true,
          createdAt: true
        }
      })

      await prisma.learningEvent
        .create({
          data: {
            tenantId,
            actorId: user?.sub ?? 'system',
            actorRole: user?.role ?? null,
            appCode: 'quiz-builder',
            action: 'question.regenerated',
            targetType: 'Question',
            targetId: created.id,
            payload: JSON.stringify({
              sourceQuestionId: original.id,
              sourceStatus: original.status
            })
          }
        })
        .catch(() => {})

      return created
    }
  )

  // Import from text/asset (editor)
  app.post<{ Body: { text?: string; assetId?: string; subject?: string; grade?: string; difficulty?: number; status?: 'DRAFT' | 'PUBLISHED' } }>(
    '/questions/import',
    { preHandler: [app.authenticate] },
    async (request, reply) => {
      const tenantId = getTenant(request)
      if (!isEditor(request)) {
        return reply.code(403).send({ message: 'Forbidden' })
      }

      const user = request.user as any
      const { text, assetId, subject, grade, difficulty, status } = request.body as any

      if (status === 'PUBLISHED' && !isQuestionAdmin(request)) {
        return reply.code(403).send({ message: '仅管理员可直接导入为已发布' })
      }

      let sourceText = (text ?? '').toString()
      let sourceAssetId: string | null = null

      if (assetId) {
        const asset = await getAssetForUser(assetId.toString(), tenantId, user?.sub ?? '', user?.role ?? '')
        if (!asset) return reply.code(404).send({ message: '资源不存在或无权限访问' })
        if (!asset.content) return reply.code(400).send({ message: '该资源没有可导入的文本内容（content 为空）' })
        sourceText = asset.content
        sourceAssetId = asset.id
      }

      if (!sourceText.trim()) {
        return reply.code(400).send({ message: 'text 或 assetId 至少提供一项' })
      }

      const parsed = parseQuestionsFromText(sourceText)
      if (parsed.length === 0) {
        return { created: 0, items: [] }
      }

      const created = await prisma.$transaction(
        parsed.map((q) =>
          prisma.question.create({
            data: {
              tenantId,
              stem: q.stem,
              type: q.type,
              options: q.options ? JSON.stringify(q.options) : null,
              answer: q.answer !== undefined ? JSON.stringify(q.answer) : null,
              analysis: q.analysis,
              subject,
              grade,
              difficulty: Number.isFinite(difficulty) ? difficulty : 3,
              status: status || 'DRAFT',
              version: 1,
              createdBy: user?.sub,
              updatedBy: user?.sub,
              sourceAssetId
            },
            select: {
              id: true,
              stem: true,
              type: true,
              status: true,
              createdAt: true
            }
          })
        )
      )

      return { created: created.length, items: created }
    }
  )

  // Create
  app.post<{ Body: QuestionBody }>(
    '/questions',
    { preHandler: [app.authenticate] },
    async (request, reply) => {
      const tenantId = getTenant(request)
      if (!isEditor(request)) {
        return reply.code(403).send({ message: 'Forbidden' })
      }
      const { stem, type, options, answer, analysis, subject, grade, difficulty, knowledgePoints, attachments, status, sourceAssetId } = request.body
      if (!stem || !type) {
        return reply.code(400).send({ message: 'stem and type are required' })
      }
      const user = request.user as any
      let normalizedSourceAssetId: string | null | undefined = undefined
      try {
        normalizedSourceAssetId = await normalizeSourceAssetId(request, sourceAssetId)
      } catch (e: any) {
        return reply.code(400).send({ message: e?.message ?? 'sourceAssetId 无效' })
      }
      const question = await prisma.question.create({
        data: {
          tenantId,
          stem,
          type,
          options: options ? JSON.stringify(options) : null,
          answer: answer ? JSON.stringify(answer) : null,
          analysis,
          subject,
          grade,
          difficulty: difficulty || 3,
          knowledgePoints: knowledgePoints ? JSON.stringify(knowledgePoints) : null,
          attachments: attachments ? JSON.stringify(attachments) : null,
          status: status || 'DRAFT',
          version: 1,
          createdBy: user?.sub,
          updatedBy: user?.sub,
          sourceAssetId: normalizedSourceAssetId ?? null
        }
      })
      return question
    }
  )

  // Update
  app.put<{ Params: { id: string }; Body: QuestionBody }>(
    '/questions/:id',
    { preHandler: [app.authenticate] },
    async (request, reply) => {
      const tenantId = getTenant(request)
      if (!isEditor(request)) return reply.code(403).send({ message: 'Forbidden' })
      const { id } = request.params
      const user = request.user as any
      const existing = await prisma.question.findUnique({ where: { id } })
      if (!existing) return reply.code(404).send({ message: 'Not found' })
      if (existing.tenantId !== tenantId) return reply.code(404).send({ message: 'Not found' })
      const isAdmin = isQuestionAdmin(request)
      if (!isAdmin && existing.createdBy && existing.createdBy !== user?.sub) {
        return reply.code(403).send({ message: 'Forbidden' })
      }

      const payload: any = { updatedBy: user?.sub }
      const body = request.body
      if (body.stem) payload.stem = body.stem
      if (body.type) payload.type = body.type
      if (body.analysis !== undefined) payload.analysis = body.analysis
      if (body.subject !== undefined) payload.subject = body.subject
      if (body.grade !== undefined) payload.grade = body.grade
      if (body.difficulty !== undefined) payload.difficulty = body.difficulty
      if (body.status) payload.status = body.status
      if (body.options !== undefined) payload.options = JSON.stringify(body.options)
      if (body.answer !== undefined) payload.answer = JSON.stringify(body.answer)
      if (body.knowledgePoints !== undefined) payload.knowledgePoints = JSON.stringify(body.knowledgePoints)
      if (body.attachments !== undefined) payload.attachments = JSON.stringify(body.attachments)
      if (body.sourceAssetId !== undefined) {
        try {
          payload.sourceAssetId = await normalizeSourceAssetId(request, body.sourceAssetId)
        } catch (e: any) {
          return reply.code(400).send({ message: e?.message ?? 'sourceAssetId 无效' })
        }
      }

      const question = await prisma.question.update({
        where: { id },
        data: payload
      })
      return question
    }
  )

  // Publish (admin)
  app.post<{ Params: { id: string } }>(
    '/questions/:id/publish',
    { preHandler: [app.authenticate, adminOnly] },
    async (request, reply) => {
      const tenantId = getTenant(request)
      const { id } = request.params
      const existing = await prisma.question.findUnique({ where: { id } })
      if (!existing || existing.tenantId !== tenantId) {
        return reply.code(404).send({ message: 'Not found' })
      }
      const question = await prisma.question.update({
        where: { id },
        data: { status: 'PUBLISHED', version: { increment: 1 } }
      })
      return question
    }
  )

  // Archive (admin)
  app.delete<{ Params: { id: string } }>(
    '/questions/:id',
    { preHandler: [app.authenticate, adminOnly] },
    async (request, reply) => {
      const tenantId = getTenant(request)
      const { id } = request.params
      const existing = await prisma.question.findUnique({ where: { id } })
      if (!existing || existing.tenantId !== tenantId) {
        return reply.code(404).send({ message: 'Not found' })
      }
      await prisma.question.update({
        where: { id },
        data: { status: 'ARCHIVED' }
      })
      return { success: true }
    }
  )

  // Export CSV (admin)
  app.get(
    '/questions/export',
    { preHandler: [app.authenticate, adminOnly] },
    async (_request, reply) => {
      const tenantId = getTenant(_request)
      const rows = await prisma.question.findMany({
        where: { tenantId },
        orderBy: [{ subject: 'asc' }, { grade: 'asc' }, { createdAt: 'desc' }]
      })
      const header = 'id,subject,grade,type,difficulty,status,stem\n'
      const body = rows.map((q) => [
        q.id,
        q.subject ?? '',
        q.grade ?? '',
        q.type,
        q.difficulty,
        q.status,
        escapeCSV(q.stem)
      ].join(',')).join('\n')
      reply.header('Content-Type', 'text/csv; charset=utf-8')
      reply.send(header + body)
    }
  )
}

function escapeCSV(value: string) {
  if (!value) return ''
  if (value.includes(',') || value.includes('"')) {
    return `"${value.replace(/"/g, '""')}"`
  }
  return value
}
