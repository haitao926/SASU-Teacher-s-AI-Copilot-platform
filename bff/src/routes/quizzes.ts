import type { FastifyInstance } from 'fastify'
import { generateQuizMarkdown } from '../services/quizzes'

export default async function registerQuizRoutes(app: FastifyInstance) {
  app.post('/quizzes/generate', {
    preHandler: [app.authenticate],
    schema: {
      tags: ['quizzes'],
      summary: 'Generate quiz markdown (mock)',
      security: [{ bearerAuth: [] }],
      body: {
        type: 'object',
        properties: {
          topic: { type: 'string' },
          knowledgePoints: { type: 'string' },
          difficulty: { type: 'string' }
        }
      }
    }
  }, async (request) => {
    const body = request.body as any
    return generateQuizMarkdown({
      topic: body.topic,
      knowledgePoints: body.knowledgePoints,
      difficulty: body.difficulty
    })
  })
}
