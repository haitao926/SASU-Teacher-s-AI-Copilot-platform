
import { randomUUID } from 'crypto'
import type { FastifyInstance } from 'fastify'
import AdmZip from 'adm-zip'
import config from '../config'
import prisma from '../utils/prisma'
import { hasPermission } from '../utils/permissions'
import { createAsset } from '../services/assets'
import {
  applyUploadUrl,
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
  scene?: 'doc' | 'lens'
}

interface SaveAssetBody {
  title: string
  type: string
  tags?: string[]
  visibility?: 'PRIVATE' | 'INTERNAL' | 'PUBLIC'
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
  scene?: 'doc' | 'lens'
}

const mockTasks = new Map<string, OcrTask>()

function createMockResult(fileName: string) {
  return `# OCR 解析结果 (Mock)\n\n文件: ${fileName}\n\n## 1. 简介\n这是一份模拟文档，用于演示前端渲染效果。\n\n## 2. 公式测试\n我们可以解析数学公式，例如：\n$$E = mc^2$$\n\n## 3. 代码测试\n\`\`\`python\nprint("Hello World")\n\`\`\`\n\n- 提取时间: ${new Date().toISOString()}\n- 状态: 完成`
}

function scheduleMockProgress(taskId: string) {
  let progress = 10
  const task = mockTasks.get(taskId)
  const isLens = task?.scene === 'lens'
  const intervalTime = isLens ? 200 : 700 

  const timer = setInterval(() => {
    progress += 20
    const currentTask = mockTasks.get(taskId)
    if (!currentTask) {
      clearInterval(timer)
      return
    }
    currentTask.progress = Math.min(progress, 100)
    currentTask.status = currentTask.progress >= 100 ? 'done' : 'processing'
    if (currentTask.status === 'done') {
      currentTask.result = currentTask.result ?? createMockResult(currentTask.fileName)
      clearInterval(timer)
    }
  }, intervalTime)
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
            mimeType: { type: 'string' },
            scene: { type: 'string', enum: ['doc', 'lens'] }
          }
        }
      }
    },
    async (request, reply) => {
      const { fileName, contentBase64, scene = 'doc' } = request.body
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
          source: 'mock',
          scene
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
      
      try {
        const dataId = generateDataId()
        const uploadInfo = await applyUploadUrl(fileName, dataId)
        
        await uploadToSignedUrl(uploadInfo.uploadUrl, toBuffer(contentBase64), request.body.mimeType)
        
        const taskId = uploadInfo.batchId
        
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
          requestId: uploadInfo.traceId
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

  // MinerU artifacts: list files inside result zip (for debugging / advanced parsing like bbox/layout)
  app.get<{ Params: { id: string } }>(
    '/ocr/artifacts/:id',
    {
      preHandler: app.authenticate,
      schema: {
        tags: ['ocr'],
        summary: 'List MinerU result artifacts in zip',
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
      if (!mineruEnabled()) return reply.code(501).send({ message: 'Artifacts not supported in Mock mode' })

      try {
        const state = await getTaskState(id)
        if (state.status !== 'done') return reply.code(202).send(state)
        if (!state.fullZipUrl) return reply.code(404).send({ message: 'Result zip not found' })

        const zipRes = await fetch(state.fullZipUrl)
        if (!zipRes.ok) throw new Error('Failed to download ZIP from storage')
        const buffer = Buffer.from(await zipRes.arrayBuffer())
        const zip = new AdmZip(buffer)
        const entries = zip
          .getEntries()
          .filter((e: any) => !e.isDirectory && !e.entryName.startsWith('__MACOSX'))
          .map((e: any) => ({ name: e.entryName, size: e.header?.size ?? e.getData().length }))

        return {
          taskId: state.taskId,
          status: state.status,
          fullZipUrl: state.fullZipUrl,
          artifacts: entries
        }
      } catch (err: any) {
        request.log.error({ err }, 'mineru artifacts failed')
        return reply.code(500).send({ message: err?.message ?? 'MinerU artifacts 查询失败' })
      }
    }
  )

  // MinerU artifacts: fetch a specific file in result zip by exact entry name
  app.get<{ Params: { id: string }, Querystring: { name: string } }>(
    '/ocr/artifact/:id',
    {
      preHandler: app.authenticate,
      schema: {
        tags: ['ocr'],
        summary: 'Fetch a MinerU artifact file from zip',
        security: [{ bearerAuth: [] }],
        params: {
          type: 'object',
          properties: {
            id: { type: 'string' }
          }
        },
        querystring: {
          type: 'object',
          required: ['name'],
          properties: {
            name: { type: 'string' }
          }
        }
      }
    },
    async (request, reply) => {
      const { id } = request.params
      const name = String(request.query?.name ?? '')
      if (!name) return reply.code(400).send({ message: 'name is required' })
      if (!mineruEnabled()) return reply.code(501).send({ message: 'Artifacts not supported in Mock mode' })

      try {
        const state = await getTaskState(id)
        if (state.status !== 'done') return reply.code(202).send(state)
        if (!state.fullZipUrl) return reply.code(404).send({ message: 'Result zip not found' })

        const zipRes = await fetch(state.fullZipUrl)
        if (!zipRes.ok) throw new Error('Failed to download ZIP from storage')
        const buffer = Buffer.from(await zipRes.arrayBuffer())
        const zip = new AdmZip(buffer)
        const entry = zip
          .getEntries()
          .find((e: any) => !e.isDirectory && !e.entryName.startsWith('__MACOSX') && e.entryName === name)
        if (!entry) return reply.code(404).send({ message: 'Artifact not found' })

        const data = entry.getData()
        const lower = name.toLowerCase()
        if (lower.endsWith('.json')) reply.header('Content-Type', 'application/json; charset=utf-8')
        else if (lower.endsWith('.md') || lower.endsWith('.txt')) reply.header('Content-Type', 'text/plain; charset=utf-8')
        else if (lower.endsWith('.html')) reply.header('Content-Type', 'text/html; charset=utf-8')
        else reply.header('Content-Type', 'application/octet-stream')
        return reply.send(data)
      } catch (err: any) {
        request.log.error({ err }, 'mineru artifact fetch failed')
        return reply.code(500).send({ message: err?.message ?? 'MinerU artifact 获取失败' })
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

          let markdownContent = ''
          const fullZipUrl = state.fullZipUrl

          if (fullZipUrl) {
             try {
               const zipRes = await fetch(fullZipUrl)
               if (zipRes.ok) {
                 const buffer = Buffer.from(await zipRes.arrayBuffer())
                 const zip = new AdmZip(buffer)
                 const entries = zip.getEntries()
                 const mdEntry = entries.find(e => e.entryName.endsWith('.md') && !e.entryName.startsWith('__MACOSX'))
                 if (mdEntry) {
                   markdownContent = mdEntry.getData().toString('utf8')
                 }
               }
             } catch (e) {
               request.log.warn({ err: e }, 'Failed to extract markdown from zip')
             }
          }

          await updateOcrTask({
            id: state.taskId,
            status: state.status,
            fullZipUrl: state.fullZipUrl ?? undefined,
            result: markdownContent || undefined // Update DB
          }).catch(() => {})

          return {
            taskId: state.taskId,
            status: state.status,
            fullZipUrl: state.fullZipUrl,
            result: markdownContent,
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

  app.post<{ Params: { id: string }, Body: SaveAssetBody }>(
    '/ocr/tasks/:id/save-asset',
    {
      preHandler: app.authenticate,
      schema: {
        tags: ['ocr'],
        summary: 'Save OCR result to Resource Library (Assets)',
        security: [{ bearerAuth: [] }],
        params: {
          type: 'object',
          properties: {
            id: { type: 'string' }
          }
        },
        body: {
          type: 'object',
          required: ['title', 'type'],
          properties: {
            title: { type: 'string' },
            type: { type: 'string', description: 'e.g. quiz-json, markdown, courseware' },
            tags: { type: 'array', items: { type: 'string' } },
            visibility: { type: 'string', enum: ['PRIVATE', 'INTERNAL', 'PUBLIC'] }
          }
        }
      }
    },
    async (request, reply) => {
      const { id } = request.params
      const { title, type, tags, visibility = 'PRIVATE' } = request.body
      const user = request.user as any
      const tenantId = request.tenantId ?? 'default'

      if (visibility === 'PUBLIC' && !(user?.role === 'ADMIN' || hasPermission(user, 'assets.manage_all'))) {
        return reply.code(403).send({ message: 'Only asset admin can set PUBLIC visibility' })
      }

      let result = ''
      let fullZipUrl: string | undefined = ''

      if (mineruEnabled()) {
        const task = await getOcrTask(id)
        if (!task) return reply.code(404).send({ message: 'Task not found' })
        result = task.result || ''
        fullZipUrl = task.fullZipUrl || ''
      } else {
        const task = mockTasks.get(id)
        if (!task) return reply.code(404).send({ message: 'Task not found' })
        result = task.result || ''
      }

      if (!result) {
        return reply.code(400).send({ message: 'OCR result is empty, cannot save.' })
      }

      const asset = await createAsset({
        tenantId,
        authorId: user.sub,
        title,
        type,
        content: result,
        contentUrl: fullZipUrl || undefined,
        tags,
        visibility
      })

      return { success: true, assetId: asset.id }
    }
  )
}
