export interface ParsedQuestion {
  stem: string
  type: 'single' | 'multi' | 'fill' | 'short' | 'essay'
  options?: string[]
  answer?: unknown
  analysis?: string
}

const QUESTION_START = /^\s*(\d{1,3})[\.．、\)]\s*(.+)$/
const OPTION_LINE = /^\s*([A-H])[\.\、\)]\s*(.+)$/
const ANSWER_LINE = /^\s*(?:答案|参考答案|【答案】)[:：]?\s*(.+)\s*$/
const ANALYSIS_LINE = /^\s*(?:解析|【解析】|答案解析)[:：]?\s*(.+)\s*$/

function normalizeNewlines(text: string) {
  return text.replace(/\r\n/g, '\n').replace(/\r/g, '\n')
}

function splitIntoBlocks(text: string): string[] {
  const lines = normalizeNewlines(text)
    .split('\n')
    .map((l) => l.trimEnd())

  const blocks: string[] = []
  let current: string[] = []

  for (const rawLine of lines) {
    const line = rawLine.trim()
    if (!line) continue

    if (QUESTION_START.test(line)) {
      if (current.length) blocks.push(current.join('\n'))
      current = [line]
      continue
    }

    if (!current.length) {
      // No numbering, treat as one block until we see numbering.
      current = [line]
    } else {
      current.push(line)
    }
  }

  if (current.length) blocks.push(current.join('\n'))
  return blocks
}

function parseBlock(block: string): ParsedQuestion | null {
  const lines = normalizeNewlines(block)
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean)

  if (lines.length === 0) return null

  let firstLine = lines[0]
  const startMatch = firstLine.match(QUESTION_START)
  if (startMatch) {
    firstLine = startMatch[2].trim()
  }

  const stemParts: string[] = []
  const options: string[] = []
  let answerText = ''
  let analysisText = ''

  let inOptions = false
  for (let idx = 0; idx < lines.length; idx += 1) {
    const line = idx === 0 ? firstLine : lines[idx]

    const ans = line.match(ANSWER_LINE)
    if (ans) {
      answerText = ans[1].trim()
      continue
    }

    const ana = line.match(ANALYSIS_LINE)
    if (ana) {
      analysisText = ana[1].trim()
      continue
    }

    const opt = line.match(OPTION_LINE)
    if (opt) {
      inOptions = true
      options.push(opt[2].trim())
      continue
    }

    // Keep remaining lines as stem unless we already started parsing options.
    if (!inOptions) {
      stemParts.push(line)
    } else {
      // Sometimes option text wraps to next line.
      const last = options.pop()
      if (last) options.push(`${last} ${line}`.trim())
    }
  }

  const stem = stemParts.join('\n').trim()
  if (!stem) return null

  if (options.length > 0) {
    const letters = answerText
      .toUpperCase()
      .replace(/[^A-H]/g, '')
      .split('')
      .filter(Boolean)

    const type: ParsedQuestion['type'] = letters.length > 1 ? 'multi' : 'single'
    return {
      stem,
      type,
      options,
      answer: letters.length ? letters : answerText || undefined,
      analysis: analysisText || undefined
    }
  }

  const hasBlank = /_{3,}|（\s*）|\(\s*\)|\[+\s*\]+/.test(stem)
  const type: ParsedQuestion['type'] = hasBlank ? 'fill' : 'short'
  return {
    stem,
    type,
    answer: answerText || undefined,
    analysis: analysisText || undefined
  }
}

export function parseQuestionsFromText(text: string): ParsedQuestion[] {
  const blocks = splitIntoBlocks(text)
  const parsed: ParsedQuestion[] = []
  for (const block of blocks) {
    const q = parseBlock(block)
    if (q) parsed.push(q)
  }
  return parsed
}

