import { randomUUID } from 'crypto'
import type { FastifyInstance } from 'fastify'
import AdmZip from 'adm-zip'
import config from '../config'
import {
  applyUploadUrl,
  createTask,
  generateDataId,
  getTaskState,
  mineruEnabled,
  toBuffer,
  uploadToSignedUrl
} from '../services/mineru'
import {
  createOcrTask,
  getOcrTask,
  listOcrTasksByUser,
  updateOcrTask
} from '../services/ocrTasks'

interface UploadBody {
  fileName: string
  contentBase64: string
  mimeType?: string
}

interface OcrTask {
  id: string
  fileName: string
  status: 'queued' | 'processing' | 'done' | 'error'
  progress: number
  result?: string
  fullZipUrl?: string
  zipUrl?: string
  error?: string
  traceId?: string
  source: 'mock' | 'mineru'
}

const mockTasks = new Map<string, OcrTask>()

function createMockResult(fileName: string) {
  return `# 解析结果 - ${fileName}

> 以下为 MinerU 模拟结果。接入真实服务后将自动替换。

## 1. 公式示例
$E = mc^2$

## 2. 列表示例
- 题目：已知直角三角形 ABC，求角 A。
- 解题思路：使用正弦定理，结合已知边长推导角度。

## 3. 表格示例
| 章节 | 知识点 | 备注 |
| ---- | ------ | ---- |
| 1    | 函数概念 | 需强化练习 |
| 2    | 导数应用 | 关注题型多样性 |
`
}

function scheduleMockProgress(taskId: string) {
  let progress = 10
  const timer = setInterval(() => {
    progress += 20
    const task = mockTasks.get(taskId)
    if (!task) {
      clearInterval(timer)
      return
    }
    task.progress = Math.min(progress, 100)
    task.status = task.progress >= 100 ? 'done' : 'processing'
    if (task.status === 'done') {
      task.result = task.result ?? createMockResult(task.fileName)
      clearInterval(timer)
    }
  }, 700)
}

