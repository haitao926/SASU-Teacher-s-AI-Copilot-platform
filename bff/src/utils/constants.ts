// Asset types are intentionally a curated allowlist to keep analytics/search manageable.
// Add new types here when a micro-app introduces a new "canonical" content format.
export const ASSET_TYPES = [
  'mermaid',
  'image',
  'quiz-json',
  'markdown',
  'text',
  'audio',
  'video',
  'file',
  // Education domain-friendly aliases (used by existing micro-app UIs)
  'courseware',
  'note',
  'pptx',
  'docx',
  'pdf',
  'answer-sheet'
]
export const ASSET_VISIBILITY = ['PRIVATE', 'INTERNAL', 'PUBLIC']
export const TOOL_STATUS = ['DRAFT', 'ACTIVE', 'MAINTENANCE', 'DEPRECATED']

export const MAX_TAGS = 16
export const MAX_TAG_LENGTH = 64
