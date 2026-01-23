import { parseUserMetadata } from './permissions'

function uniq(values: string[]) {
  return Array.from(new Set(values))
}

export function normalizeStringArray(value: unknown): string[] {
  if (Array.isArray(value)) {
    return uniq(
      value
        .map((item) => (typeof item === 'string' ? item.trim() : ''))
        .filter((item) => item.length > 0)
    )
  }

  if (typeof value === 'string') {
    const split = value.split(/[,，;；、|\/]/)
    return uniq(split.map((item) => item.trim()).filter((item) => item.length > 0))
  }

  return []
}

export function getTeachingProfileFromUserRecord(user: { metadata?: string | null }) {
  const meta = parseUserMetadata(user?.metadata ?? null)
  const teaching = typeof meta.teaching === 'object' && meta.teaching !== null
    ? (meta.teaching as Record<string, unknown>)
    : {}

  return {
    subjects: normalizeStringArray(teaching.subjects),
    classes: normalizeStringArray(teaching.classes)
  }
}

export function applyTeachingUpdates(
  meta: Record<string, unknown>,
  updates: { subjects?: unknown; classes?: unknown }
) {
  const hasSubjects = Object.prototype.hasOwnProperty.call(updates, 'subjects')
  const hasClasses = Object.prototype.hasOwnProperty.call(updates, 'classes')
  if (!hasSubjects && !hasClasses) return

  const existing = typeof meta.teaching === 'object' && meta.teaching !== null
    ? { ...(meta.teaching as Record<string, unknown>) }
    : {}

  if (hasSubjects) {
    const normalized = normalizeStringArray(updates.subjects)
    if (normalized.length > 0) {
      existing.subjects = normalized
    } else {
      delete existing.subjects
    }
  }

  if (hasClasses) {
    const normalized = normalizeStringArray(updates.classes)
    if (normalized.length > 0) {
      existing.classes = normalized
    } else {
      delete existing.classes
    }
  }

  if (Object.keys(existing).length > 0) {
    meta.teaching = existing
  } else {
    delete meta.teaching
  }
}
