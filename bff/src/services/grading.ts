import { randomUUID } from 'crypto'
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

export interface SubmissionGradingInput {
  objectiveScore?: number
  subjectiveScore?: number
  totalScore?: number
  details?: any
  publishToScores?: boolean
}

export interface SubmissionInput {
  tenantId: string
  assignmentId: string
  studentId: string
  payloadUrl?: string
  answers?: SubmissionAnswer[]
  grading?: SubmissionGradingInput
  actorId?: string
  actorRole?: string
  appCode?: string
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
  const submissionId = randomUUID()
  const learningEventId = randomUUID()

  return prisma.$transaction(async (tx) => {
    const assignment = await tx.assignment.findUnique({ where: { id: input.assignmentId } })
    if (!assignment) {
      throw new Error('Assignment not found')
    }

    const studentRecord =
      (await tx.student.findUnique({ where: { id: input.studentId } }).catch(() => null)) ??
      (await tx.student.findUnique({
        where: { tenantId_studentId: { tenantId: input.tenantId, studentId: input.studentId } }
      })) ??
      (await tx.student.create({
        data: {
          tenantId: input.tenantId,
          studentId: input.studentId,
          name: input.studentId,
          class: ''
        }
      }))

    const grading = input.grading
    const objectiveScore = grading?.objectiveScore ?? 0
    const subjectiveScore = grading?.subjectiveScore ?? 0
    const computedTotal = objectiveScore + subjectiveScore
    const totalScore = grading?.totalScore ?? computedTotal

    await tx.learningEvent.create({
      data: {
        id: learningEventId,
        tenantId: input.tenantId,
        actorId: input.actorId ?? 'system',
        actorRole: input.actorRole ?? null,
        appCode: input.appCode ?? 'quiz-grading',
        action: 'grading.submission.created',
        targetType: 'Submission',
        targetId: submissionId,
        payload: JSON.stringify({
          assignmentId: input.assignmentId,
          studentRecordId: studentRecord.id,
          studentId: studentRecord.studentId,
          class: studentRecord.class,
          answersCount: input.answers?.length ?? 0,
          grading: grading
            ? {
                objectiveScore,
                subjectiveScore,
                totalScore
              }
            : null
        })
      }
    })

    const submission = await tx.submission.create({
      data: {
        id: submissionId,
        tenantId: input.tenantId,
        assignmentId: input.assignmentId,
        studentId: studentRecord.id,
        status: grading ? 'DONE' : 'PROCESSING',
        totalScore: grading ? totalScore : 0,
        payloadUrl: input.payloadUrl,
        sourceEventId: learningEventId
      }
    })

    if (grading) {
      await tx.gradingResult.create({
        data: {
          tenantId: input.tenantId,
          submissionId: submission.id,
          objectiveScore,
          subjectiveScore,
          totalScore,
          details: grading.details !== undefined ? JSON.stringify(grading.details) : null,
          reviewedBy: input.actorId ?? null
        }
      })

      if (grading.publishToScores) {
        const scoreEventId = randomUUID()
        const examName = `[阅卷] ${assignment.name} (${assignment.id.slice(0, 6)})`

        await tx.learningEvent.create({
          data: {
            id: scoreEventId,
            tenantId: input.tenantId,
            actorId: input.actorId ?? 'system',
            actorRole: input.actorRole ?? null,
            appCode: input.appCode ?? 'quiz-grading',
            action: 'grading.score.published',
            targetType: 'Score',
            targetId: submission.id,
            payload: JSON.stringify({
              submissionId: submission.id,
              assignmentId: assignment.id,
              assignmentName: assignment.name,
              examName,
              subject: assignment.subject,
              studentId: studentRecord.studentId,
              class: studentRecord.class,
              totalScore
            })
          }
        })

        let exam = await tx.exam.findFirst({
          where: { tenantId: input.tenantId, name: examName }
        })
        if (!exam) {
          exam = await tx.exam.create({
            data: {
              tenantId: input.tenantId,
              name: examName,
              date: new Date(),
              type: 'Grading'
            }
          })
        }

        const existingScore = await tx.score.findFirst({
          where: {
            tenantId: input.tenantId,
            examId: exam.id,
            studentId: studentRecord.id,
            subject: assignment.subject
          }
        })

        if (existingScore) {
          await tx.score.update({
            where: { id: existingScore.id },
            data: {
              value: totalScore,
              updatedBy: input.actorId ?? 'system',
              sourceEventId: scoreEventId
            }
          })
        } else {
          await tx.score.create({
            data: {
              tenantId: input.tenantId,
              value: totalScore,
              subject: assignment.subject,
              studentId: studentRecord.id,
              examId: exam.id,
              updatedBy: input.actorId ?? 'system',
              sourceEventId: scoreEventId
            }
          })
        }
      }

      return submission
    }

    // 自动判分（仅客观题）
    if (input.answers && input.answers.length > 0) {
      const keys = await tx.answerKey.findMany({
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

      await tx.gradingResult.create({
        data: {
          tenantId: input.tenantId,
          submissionId: submission.id,
          objectiveScore,
          subjectiveScore: 0,
          totalScore: objectiveScore,
          details: JSON.stringify(details)
        }
      })

      await tx.submission.update({
        where: { id: submission.id },
        data: {
          status: 'DONE',
          totalScore: objectiveScore
        }
      })
    }

    return submission
  })
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
