export const KNOWN_PERMISSIONS = [
  'admin.access',
  'portal.manage',
  'entries.manage',
  'announcements.manage',
  'users.manage',
  'assets.manage_all',
  'questions.manage_all',
  'students.manage',
  'events.view_all',
  'audit.view'
] as const

export type KnownPermission = (typeof KNOWN_PERMISSIONS)[number]

function uniq<T>(values: T[]): T[] {
  return Array.from(new Set(values))
}

export function sanitizePermissions(input: unknown): KnownPermission[] {
  if (!Array.isArray(input)) return []
  const normalized = input
    .map((v) => (typeof v === 'string' ? v.trim() : ''))
    .filter((v) => v.length > 0)
  const allowed = normalized.filter((v): v is KnownPermission => (KNOWN_PERMISSIONS as readonly string[]).includes(v))
  return uniq(allowed)
}

export function parseUserMetadata(metadata: unknown): Record<string, unknown> {
  if (typeof metadata !== 'string' || !metadata.trim()) return {}
  try {
    const parsed = JSON.parse(metadata)
    return parsed && typeof parsed === 'object' ? (parsed as Record<string, unknown>) : {}
  } catch {
    return {}
  }
}

export function getPermissionsFromUserRecord(user: { role?: string; metadata?: string | null }): string[] {
  if (user?.role === 'ADMIN') return ['*']
  const meta = parseUserMetadata(user?.metadata ?? null)
  return sanitizePermissions(meta.permissions)
}

export function hasPermission(user: any, permission: KnownPermission | string): boolean {
  if (!user) return false
  if (user.role === 'ADMIN') return true

  const perms = Array.isArray(user.permissions) ? user.permissions : []
  if (perms.includes('*')) return true
  return perms.includes(permission)
}

export function requirePermission(permission: KnownPermission) {
  return async (request: any, reply: any) => {
    const user = request.user as any
    if (!hasPermission(user, permission)) {
      return reply.code(403).send({ message: 'Forbidden' })
    }
  }
}
