import { FastifyPluginAsync } from 'fastify'
import {
  importScores,
  getScoreStats,
  ScoreUploadItem,
  listStudents,
  listExams,
  listScores,
  getScoreSummary,
  getStudentTrend,
  getScoresForExport
} from '../../services/academic/scores'
import { getTenantId } from '../../utils/tenant'
import { FastifyReply } from 'fastify'
import PDFDocument from 'pdfkit'

const scoresRoutes: FastifyPluginAsync = async (fastify, opts) => {
  // 1. 上传成绩 (带审计)
  fastify.post<{ Body: { data: ScoreUploadItem[] } }>('/upload', {
    preHandler: [fastify.authenticate]
  }, async (request, reply) => {
    const user = request.user as { sub: string }
    const operatorId = user?.sub || 'system'
    const ip = request.ip
    const tenantId = getTenantId(request.headers)
    const items = request.body.data
    
    try {
      const result = await importScores(items, tenantId, operatorId, ip, request.headers['user-agent'])
      return { success: true, count: result, message: `Successfully imported ${result} scores.` }

    } catch (error) {
      request.log.error(error)
      return reply.code(500).send({ message: (error as Error).message || 'Internal Server Error during import' })
    }
  })

  // 2. 获取统计概览 (Dashboard)
  fastify.get('/stats', { preHandler: [fastify.authenticate] }, async (request) => {
    const user = request.user as { sub: string }
    const tenantId = getTenantId(request.headers)
    return getScoreStats(tenantId, user.sub)
  })

  // 3. 学生列表
  fastify.get('/students', {
    preHandler: [fastify.authenticate],
    schema: {
      querystring: {
        type: 'object',
        properties: {
          class: { type: 'string' }
        }
      }
    }
  }, async (request) => {
    const tenantId = getTenantId(request.headers)
    return listStudents(tenantId, (request.query as any).class)
  })

  // 4. 考试列表
  fastify.get('/exams', {
    preHandler: [fastify.authenticate]
  }, async (request) => {
    const tenantId = getTenantId(request.headers)
    return listExams(tenantId)
  })

  // 5. 成绩列表（分页/筛选）
  fastify.get('/scores', {
    preHandler: [fastify.authenticate],
    schema: {
      querystring: {
        type: 'object',
        properties: {
          examId: { type: 'string' },
          class: { type: 'string' },
          subject: { type: 'string' },
          limit: { type: 'number', minimum: 1, maximum: 200 },
          offset: { type: 'number', minimum: 0 }
        }
      }
    }
  }, async (request) => {
    const tenantId = getTenantId(request.headers)
    const q = request.query as any
    return listScores({
      tenantId,
      examId: q.examId,
      className: q.class,
      subject: q.subject,
      limit: q.limit,
      offset: q.offset
    })
  })

  // 6. 班级/考试概览
  fastify.get('/scores/summary', {
    preHandler: [fastify.authenticate],
    schema: {
      querystring: {
        type: 'object',
        properties: {
          examId: { type: 'string' },
          class: { type: 'string' }
        }
      }
    }
  }, async (request, reply) => {
    const tenantId = getTenantId(request.headers)
    const q = request.query as any
    if (!q.examId) {
      return reply.code(400).send({ message: 'examId is required' })
    }
    return getScoreSummary({
      tenantId,
      examId: q.examId,
      className: q.class
    })
  })

  // 7. 学生成绩趋势
  fastify.get('/scores/trend/:studentId', {
    preHandler: [fastify.authenticate]
  }, async (request, reply) => {
    const tenantId = getTenantId(request.headers)
    const { studentId } = request.params as any
    if (!studentId) {
      return reply.code(400).send({ message: 'studentId is required' })
    }
    return getStudentTrend(tenantId, studentId)
  })

  // 8. 成绩导出 (CSV)
  fastify.get('/scores/export', {
    preHandler: [fastify.authenticate],
    schema: {
      querystring: {
        type: 'object',
        properties: {
          examId: { type: 'string' },
          class: { type: 'string' },
          format: { type: 'string', enum: ['csv', 'pdf'] }
        },
        required: ['examId']
      }
    }
  }, async (request, reply: FastifyReply) => {
    const tenantId = getTenantId(request.headers)
    const q = request.query as any
    const rows = await getScoresForExport({
      tenantId,
      examId: q.examId,
      className: q.class
    })

    if ((q.format || 'csv') === 'pdf') {
      const doc = new PDFDocument({ size: 'A4', margin: 40 })
      const chunks: Buffer[] = []
      doc.on('data', (c: Buffer) => chunks.push(c))
      doc.on('end', () => {
        const pdfBuffer = Buffer.concat(chunks)
        reply
          .header('Content-Type', 'application/pdf')
          .header('Content-Disposition', `attachment; filename="scores_${q.examId}.pdf"`)
          .send(pdfBuffer)
      })

      doc.fontSize(16).text('考试成绩表', { align: 'center' })
      doc.moveDown()
      doc.fontSize(10)
      doc.text(`考试ID: ${q.examId}`)
      if (q.class) doc.text(`班级: ${q.class}`)
      doc.moveDown()

      const header = ['考试', '班级', '学号', '姓名', '科目', '成绩']
      const colWidths = [80, 60, 70, 80, 80, 50]
      doc.font('Helvetica-Bold')
      header.forEach((h, i) => doc.text(h, { continued: i < header.length - 1, width: colWidths[i] }))
      doc.text('')
      doc.font('Helvetica')
      rows.forEach((r) => {
        const data = [r.examName, r.class, r.studentId, r.studentName, r.subject, String(r.score ?? '')]
        data.forEach((val, i) => doc.text(String(val ?? ''), { continued: i < data.length - 1, width: colWidths[i] }))
        doc.text('')
      })
      doc.end()
    } else {
      const header = ['考试', '班级', '学号', '姓名', '科目', '成绩']
      const lines = [
        header.join(','),
        ...rows.map((r) => [
          r.examName,
          r.class,
          r.studentId,
          r.studentName,
          r.subject,
          r.score
        ].map((v) => `"${String(v ?? '').replace(/"/g, '""')}"`).join(','))
      ]
      const csv = lines.join('\n')
      reply
        .header('Content-Type', 'text/csv; charset=utf-8')
        .header('Content-Disposition', `attachment; filename="scores_${q.examId}.csv"`)
        .send(csv)
    }
  })
}

export default scoresRoutes
