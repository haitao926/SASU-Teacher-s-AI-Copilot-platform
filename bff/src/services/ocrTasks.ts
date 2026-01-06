import prisma from '../utils/prisma'

export type OcrStatus = 'queued' | 'processing' | 'done' | 'error'

export async function createOcrTask(params: {
  id: string
  userId: string
  fileName: string
  status: OcrStatus
  source: 'mock' | 'mineru'
  fullZipUrl?: string
}) {
  return prisma.ocrTask.upsert({
    where: { id: params.id },
    update: {
      userId: params.userId,
      fileName: params.fileName,
      status: params.status,
      source: params.source,
      fullZipUrl: params.fullZipUrl
    },
    create: {
      id: params.id,
      userId: params.userId,
      fileName: params.fileName,
      status: params.status,
      source: params.source,
      fullZipUrl: params.fullZipUrl
    }
  })
}

export async function updateOcrTask(params: {
  id: string
  status?: OcrStatus
  fullZipUrl?: string | null
  result?: string | null
}) {
  return prisma.ocrTask.update({
    where: { id: params.id },
    data: {
      status: params.status,
      fullZipUrl: params.fullZipUrl,
      result: params.result ?? undefined
    }
  })
}

export async function getOcrTask(id: string) {
  return prisma.ocrTask.findUnique({ where: { id } })
}

export async function listOcrTasksByUser(userId: string) {
  return prisma.ocrTask.findMany({
    where: { userId },
    orderBy: { createdAt: 'desc' }
  })
}
