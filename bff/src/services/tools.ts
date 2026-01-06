import prisma from '../utils/prisma'
import { TOOL_STATUS, MAX_TAG_LENGTH, MAX_TAGS } from '../utils/constants'

interface ToolFilter {
  tenantId: string
  includeDisabled?: boolean
  category?: string
  status?: string
  includeDeleted?: boolean
}

export interface ToolView {
  id: string
  tenantId: string
  code: string
  name: string
  description?: string | null
  icon: string
  route: string
  category: string
  tags: string[]
  status: string
  isEnabled: boolean
  order: number
  createdAt: string
  updatedAt: string
}

export interface ToolCreateInput {
  tenantId: string
  code: string
  name: string
  description?: string
  icon: string
  route: string
  category: string
  tags?: string[]
  status?: string
  isEnabled?: boolean
  order?: number
  ownerId?: string
}

export interface ToolUpdateInput {
  name?: string
  description?: string | null
  icon?: string
  route?: string
  category?: string
  tags?: string[]
  status?: string
  isEnabled?: boolean
  order?: number
  ownerId?: string | null
  deletedAt?: string | null
}

function parseTags(raw: string | null): string[] {
  if (!raw) return []
  try {
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? parsed.map(String) : []
  } catch {
    return []
  }
}

function serializeTags(tags?: string[]): string | null {
  if (!tags || tags.length === 0) return null
  const normalized = tags
    .map((t) => t?.toString().trim())
    .filter((t): t is string => Boolean(t))
    .slice(0, MAX_TAGS)
    .map((t) => t.slice(0, MAX_TAG_LENGTH))

  if (normalized.length === 0) return null
  return JSON.stringify(normalized)
}

function normalizeStatus(raw?: string): string {
  const status = (raw ?? 'ACTIVE').toUpperCase()
  if (!TOOL_STATUS.includes(status)) {
    throw new Error(`Unsupported tool status: ${raw}`)
  }
  return status
}

export async function listTools(filter: ToolFilter): Promise<ToolView[]> {
  const where: any = {
    tenantId: filter.tenantId,
    deletedAt: filter.includeDeleted ? undefined : null
  }

  if (!filter.includeDisabled) {
    where.isEnabled = true
  }
  if (filter.category) {
    where.category = filter.category
  }
  if (filter.status) {
    where.status = filter.status
  }

  const tools = await prisma.tool.findMany({
    where,
    orderBy: [{ order: 'asc' }, { name: 'asc' }]
  })

  return tools.map((tool) => ({
    id: tool.id,
    tenantId: tool.tenantId,
    code: tool.code,
    name: tool.name,
    description: tool.description,
    icon: tool.icon,
    route: tool.route,
    category: tool.category,
    tags: parseTags(tool.tags),
    status: tool.status,
    isEnabled: tool.isEnabled,
    order: tool.order,
    createdAt: tool.createdAt.toISOString(),
    updatedAt: tool.updatedAt.toISOString()
  }))
}

export async function createTool(input: ToolCreateInput): Promise<ToolView> {
  const status = normalizeStatus(input.status)

  const tool = await prisma.tool.create({
    data: {
      tenantId: input.tenantId,
      code: input.code,
      name: input.name,
      description: input.description,
      icon: input.icon,
      route: input.route,
      category: input.category,
      tags: serializeTags(input.tags),
      status,
      isEnabled: input.isEnabled ?? true,
      order: input.order ?? 0,
      ownerId: input.ownerId ?? null
    }
  })

  return {
    id: tool.id,
    tenantId: tool.tenantId,
    code: tool.code,
    name: tool.name,
    description: tool.description,
    icon: tool.icon,
    route: tool.route,
    category: tool.category,
    tags: parseTags(tool.tags),
    status: tool.status,
    isEnabled: tool.isEnabled,
    order: tool.order,
    createdAt: tool.createdAt.toISOString(),
    updatedAt: tool.updatedAt.toISOString()
  }
}

export async function updateTool(
  toolId: string,
  tenantId: string,
  data: ToolUpdateInput
): Promise<ToolView | null> {
  const existing = await prisma.tool.findUnique({ where: { id: toolId } })
  if (!existing || existing.deletedAt || existing.tenantId !== tenantId) {
    return null
  }

  const updateData: any = {
    ...data
  }

  if (data.tags) {
    updateData.tags = serializeTags(data.tags)
  }
  if (data.status) {
    updateData.status = normalizeStatus(data.status)
  }
  if (data.deletedAt !== undefined) {
    updateData.deletedAt = data.deletedAt === null ? null : new Date(data.deletedAt)
  }

  const updated = await prisma.tool.update({
    where: { id: toolId },
    data: updateData
  })

  return {
    id: updated.id,
    tenantId: updated.tenantId,
    code: updated.code,
    name: updated.name,
    description: updated.description,
    icon: updated.icon,
    route: updated.route,
    category: updated.category,
    tags: parseTags(updated.tags),
    status: updated.status,
    isEnabled: updated.isEnabled,
    order: updated.order,
    createdAt: updated.createdAt.toISOString(),
    updatedAt: updated.updatedAt.toISOString()
  }
}

export async function softDeleteTool(toolId: string, tenantId: string): Promise<boolean | null> {
  const existing = await prisma.tool.findUnique({ where: { id: toolId } })
  if (!existing || existing.tenantId !== tenantId) {
    return null
  }
  if (existing.deletedAt) {
    return true
  }

  await prisma.tool.update({
    where: { id: toolId },
    data: { deletedAt: new Date() }
  })
  return true
}

export async function restoreTool(toolId: string, tenantId: string): Promise<boolean | null> {
  const existing = await prisma.tool.findUnique({ where: { id: toolId } })
  if (!existing || existing.tenantId !== tenantId) {
    return null
  }
  if (!existing.deletedAt) {
    return true
  }

  await prisma.tool.update({
    where: { id: toolId },
    data: { deletedAt: null }
  })
  return true
}

export { TOOL_STATUS as ALLOWED_TOOL_STATUS }
