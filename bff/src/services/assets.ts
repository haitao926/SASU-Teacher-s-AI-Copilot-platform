import prisma from '../utils/prisma'
import { ASSET_TYPES, ASSET_VISIBILITY, MAX_TAGS, MAX_TAG_LENGTH } from '../utils/constants'

export interface AssetCreateInput {
  tenantId: string
  authorId: string
  title: string
  summary?: string
  content?: string
  contentUrl?: string
  metadata?: Record<string, unknown>
  tags?: string[]
  type: string
  toolId?: string
  visibility?: string
}

export interface AssetListParams {
  tenantId: string
  userId: string
  role: string
  keyword?: string
  type?: string
  toolId?: string
  visibility?: string
  mine?: boolean
  limit?: number
  offset?: number
}

export interface AssetView {
  id: string
  tenantId: string
  title: string
  summary?: string | null
  content?: string | null
  contentUrl?: string | null
  metadata: Record<string, unknown> | null
  type: string
  tags: string[]
  version: number
  authorId: string
  toolId?: string | null
  visibility: string
  createdAt: string
  updatedAt: string
}

interface PaginatedAssets {
  items: AssetView[]
  total: number
  limit: number
  offset: number
}

export interface AssetUpdateInput {
  title?: string
  summary?: string | null
  content?: string | null
  contentUrl?: string | null
  metadata?: Record<string, unknown> | null
  tags?: string[] | null
  type?: string
  toolId?: string | null
  visibility?: string
}

function normalizeVisibility(value?: string): string {
  const normalized = (value ?? 'PRIVATE').toUpperCase()
  if (!ASSET_VISIBILITY.includes(normalized)) {
    throw new Error(`Unsupported visibility: ${value}`)
  }
  return normalized
}

function normalizeAssetType(value: string): string {
  const normalized = value.trim().toLowerCase()
  if (!ASSET_TYPES.includes(normalized)) {
    throw new Error(`Unsupported asset type: ${value}`)
  }
  return normalized
}

async function ensureToolExists(tenantId: string, toolId?: string | null): Promise<string | null> {
  if (toolId === undefined) return null
  const normalized = toolId?.toString().trim()
  if (!normalized) return null

  const exists = await prisma.tool.findFirst({
    where: { id: normalized, tenantId, deletedAt: null },
    select: { id: true }
  })
  if (!exists) {
    throw new Error(`Invalid toolId: ${normalized}`)
  }
  return normalized
}

function serializeMetadata(metadata?: Record<string, unknown>): string | null {
  if (!metadata) return null
  return JSON.stringify(metadata)
}

function normalizeTags(tags?: string[]): string[] {
  if (!tags || tags.length === 0) return []
  const normalized = tags
    .map((t) => t?.toString().trim())
    .filter((t): t is string => Boolean(t))
    .slice(0, MAX_TAGS)
    .map((t) => t.slice(0, MAX_TAG_LENGTH))
  return normalized
}

