import prisma from '../../utils/prisma'

export interface ScoreUploadItem {
  studentName: string
  studentId: string
  className: string
  examName: string
  subject: string
  score: number
}

export async function importScores(
  items: ScoreUploadItem[],
  tenantId: string,
  operatorId: string,
  ip: string,
  userAgent?: string
) {
  if (!items || items.length === 0) {
    throw new Error('No data provided')
  }

  const result = await prisma.$transaction(async (tx) => {
    let createdScores = 0

    for (const item of items) {
      let student = await tx.student.findUnique({
        where: { tenantId_studentId: { tenantId, studentId: item.studentId } }
      })

      if (!student) {
        student = await tx.student.create({
          data: {
            tenantId,
            studentId: item.studentId,
            name: item.studentName,
            class: item.className
          }
        })
      }

      let exam = await tx.exam.findFirst({
        where: { tenantId, name: item.examName }
      })

      if (!exam) {
        exam = await tx.exam.create({
          data: {
            tenantId,
            name: item.examName,
            date: new Date(),
            type: 'Imported'
          }
        })
      }

      await tx.score.create({
        data: {
          tenantId,
          value: item.score,
          subject: item.subject,
          studentId: student.id,
          examId: exam.id,
          updatedBy: operatorId
        }
      })
      createdScores++
    }

    await tx.auditLog.create({
      data: {
        operatorId,
        action: 'IMPORT_SCORES',
        resource: 'Score',
        details: JSON.stringify({
          count: createdScores,
          examName: items[0].examName,
          sampleStudent: items[0].studentName
        }),
        ipAddress: ip,
        userAgent
      }
    })

    return createdScores
  })

  return result
}

export async function getScoreStats(tenantId: string, userId: string) {
  const [studentCount, examCount, scoreCount] = await Promise.all([
    prisma.student.count({ where: { tenantId } }),
    prisma.exam.count({ where: { tenantId } }),
    prisma.score.count({ where: { tenantId } })
  ])

  const lastExam = await prisma.exam.findFirst({
    where: { tenantId },
    orderBy: { date: 'desc' },
    include: { scores: true }
  })

  let average = 0
  if (lastExam && lastExam.scores.length > 0) {
    const sum = lastExam.scores.reduce((acc, curr) => acc + curr.value, 0)
    average = sum / lastExam.scores.length
  }

  return {
    overview: {
      students: studentCount,
      exams: examCount,
      totalScores: scoreCount
    },
    recent: lastExam
      ? {
          name: lastExam.name,
          average: Number(average.toFixed(1))
        }
      : null
  }
}

export async function listStudents(tenantId: string, className?: string) {
  return prisma.student.findMany({
    where: {
      tenantId,
      class: className || undefined
    },
    orderBy: [
      { class: 'asc' },
      { name: 'asc' }
    ]
  })
}

export async function listExams(tenantId: string) {
  return prisma.exam.findMany({
    where: { tenantId },
    orderBy: { date: 'desc' }
  })
}

interface ListScoresParams {
  tenantId: string
  examId?: string
  className?: string
  subject?: string
  limit?: number
  offset?: number
}

export async function listScores(params: ListScoresParams) {
  const limit = Math.min(Math.max(params.limit ?? 50, 1), 200)
  const offset = Math.max(params.offset ?? 0, 0)

  const where: any = {
    tenantId: params.tenantId
  }
  if (params.examId) where.examId = params.examId
  if (params.subject) where.subject = params.subject

  const [items, total] = await prisma.$transaction([
    prisma.score.findMany({
      where,
      include: {
        student: true,
        exam: true
      },
      orderBy: { updatedAt: 'desc' },
      skip: offset,
      take: limit
    }),
    prisma.score.count({ where })
  ])

  // 额外按班级过滤（基于关联）
  const filteredItems = params.className
    ? items.filter((item) => item.student.class === params.className)
    : items

  return {
    items: filteredItems,
    total: params.className ? filteredItems.length : total,
    limit,
    offset
  }
}

interface ScoreSummaryParams {
  tenantId: string
  examId: string
  className?: string
}

export async function getScoreSummary(params: ScoreSummaryParams) {
  const scores = await prisma.score.findMany({
    where: {
      tenantId: params.tenantId,
      examId: params.examId
    },
    include: { student: true }
  })

  const filtered = params.className
    ? scores.filter((s) => s.student.class === params.className)
    : scores

  const total = filtered.length
  if (total === 0) {
    return { total: 0, average: 0, max: 0, min: 0 }
  }

  const values = filtered.map((s) => s.value)
  const sum = values.reduce((acc, v) => acc + v, 0)
  const average = sum / total
  return {
    total,
    average: Number(average.toFixed(2)),
    max: Math.max(...values),
    min: Math.min(...values)
  }
}

export async function getStudentTrend(tenantId: string, studentId: string) {
  return prisma.score.findMany({
    where: { tenantId, studentId },
    include: { exam: true },
    orderBy: {
      exam: { date: 'asc' }
    }
  })
}

interface ScoreExportParams {
  tenantId: string
  examId: string
  className?: string
}

export async function getScoresForExport(params: ScoreExportParams) {
  const scores = await prisma.score.findMany({
    where: {
      tenantId: params.tenantId,
      examId: params.examId
    },
    include: {
      student: true,
      exam: true
    },
    orderBy: [
      { subject: 'asc' },
      { student: { class: 'asc' } },
      { student: { name: 'asc' } }
    ]
  })

  const filtered = params.className
    ? scores.filter((s) => s.student.class === params.className)
    : scores

  return filtered.map((item) => ({
    examName: item.exam.name,
    class: item.student.class,
    studentId: item.student.studentId,
    studentName: item.student.name,
    subject: item.subject,
    score: item.value
  }))
}
