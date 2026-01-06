import prisma from '../utils/prisma'
import type { Prisma } from '@prisma/client'

export type QuestionType = 'single' | 'multi' | 'fill' | 'short' | 'essay'

export interface AssignmentInput {
  tenantId: string
  name: string
  subject: string
  description?: string
  totalPoints?: number
}

export interface AnswerKeyInput {
  tenantId: string
  assignmentId: string
  questionId: string
  questionType: QuestionType
  content: any
  points: number
}

export interface SubmissionAnswer {
  questionId: string
  answer: any
}

export interface SubmissionInput {
  tenantId: string
  assignmentId: string
  studentId: string
  payloadUrl?: string
  answers?: SubmissionAnswer[]
}

function normalizeAnswer(val: any) {
  if (Array.isArray(val)) return val.map(String).sort()
  if (val === null || val === undefined) return ''
  return String(val).trim()
}

export async function createAssignment(input: AssignmentInput) {
  return prisma.assignment.create({
    data: {
      tenantId: input.tenantId,
      name: input.name,
      subject: input.subject,
      description: input.description,
      totalPoints: input.totalPoints ?? 0,
      status: 'ACTIVE'
    }
  })
}

export async function listAssignments(tenantId: string) {
  return prisma.assignment.findMany({
    where: { tenantId },
    orderBy: { createdAt: 'desc' }
  })
}

export async function addAnswerKeys(inputs: AnswerKeyInput[]) {
  const creates: Prisma.AnswerKeyCreateManyInput[] = inputs.map((item) => ({
    tenantId: item.tenantId,
    assignmentId: item.assignmentId,
    questionId: item.questionId,
    questionType: item.questionType,
    content: JSON.stringify(item.content ?? ''),
    points: item.points
  }))
  await prisma.answerKey.createMany({ data: creates })
  return true
}

export async function createSubmission(input: SubmissionInput) {
  const submission = await prisma.submission.create({
    data: {
      tenantId: input.tenantId,
      assignmentId: input.assignmentId,
      studentId: input.studentId,
      status: 'PROCESSING',
      payloadUrl: input.payloadUrl
    }
  })

  // 自动判分（仅客观题）
  if (input.answers && input.answers.length > 0) {
    const keys = await prisma.answerKey.findMany({
      where: { tenantId: input.tenantId, assignmentId: input.assignmentId }
    })
    let objectiveScore = 0
    const details: Record<string, any> = {}
    const keyMap = new Map(keys.map((k) => [k.questionId, k]))

    for (const ans of input.answers) {
      const key = keyMap.get(ans.questionId)
      if (!key) continue
      const expected = normalizeAnswer(JSON.parse(key.content))
      const actual = normalizeAnswer(ans.answer)
      let awarded = 0
      if (['single', 'multi', 'fill'].includes(key.questionType)) {
        awarded = expected === actual ? key.points : 0
        objectiveScore += awarded
      }
      details[ans.questionId] = {
        type: key.questionType,
        expected,
        actual,
        points: key.points,
        awarded
      }
    }

    await prisma.gradingResult.create({
      data: {
        tenantId: input.tenantId,
        submissionId: submission.id,
        objectiveScore,
        subjectiveScore: 0,
        totalScore: objectiveScore,
        details: JSON.stringify(details)
      }
    })

    await prisma.submission.update({
      where: { id: submission.id },
      data: {
        status: 'DONE',
        totalScore: objectiveScore
      }
    })
  }

  return submission
}

export async function listSubmissions(tenantId: string, assignmentId?: string) {
  return prisma.submission.findMany({
    where: {
      tenantId,
      assignmentId: assignmentId || undefined
    },
    include: {
      student: true,
      grading: true
    },
    orderBy: { createdAt: 'desc' }
  })
}

export async function exportGradingCsv(tenantId: string, assignmentId: string) {
  const submissions = await prisma.submission.findMany({
    where: { tenantId, assignmentId },
    include: {
      student: true,
      grading: true
    }
  })

  const lines = [['作业', '班级', '学号', '姓名', '状态', '得分']]
  for (const s of submissions) {
    lines.push([
      assignmentId,
      s.student.class,
      s.student.studentId,
      s.student.name,
      s.status,
      s.totalScore
    ].map((v) => `"${String(v ?? '').replace(/"/g, '""')}"`))
  }
  return lines.map((row) => row.join(',')).join('\n')
}
