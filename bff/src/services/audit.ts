import type { FastifyRequest } from 'fastify'
import prisma from '../utils/prisma'

interface AuditInput {
  operatorId: string
  action: string
  resource: string
  resourceId?: string | null
  details?: Record<string, unknown> | string | null
  request?: FastifyRequest
}

function serializeDetails(details?: Record<string, unknown> | string | null): string {
  if (!details) return '{}'
  if (typeof details === 'string') return details
  try {
    return JSON.stringify(details)
  } catch {
    return '{}'
  }
}

export async function recordAudit(input: AuditInput) {
  try {
    await prisma.auditLog.create({
      data: {
        operatorId: input.operatorId,
        action: input.action,
        resource: input.resource,
        resourceId: input.resourceId ?? null,
        details: serializeDetails(input.details),
        ipAddress: input.request?.ip,
        userAgent: typeof input.request?.headers['user-agent'] === 'string'
          ? input.request?.headers['user-agent']
          : undefined
      }
    })
  } catch (err) {
    // Avoid blocking main flow on audit failure
    // eslint-disable-next-line no-console
    console.warn('recordAudit failed', err)
  }
}
