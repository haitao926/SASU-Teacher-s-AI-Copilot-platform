import type { FastifyInstance } from 'fastify'

interface ChatQuery {
  prompt?: string
  scenario?: string
}

function buildTemplate(prompt: string, scenario?: string) {
  if (scenario === 'lesson-plan') {
    return `请作为一名资深教师，围绕以下课题输出教案大纲（包含教学目标、重难点、活动设计、作业与评价）：

${prompt || '示例课题：分式的乘除法'}

要求：
- 用 Markdown 分节
- 每个环节给出时间分配与板书要点
- 预估学生易错点并给出针对性提示`
  }

  return prompt || '请告诉我本节课的教学目标与设计思路。'
}

export default async function registerChatRoutes(app: FastifyInstance) {
  app.get(
    '/stream/chat',
    {
      preHandler: app.authenticate,
      schema: {
        tags: ['chat'],
        summary: 'Stream chat responses (mock)',
        querystring: {
          type: 'object',
          properties: {
            prompt: { type: 'string' },
            scenario: { type: 'string' }
          }
        }
      }
    },
    async (request, reply) => {
      reply.raw.writeHead(200, {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        Connection: 'keep-alive'
      })

      const { prompt = '', scenario } = request.query as ChatQuery
      const content = buildTemplate(prompt, scenario)

      const chunks = [
        '好的，我来帮你梳理教学要点。',
        '首先明确教学目标与学情假设……',
        '接着设计导入、讲解、练习、巩固与作业环节……',
        '最后输出完整的 Markdown 结构化结果。'
      ]

      const send = (event: string, data: unknown) => {
        reply.raw.write(`event: ${event}\n`)
        reply.raw.write(`data: ${JSON.stringify(data)}\n\n`)
      }

      send('message', { role: 'assistant', delta: `【场景】${scenario ?? '通用'}\n${content}` })

      let idx = 0
      const interval = setInterval(() => {
        if (idx >= chunks.length) {
          send('end', { status: 'done' })
          clearInterval(interval)
          reply.raw.end()
          return
        }
        send('message', { role: 'assistant', delta: chunks[idx] })
        idx += 1
      }, 500)

      request.raw.on('close', () => {
        clearInterval(interval)
        reply.raw.end()
      })

      return reply
    }
  )
}
