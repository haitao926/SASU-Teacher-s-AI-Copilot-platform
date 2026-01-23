import type { FastifyInstance } from 'fastify'
import {
  createAssignment,
  listAssignments,
  addAnswerKeys,
  createSubmission,
  listSubmissions,
  exportGradingCsv
} from '../services/grading'
import { gradeImage } from '../services/aiGrading'
import { gradePaper } from '../services/paperGrading.service'

type AuthUser = { sub: string }

export default async function registerGradingRoutes(app: FastifyInstance) {
  // 新版：智能阅卷 - 整页批改
  app.post('/grading/grade-paper', {
    preHandler: [app.authenticate],
    schema: {
      tags: ['grading'],
      summary: 'Grade a full paper using the bbox-based workflow',
      security: [{ bearerAuth: [] }],
      body: {
        type: 'object',
        required: ['imageBase64'],
        properties: {
          imageBase64: { type: 'string', description: 'Base64 encoded image of the full paper' },
        }
      }
    }
  }, async (request) => {
    const body = request.body as { imageBase64: string }
    // This new service orchestrates the MinerU -> Bbox Attribution -> Grading flow
    return gradePaper(body.imageBase64)
  })

  // 旧版：智能阅卷 - 单题图片批改
  app.post('/grading/grade-image', {
    preHandler: [app.authenticate],
    schema: {
      tags: ['grading'],
      summary: 'Grade a single question image using AI',
      security: [{ bearerAuth: [] }],
      body: {
        type: 'object',
        required: ['imageBase64'],
        properties: {
          imageBase64: { type: 'string', description: 'Base64 encoded image' },
          questionText: { type: 'string' },
          correctAnswer: { type: 'string' },
          maxPoints: { type: 'number' },
          ocrText: { type: 'string' }
        }
      }
    }
  }, async (request) => {
    const body = request.body as any
    return gradeImage({
      imageBase64: body.imageBase64,
      questionText: body.questionText,
      correctAnswer: body.correctAnswer,
      maxPoints: body.maxPoints,
      ocrText: body.ocrText
    })
  })

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
    const tenantId = request.tenantId ?? 'default'
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
    const tenantId = request.tenantId ?? 'default'
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
    const tenantId = request.tenantId ?? 'default'
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
          grading: {
            type: 'object',
            properties: {
              objectiveScore: { type: 'number' },
              subjectiveScore: { type: 'number' },
              totalScore: { type: 'number' },
              details: {},
              publishToScores: { type: 'boolean' }
            }
          },
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
    const tenantId = request.tenantId ?? 'default'
    const body = request.body as any
    const user = request.user as any
    return createSubmission({
      tenantId,
      assignmentId: body.assignmentId,
      studentId: body.studentId,
      payloadUrl: body.payloadUrl,
      answers: body.answers,
      grading: body.grading,
      actorId: user?.sub,
      actorRole: user?.role,
      appCode: 'quiz-grading'
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
    const tenantId = request.tenantId ?? 'default'
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
    const tenantId = request.tenantId ?? 'default'
    const q = request.query as any
    const csv = await exportGradingCsv(tenantId, q.assignmentId)
    reply
      .header('Content-Type', 'text/csv; charset=utf-8')
      .header('Content-Disposition', `attachment; filename="grading_${q.assignmentId}.csv"`)
      .send(csv)
  })
}