export default async function registerOcrRoutes(app: FastifyInstance) {
  app.post<{ Body: UploadBody }>(
    '/ocr/upload',
    {
      preHandler: app.authenticate,
      schema: {
        tags: ['ocr'],
        summary: 'Upload a document for OCR parsing',
        security: [{ bearerAuth: [] }],
        body: {
          type: 'object',
          required: ['fileName', 'contentBase64'],
          properties: {
            fileName: { type: 'string' },
            contentBase64: { type: 'string' },
            mimeType: { type: 'string' }
          }
        }
      }
    },
    async (request, reply) => {
      const { fileName, contentBase64 } = request.body
      const user = request.user as Record<string, any> | undefined
      const userId = (user?.sub as string) || 'anonymous'

      if (!contentBase64 || contentBase64.length < 16) {
        return reply.code(400).send({ message: 'Invalid file payload' })
      }

      // If MinerU is not configured, fall back to mock
      if (!mineruEnabled()) {
        const taskId = randomUUID()
        const task: OcrTask = {
          id: taskId,
          fileName,
          status: 'queued',
          progress: 0,
          source: 'mock'
        }
        mockTasks.set(taskId, task)
        scheduleMockProgress(taskId)
        await createOcrTask({
          id: taskId,
          userId,
          fileName,
          status: 'queued',
          source: 'mock'
        })

        reply.code(202)
        return { taskId, status: task.status, source: task.source }
      }

      // --- MinerU real flow (v4/file-urls/batch -> PUT upload -> extract/task) ---
      try {
        const dataId = generateDataId()
        const uploadInfo = await applyUploadUrl(fileName, dataId)
        await uploadToSignedUrl(uploadInfo.uploadUrl, toBuffer(contentBase64))
        const taskInfo = await createTask(uploadInfo.uploadUrl, dataId)
        const taskId = taskInfo.taskId
        await createOcrTask({
          id: taskId,
          userId,
          fileName,
          status: 'processing',
          source: 'mineru'
        })
        return {
          taskId,
          status: 'processing',
          source: 'mineru',
          requestId: taskInfo.traceId ?? uploadInfo.traceId
        }
      } catch (err: any) {
        request.log.error({ err }, 'mineru upload/parse failed')
        return reply.code(500).send({ message: err?.message ?? 'MinerU 调用失败' })
      }
    }
  )

  app.get<{ Params: { id: string }, Querystring: { format: 'docx' | 'pdf' } }>(
    '/ocr/export/:id',
    {
      preHandler: app.authenticate,
      schema: {
        tags: ['ocr'],
        summary: 'Export OCR result as Word or PDF',
        security: [{ bearerAuth: [] }],
        params: {
          type: 'object',
          properties: {
            id: { type: 'string' }
          }
        },
        querystring: {
          type: 'object',
          properties: {
            format: { type: 'string', enum: ['docx', 'pdf'] }
          },
          required: ['format']
        }
      }
    },
    async (request, reply) => {
      const { id } = request.params
      const { format } = request.query

      let fullZipUrl: string | undefined
      if (mineruEnabled()) {
        const task = await getOcrTask(id)
        fullZipUrl = task?.fullZipUrl ?? undefined
        if (!fullZipUrl) {
          try {
            const state = await getTaskState(id)
            fullZipUrl = state.fullZipUrl
          } catch (e) {}
        }
      } else {
        return reply.code(501).send({ message: 'Export not supported in Mock mode yet' })
      }

      if (!fullZipUrl) {
        return reply.code(404).send({ message: 'Result file not found' })
      }

      try {
        const zipRes = await fetch(fullZipUrl)
        if (!zipRes.ok) throw new Error('Failed to download ZIP from storage')
        const arrayBuffer = await zipRes.arrayBuffer()
        const buffer = Buffer.from(arrayBuffer)

        const zip = new AdmZip(buffer)
        const zipEntries = zip.getEntries()

        const ext = format === 'pdf' ? '.pdf' : '.docx'
        const entry = zipEntries.find((e: any) => e.entryName.toLowerCase().endsWith(ext) && !e.isDirectory)

        if (!entry) {
          return reply.code(404).send({ message: `No ${format.toUpperCase()} file found in the result` })
        }

        const fileData = entry.getData()
        const filename = entry.name
        
        reply.header('Content-Disposition', `attachment; filename="${filename}"`)
        reply.header('Content-Type', format === 'pdf' ? 'application/pdf' : 'application/vnd.openxmlformats-officedocument.wordprocessingml.document')
        return reply.send(fileData)

      } catch (e: any) {
        request.log.error(e)
        return reply.code(500).send({ message: 'Failed to process export: ' + e.message })
      }
    }
  )

  app.get<{ Params: { id: string } }>(
    '/ocr/status/:id',
    {
      preHandler: app.authenticate,
      schema: {
        tags: ['ocr'],
        summary: 'Check OCR processing status',
        security: [{ bearerAuth: [] }],
        params: {
          type: 'object',
          properties: {
            id: { type: 'string' }
          }
        }
      }
    },
    async (request, reply) => {
      const { id } = request.params

      // MinerU
      if (mineruEnabled()) {
        try {
          const state = await getTaskState(id)
          await updateOcrTask({
            id,
            status: state.status,
            fullZipUrl: state.fullZipUrl ?? undefined
          }).catch(() => {})
          return state
        } catch (err: any) {
          request.log.error({ err }, 'mineru status failed')
          return reply.code(500).send({ message: err?.message ?? 'MinerU 查询失败' })
        }
      }

      // Mock
      const task = mockTasks.get(id)
      if (!task) {
        return reply.code(404).send({ message: 'Task not found' })
      }

      if (task.status === 'done') {
        await updateOcrTask({
          id: task.id,
          status: 'done',
          result: task.result ?? undefined
        }).catch(() => {})
      }

      return {
        taskId: task.id,
        status: task.status,
        progress: task.progress
      }
    }
  )

  app.get<{ Params: { id: string } }>(
    '/ocr/result/:id',
    {
      preHandler: app.authenticate,
      schema: {
        tags: ['ocr'],
        summary: 'Fetch OCR result once processing is done',
        security: [{ bearerAuth: [] }],
        params: {
          type: 'object',
          properties: {
            id: { type: 'string' }
          }
        }
      }
    },
    async (request, reply) => {
      const { id } = request.params

      if (mineruEnabled()) {
        try {
          const state = await getTaskState(id)
          if (state.status !== 'done') {
            return reply.code(202).send(state)
          }
          await updateOcrTask({
            id: state.taskId,
            status: state.status,
            fullZipUrl: state.fullZipUrl ?? undefined
          }).catch(() => {})
          return {
            taskId: state.taskId,
            status: state.status,
            fullZipUrl: state.fullZipUrl,
            error: state.error
          }
        } catch (err: any) {
          request.log.error({ err }, 'mineru result failed')
          return reply.code(500).send({ message: err?.message ?? 'MinerU 查询失败' })
        }
      }

      const task = mockTasks.get(id)
      if (!task) {
        return reply.code(404).send({ message: 'Task not found' })
      }

      if (task.status !== 'done') {
        return reply.code(202).send({
          taskId: task.id,
          status: task.status,
          progress: task.progress
        })
      }

      return {
        taskId: task.id,
        status: task.status,
        result: task.result
      }
    }
  )

  app.get(
    '/ocr/history',
    {
      preHandler: app.authenticate,
      schema: {
        tags: ['ocr'],
        summary: 'List my OCR tasks',
        security: [{ bearerAuth: [] }],
        response: {
          200: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                id: { type: 'string' },
                fileName: { type: 'string' },
                status: { type: 'string' },
                source: { type: 'string' },
                fullZipUrl: { type: 'string', nullable: true },
                createdAt: { type: 'string' }
              }
            }
          }
        }
      }
    },
    async (request) => {
      const user = request.user as Record<string, any> | undefined
      const userId = (user?.sub as string) || 'anonymous'
      const tasks = await listOcrTasksByUser(userId)
      return tasks.map((t) => ({
        id: t.id,
        fileName: t.fileName,
        status: t.status,
        source: t.source,
        fullZipUrl: t.fullZipUrl,
        createdAt: t.createdAt.toISOString()
      }))
    }
  )
}
