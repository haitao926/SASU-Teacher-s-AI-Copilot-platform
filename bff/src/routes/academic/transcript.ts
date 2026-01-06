
import { FastifyPluginAsync } from 'fastify'
import { getTenantId } from '../../utils/tenant'
import { searchStudents, generateTranscriptPDF } from '../../services/academic/transcript'
import { listExams } from '../../services/academic/scores'

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
    const tenantId = getTenantId(request.headers)
    const { q } = request.query as { q: string }
    return searchStudents(tenantId, q)
  })

  // 2. List Exams (Reuse service)
  fastify.get('/exams', {
    preHandler: [fastify.authenticate]
  }, async (request) => {
    const tenantId = getTenantId(request.headers)
    return listExams(tenantId)
  })

  // 3. Export PDF
  fastify.get('/export/:studentId', {
    preHandler: [fastify.authenticate],
    schema: {
      querystring: {
        type: 'object',
        properties: {
          examId: { type: 'string' }
        }
      }
    }
  }, async (request, reply) => {
    const tenantId = getTenantId(request.headers)
    const { studentId } = request.params as { studentId: string }
    const { examId } = request.query as { examId: string }

    try {
      const doc = await generateTranscriptPDF(tenantId, studentId, examId)
      
      reply.header('Content-Type', 'application/pdf')
      reply.header('Content-Disposition', `attachment; filename="transcript_${studentId}.pdf"`)
      reply.send(doc)
    } catch (error) {
      request.log.error(error)
      reply.code(404).send({ message: (error as Error).message })
    }
  })
}

export default transcriptRoutes
