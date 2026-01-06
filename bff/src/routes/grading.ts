import type { FastifyInstance } from 'fastify'
import { getTenantId } from '../utils/tenant'
import {
  createAssignment,
  listAssignments,
  addAnswerKeys,
  createSubmission,
  listSubmissions,
  exportGradingCsv
} from '../services/grading'

type AuthUser = { sub: string }

export default async function registerGradingRoutes(app: FastifyInstance) {
  // 创建作业/试卷
  app.post('/grading/assignments', {
    preHandler: [app.authenticate],
    schema: {
      tags: ['grading'],
      summary: 'Create assignment',
      security: [{ bearerAuth: [] }],
      body: {
        type: 'object',
        required: ['name', 'subject'],
        properties: {
          name: { type: 'string' },
          subject: { type: 'string' },
          description: { type: 'string' },
          totalPoints: { type: 'number' }
        }
      }
    }
  }, async (request, reply) => {
    const tenantId = getTenantId(request.headers)
    const body = request.body as any
    const assignment = await createAssignment({
      tenantId,
      name: body.name,
      subject: body.subject,
      description: body.description,
      totalPoints: body.totalPoints
    })
    return assignment
  })

  // 列表
  app.get('/grading/assignments', {
    preHandler: [app.authenticate],
    schema: { tags: ['grading'], summary: 'List assignments', security: [{ bearerAuth: [] }] }
  }, async (request) => {
    const tenantId = getTenantId(request.headers)
    return listAssignments(tenantId)
  })

  // 上传标准答案
  app.post('/grading/answer-keys', {
    preHandler: [app.authenticate],
    schema: {
      tags: ['grading'],
      summary: 'Upload answer keys',
      security: [{ bearerAuth: [] }],
      body: {
        type: 'object',
        required: ['assignmentId', 'items'],
        properties: {
          assignmentId: { type: 'string' },
          items: {
            type: 'array',
            items: {
              type: 'object',
              required: ['questionId', 'questionType', 'points'],
              properties: {
                questionId: { type: 'string' },
                questionType: { type: 'string' },
                content: {},
                points: { type: 'number' }
              }
            }
          }
        }
      }
    }
  }, async (request, reply) => {
    const tenantId = getTenantId(request.headers)
    const body = request.body as any
    const items = (body.items || []).map((i: any) => ({
      tenantId,
      assignmentId: body.assignmentId,
      questionId: i.questionId,
      questionType: i.questionType,
      content: i.content,
      points: i.points
    }))
    if (items.length === 0) {
      return reply.code(400).send({ message: 'no items provided' })
    }
    await addAnswerKeys(items)
    return { success: true }
  })

  // 提交答卷（简化：直接携带答案，立即判分客观题）
  app.post('/grading/submissions', {
    preHandler: [app.authenticate],
    schema: {
      tags: ['grading'],
      summary: 'Submit paper for grading',
      security: [{ bearerAuth: [] }],
      body: {
        type: 'object',
        required: ['assignmentId', 'studentId'],
        properties: {
          assignmentId: { type: 'string' },
          studentId: { type: 'string' },
          payloadUrl: { type: 'string' },
          answers: {
            type: 'array',
            items: {
              type: 'object',
              required: ['questionId'],
              properties: {
                questionId: { type: 'string' },
                answer: {}
              }
            }
          }
        }
      }
    }
  }, async (request) => {
    const tenantId = getTenantId(request.headers)
    const body = request.body as any
    return createSubmission({
      tenantId,
      assignmentId: body.assignmentId,
      studentId: body.studentId,
      payloadUrl: body.payloadUrl,
      answers: body.answers
    })
  })

  // 列出提交
  app.get('/grading/submissions', {
    preHandler: [app.authenticate],
    schema: {
      tags: ['grading'],
      summary: 'List submissions',
      security: [{ bearerAuth: [] }],
      querystring: {
        type: 'object',
        properties: {
          assignmentId: { type: 'string' }
        }
      }
    }
  }, async (request) => {
    const tenantId = getTenantId(request.headers)
    const q = request.query as any
    return listSubmissions(tenantId, q.assignmentId)
  })

  // 导出成绩（CSV）
  app.get('/grading/export', {
    preHandler: [app.authenticate],
    schema: {
      tags: ['grading'],
      summary: 'Export grading CSV',
      security: [{ bearerAuth: [] }],
      querystring: {
        type: 'object',
        required: ['assignmentId'],
        properties: {
          assignmentId: { type: 'string' }
        }
      }
    }
  }, async (request, reply) => {
    const tenantId = getTenantId(request.headers)
    const q = request.query as any
    const csv = await exportGradingCsv(tenantId, q.assignmentId)
    reply
      .header('Content-Type', 'text/csv; charset=utf-8')
      .header('Content-Disposition', `attachment; filename="grading_${q.assignmentId}.csv"`)
      .send(csv)
  })
}