function serializeTags(tags?: string[]): string | null {
  const normalized = normalizeTags(tags)
  if (normalized.length === 0) return null
  return JSON.stringify(normalized)
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

function parseMetadata(raw: string | null): Record<string, unknown> | null {
  if (!raw) return null
  try {
    const parsed = JSON.parse(raw)
    return parsed && typeof parsed === 'object' ? parsed as Record<string, unknown> : null
  } catch {
    return null
  }
}

function toAssetView(asset: any): AssetView {
  return {
    id: asset.id,
    tenantId: asset.tenantId,
    title: asset.title,
    summary: asset.summary,
    content: asset.content,
    contentUrl: asset.contentUrl,
    metadata: parseMetadata(asset.metadata),
    type: asset.type,
    tags: parseTags(asset.tags),
    version: asset.version,
    authorId: asset.authorId,
    toolId: asset.toolId,
    visibility: asset.visibility,
    createdAt: asset.createdAt.toISOString(),
    updatedAt: asset.updatedAt.toISOString()
  }
}

export async function createAsset(input: AssetCreateInput): Promise<AssetView> {
  if (!input.content && !input.contentUrl) {
    throw new Error('Either content or contentUrl is required')
  }

  const visibility = normalizeVisibility(input.visibility)
  const type = normalizeAssetType(input.type)
  const toolId = await ensureToolExists(input.tenantId, input.toolId)

  const asset = await prisma.asset.create({
    data: {
      tenantId: input.tenantId,
      title: input.title,
      summary: input.summary,
      content: input.content,
      contentUrl: input.contentUrl,
      metadata: serializeMetadata(input.metadata),
      type,
      tags: serializeTags(input.tags),
      version: 1,
      authorId: input.authorId,
      toolId,
      visibility
    }
  })

  return toAssetView(asset)
}

export async function getAssetForUser(
  assetId: string,
  tenantId: string,
  userId: string,
  role: string
): Promise<AssetView | null> {
  const asset = await prisma.asset.findUnique({ where: { id: assetId } })
  if (!asset || asset.deletedAt || asset.tenantId !== tenantId) {
    return null
  }

  if (role === 'ADMIN' || asset.authorId === userId) {
    return toAssetView(asset)
  }

  if (asset.visibility === 'PUBLIC' || asset.visibility === 'INTERNAL') {
    return toAssetView(asset)
  }

  return null
}

export async function listAssets(params: AssetListParams): Promise<PaginatedAssets> {
  const limit = Math.min(Math.max(params.limit ?? 20, 1), 100)
  const offset = Math.max(params.offset ?? 0, 0)

  const baseWhere: any = {
    tenantId: params.tenantId,
    deletedAt: null
  }

  if (params.toolId) {
    baseWhere.toolId = params.toolId
  }
  if (params.type) {
    baseWhere.type = normalizeAssetType(params.type)
  }

  const visibility = params.visibility ? normalizeVisibility(params.visibility) : undefined
  const keyword = params.keyword?.toString().trim()
  if (keyword) {
    baseWhere.AND = (baseWhere.AND ?? []).concat({
      OR: [
        { title: { contains: keyword } },
        { summary: { contains: keyword } },
        { content: { contains: keyword } },
        { tags: { contains: keyword } },
        { metadata: { contains: keyword } }
      ]
    })
  }

  if (params.role === 'ADMIN') {
    if (params.mine) {
      baseWhere.authorId = params.userId
      if (visibility) baseWhere.visibility = visibility
    } else if (visibility) {
      baseWhere.visibility = visibility
    }
  } else {
    if (params.mine) {
      baseWhere.authorId = params.userId
      if (visibility) baseWhere.visibility = visibility
    } else if (visibility === 'PRIVATE') {
      baseWhere.visibility = 'PRIVATE'
      baseWhere.authorId = params.userId
    } else if (visibility) {
      baseWhere.visibility = visibility
      baseWhere.OR = [{ authorId: params.userId }, { visibility }]
    } else {
      baseWhere.OR = [{ authorId: params.userId }, { visibility: 'PUBLIC' }, { visibility: 'INTERNAL' }]
    }
  }

  const [items, total] = await prisma.$transaction([
    prisma.asset.findMany({
      where: baseWhere,
      orderBy: { createdAt: 'desc' },
      skip: offset,
      take: limit
    }),
    prisma.asset.count({ where: baseWhere })
  ])

  return {
    items: items.map(toAssetView),
    total,
    limit,
    offset
  }
}

export async function updateAsset(
  assetId: string,
  tenantId: string,
  userId: string,
  role: string,
  data: AssetUpdateInput
): Promise<AssetView | null | false> {
  const existing = await prisma.asset.findUnique({ where: { id: assetId } })
  if (!existing || existing.deletedAt || existing.tenantId !== tenantId) {
    return null
  }

  const isOwner = existing.authorId === userId
  const canUpdate = role === 'ADMIN' || isOwner
  if (!canUpdate) {
    return false
  }

  const updateData: any = {}

  if (data.title !== undefined) updateData.title = data.title
  if (data.summary !== undefined) updateData.summary = data.summary
  if (data.content !== undefined) updateData.content = data.content
  if (data.contentUrl !== undefined) updateData.contentUrl = data.contentUrl

  if (data.metadata !== undefined) {
    updateData.metadata = data.metadata ? serializeMetadata(data.metadata) : null
  }
  if (data.tags !== undefined) {
    updateData.tags = data.tags ? serializeTags(data.tags) : null
  }
  if (data.type !== undefined) {
    updateData.type = normalizeAssetType(data.type)
  }
  if (data.visibility !== undefined) {
    updateData.visibility = normalizeVisibility(data.visibility)
  }
  if (data.toolId !== undefined) {
    updateData.toolId = await ensureToolExists(tenantId, data.toolId)
  }

  const updated = await prisma.asset.update({
    where: { id: assetId },
    data: updateData
  })

  return toAssetView(updated)
}

export async function softDeleteAsset(assetId: string, tenantId: string, userId: string, role: string) {
  const asset = await prisma.asset.findUnique({ where: { id: assetId } })
  if (!asset || asset.deletedAt || asset.tenantId !== tenantId) {
    return null
  }

  const isOwner = asset.authorId === userId
  const canDelete = role === 'ADMIN' || isOwner
  if (!canDelete) {
    return false
  }

  await prisma.asset.update({
    where: { id: assetId },
    data: { deletedAt: new Date() }
  })

  return true
}

export async function restoreAsset(assetId: string, tenantId: string, userId: string, role: string) {
  const asset = await prisma.asset.findUnique({ where: { id: assetId } })
  if (!asset || asset.tenantId !== tenantId) {
    return null
  }
  const isOwner = asset.authorId === userId
  const canRestore = role === 'ADMIN' || isOwner
  if (!canRestore) {
    return false
  }
  if (!asset.deletedAt) {
    return true
  }

  await prisma.asset.update({
    where: { id: assetId },
    data: { deletedAt: null }
  })

  return true
}

export { ASSET_TYPES as ALLOWED_ASSET_TYPES, ASSET_VISIBILITY as ALLOWED_VISIBILITY }
