import fs from 'fs'
import path from 'path'
import { processImageWithMineru } from './mineru'
import { attributeSpansToQuestions } from './gradingBbox'
import { gradeImage } from './aiGrading' // We'll reuse this for subjective questions

// --- Type Definitions ---

interface Question {
  id: string
  type: 'single_choice' | 'true_false' | 'subjective'
  correctAnswer: string
  maxPoints: number
}

interface GradingResult {
  questionId: string
  studentAnswer: string
  score: number
  feedback: string
}

// --- Helper to load full question config ---

let fullQuestionConfig: Question[] = []

function loadFullQuestionConfig(): Question[] {
  if (fullQuestionConfig.length > 0) {
    return fullQuestionConfig
  }
  try {
    const configPath = path.join(process.cwd(), 'asset', 'grading-config.json')
    const configFile = fs.readFileSync(configPath, 'utf-8')
    fullQuestionConfig = JSON.parse(configFile)
    return fullQuestionConfig
  } catch (error) {
    console.error('Error loading grading-config.json:', error)
    return []
  }
}

// --- Main Paper Grading Service ---

/**
 * Orchestrates the grading of a single paper using the new bbox-based workflow.
 * @param imageBase64 The base64 encoded image of the entire paper.
 * @returns An object containing the total score and detailed results for each question.
 */
export async function gradePaper(imageBase64: string): Promise<{ totalScore: number; results: GradingResult[] }> {
  console.log('[PaperGrader] Starting paper grading process...')

  // 1. Get structured OCR output from MinerU
  const mineruOutput = await processImageWithMineru(imageBase64)
  if (!mineruOutput || !mineruOutput.spans) {
    throw new Error('Failed to get valid OCR output from MinerU service.')
  }

  // 2. Attribute OCR spans to questions
  const attributedAnswers = attributeSpansToQuestions(mineruOutput)

  // 3. Load question configuration (with correct answers and points)
  const questions = loadFullQuestionConfig()
  const gradingResults: GradingResult[] = []
  let totalScore = 0

  // 4. Grade each question
  for (const question of questions) {
    const studentAnswer = attributedAnswers.get(question.id) || ''
    let result: GradingResult = {
      questionId: question.id,
      studentAnswer,
      score: 0,
      feedback: '未作答',
    }

    if (studentAnswer) {
      if (question.type === 'single_choice' || question.type === 'true_false') {
        // --- Objective Question Grading (Rule-based) ---
        const isCorrect = studentAnswer.trim().toUpperCase() === question.correctAnswer.trim().toUpperCase()
        result.score = isCorrect ? question.maxPoints : 0
        result.feedback = isCorrect ? '回答正确' : `标准答案: ${question.correctAnswer}`
        console.log(`[PaperGrader] Objective ${question.id}: Student answered ${studentAnswer}, Correct: ${isCorrect}`)
      } else if (question.type === 'subjective') {
        // --- Subjective Question Grading (AI-based) ---
        console.log(`[PaperGrader] Subjective ${question.id}: Sending to AI grader...`)
        // For now, we reuse the `gradeImage` function.
        // We pass the extracted text in the `ocrText` field, which the VLM prompt can use.
        // The imageBase64 is passed as context, though the AI is prompted to focus on the text.
        const aiResult = await gradeImage({
          imageBase64, // Pass full image for context
          questionText: `主观题: ${question.id}`,
          correctAnswer: question.correctAnswer, // Rubric
          maxPoints: question.maxPoints,
          ocrText: studentAnswer, // The most important part for the new workflow
        })
        result.score = aiResult.score
        result.feedback = aiResult.feedback
        // The studentAnswer from AI might be a more refined extraction
        result.studentAnswer = aiResult.studentAnswer 
      }
    }
    
    gradingResults.push(result)
    totalScore += result.score
  }

  console.log(`[PaperGrader] Grading complete. Total score: ${totalScore}`)
  return { totalScore, results: gradingResults }
}
