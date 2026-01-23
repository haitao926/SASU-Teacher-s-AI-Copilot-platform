import fs from 'fs'
import path from 'path'

// --- Type Definitions ---

interface QuestionROI {
  id: string
  x: number
  y: number
  w: number
  h: number
}

interface MinerSpan {
  content: string
  bbox: [number, number, number, number] // [x_min, y_min, x_max, y_max]
}

interface MineruOutput {
  spans: MinerSpan[]
  page_size: { width: number, height: number }
}

// --- Loading Question Configuration ---

let questionConfig: QuestionROI[] = []

/**
 * Loads the question region of interest (ROI) configuration from the JSON file.
 * This file acts as the "map" to locate answers on the paper.
 */
function loadQuestionConfig(): QuestionROI[] {
  if (questionConfig.length > 0) {
    return questionConfig
  }
  try {
    const configPath = path.join(process.cwd(), 'asset', 'grading-config.json')
    const configFile = fs.readFileSync(configPath, 'utf-8')
    questionConfig = JSON.parse(configFile)
    return questionConfig
  } catch (error) {
    console.error('Error loading grading-config.json:', error)
    // In case of error, return an empty array to prevent crashes
    return []
  }
}

// --- Bbox Attribution Logic ---

/**
 * Checks if a point (px, py) is inside a bounding box (rect).
 */
function isPointInRect(px: number, py: number, rect: QuestionROI): boolean {
  return px >= rect.x && px <= rect.x + rect.w && py >= rect.y && py <= rect.y + rect.h
}

/**
 * Assigns text spans from MinerU output to specific questions based on their location.
 * @param mineruOutput The structured OCR output from MinerU.
 * @returns A map where keys are question IDs and values are the extracted answer texts.
 */
export function attributeSpansToQuestions(mineruOutput: MineruOutput): Map<string, string> {
  const rois = loadQuestionConfig()
  const attributedAnswers = new Map<string, MinerSpan[]>()

  // Step 1: Group spans by the question ROI they fall into
  for (const span of mineruOutput.spans) {
    // Calculate the center of the span's bounding box
    const spanCenterX = (span.bbox[0] + span.bbox[2]) / 2
    const spanCenterY = (span.bbox[1] + span.bbox[3]) / 2

    for (const roi of rois) {
      if (isPointInRect(spanCenterX, spanCenterY, roi)) {
        if (!attributedAnswers.has(roi.id)) {
          attributedAnswers.set(roi.id, [])
        }
        attributedAnswers.get(roi.id)?.push(span)
        break // Assume a span belongs to only one question
      }
    }
  }

  // Step 2: Consolidate grouped spans into final answer strings
  const finalAnswers = new Map<string, string>()
  for (const [questionId, spans] of attributedAnswers.entries()) {
    // Sort spans by their vertical, then horizontal position to form coherent text
    spans.sort((a, b) => {
      if (a.bbox[1] !== b.bbox[1]) {
        return a.bbox[1] - b.bbox[1] // Sort by Y first
      }
      return a.bbox[0] - b.bbox[0] // Then by X
    })
    
    const concatenatedText = spans.map(s => s.content).join(' ')
    finalAnswers.set(questionId, concatenatedText)
  }

  console.log('[BboxAttribution] Attributed answers:', finalAnswers)
  return finalAnswers
}
