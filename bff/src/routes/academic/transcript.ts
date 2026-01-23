import { FastifyPluginAsync } from 'fastify'
import { searchStudents, generateTranscriptPDF, generateTranscriptExcel, getStudentScores, listExams, deleteExam } from '../../services/academic/transcript'
import { importExamScores } from '../../services/academic/importService'

const transcriptRoutes: FastifyPluginAsync = async (fastify, opts) => {
  
  // 1. Search Students
  fastify.get('/students', {
    preHandler: [fastify.authenticate],
    schema: {
      querystring: {
        type: 'object',
        properties: {
          q: { type: 'string' }
        },
        required: ['q']
      }
    }
  }, async (request) => {
    const tenantId = request.tenantId ?? 'default'
    const { q } = request.query as { q: string }
    return searchStudents(tenantId, q)
  })

  // 1.5 List Exams (Management)
  fastify.get('/exams', {
    preHandler: [fastify.authenticate]
  }, async (request) => {
    const tenantId = request.tenantId ?? 'default'
    return listExams(tenantId)
  })

  fastify.delete('/exams/:examId', {
    preHandler: [fastify.authenticate]
  }, async (request, reply) => {
    const tenantId = request.tenantId ?? 'default'
    const { examId } = request.params as { examId: string }
    try {
      await deleteExam(tenantId, examId)
      return { success: true }
    } catch (e: any) {
      reply.code(400).send({ success: false, message: e.message })
    }
  })

  // 2. Get Student Scores (History)
  fastify.get('/students/:studentId/scores', {
    preHandler: [fastify.authenticate]
  }, async (request) => {
    const tenantId = request.tenantId ?? 'default'
    const { studentId } = request.params as { studentId: string }
    return getStudentScores(tenantId, studentId)
  })

  // 3. Export PDF/Excel (Support multiple exams)
  fastify.get('/export/:studentId', {
    preHandler: [fastify.authenticate],
    schema: {
      querystring: {
        type: 'object',
        properties: {
          examIds: { type: 'string' }, // Comma separated IDs
          options: { type: 'string' }, // JSON string
          format: { type: 'string', enum: ['pdf', 'excel'] }
        }
      }
    }
  }, async (request, reply) => {
    const tenantId = request.tenantId ?? 'default'
    const { studentId } = request.params as { studentId: string }
    const { examIds, options, format } = request.query as { examIds: string, options?: string, format?: string }
    
    const idList = examIds ? examIds.split(',').filter(Boolean) : undefined
    let parsedOptions
    if (options) {
      try {
        parsedOptions = JSON.parse(options)
      } catch (e) {
        // ignore invalid json
      }
    }

    try {
      let buffer: Buffer
      let contentType = 'application/pdf'
      let ext = 'pdf'

      if (format === 'excel') {
         buffer = await generateTranscriptExcel(tenantId, studentId, idList, parsedOptions)
         contentType = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
         ext = 'xlsx'
      } else {
         buffer = await generateTranscriptPDF(tenantId, studentId, idList, parsedOptions)
      }
      
      reply.header('Content-Type', contentType)
      reply.header('Content-Disposition', `attachment; filename="transcript_${studentId}.${ext}"`)
      reply.send(buffer)
    } catch (error) {
      request.log.error(error)
      reply.code(404).send({ message: (error as Error).message })
    }
  })

  // 4. Import Scores
  fastify.post('/import', {
    preHandler: [fastify.authenticate]
  }, async (request, reply) => {
    try {
      const tenantId = request.tenantId ?? 'default'
      const { examName, date } = request.query as { examName?: string; date?: string }

      if (!examName) {
        return reply.code(400).send({ success: false, message: 'examName is required' })
      }
      if (!date) {
        return reply.code(400).send({ success: false, message: 'date is required' })
      }

      const examDate = new Date(date)
      if (Number.isNaN(examDate.getTime())) {
        return reply.code(400).send({ success: false, message: 'date is invalid' })
      }

      const data = await request.file()
      if (!data) {
        return reply.code(400).send({ success: false, message: 'file is required' })
      }

      const buffer = await data.toBuffer()
      const result = await importExamScores(
        tenantId,
        examName,
        examDate,
        buffer,
        data.filename || 'upload'
      )
      return { success: true, ...result }
    } catch (e: any) {
      console.error('--- IMPORT ERROR FULL DUMP ---')
      console.error(e)
      if (e.code) console.error('Code:', e.code)
      if (e.stack) console.error('Stack:', e.stack)
      
      request.log.error(e)
      // Return 200 to ensure frontend receives the JSON payload without browser/proxy interference
      return reply.code(200).send({ 
        success: false,
        message: `Import processing failed: ${e.message}`,
        debug: e.stack 
      })
    }
  })
}

export default transcriptRoutes