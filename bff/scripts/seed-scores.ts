import prisma from '../src/utils/prisma'

async function main() {
  const tenantId = 'default'
  
  // 1. Create Student
  let student = await prisma.student.findUnique({
    where: { tenantId_studentId: { tenantId, studentId: '2024010101' } }
  })

  if (!student) {
    student = await prisma.student.create({
      data: {
        tenantId,
        studentId: '2024010101',
        name: '陈牧心',
        class: '201'
      }
    })
    console.log('Created student: 陈牧心')
  }

  // 2. Create Exams
  const examsData = [
    { name: '2025-2026 第一学期期中考试', date: new Date('2025-11-10'), type: 'Midterm' },
    { name: '2025-2026 第一学期期末考试', date: new Date('2026-01-15'), type: 'Final' },
    { name: '2025年10月月考', date: new Date('2025-10-15'), type: 'Quiz' }
  ]

  const exams = []
  for (const e of examsData) {
    const exam = await prisma.exam.upsert({
      where: { tenantId_name: { tenantId, name: e.name } },
      update: {},
      create: { tenantId, ...e }
    })
    exams.push(exam)
  }
  console.log(`Ensured ${exams.length} exams exist`)

  // 3. Create Scores
  const subjects = ['语文', '数学', '英语', '物理', '历史', '道法']
  
  // Helper to generate random score
  const randScore = (min: number, max: number) => Math.floor(Math.random() * (max - min + 1)) + min

  for (const exam of exams) {
    for (const subject of subjects) {
      // Check if score exists
      const exists = await prisma.score.findFirst({
        where: {
          tenantId,
          studentId: student!.id,
          examId: exam.id,
          subject
        }
      })

      if (!exists) {
        await prisma.score.create({
          data: {
            tenantId,
            studentId: student!.id,
            examId: exam.id,
            subject,
            value: randScore(70, 100),
            updatedBy: 'system'
          }
        })
      }
    }
  }
  
  console.log(`Seeded scores for 陈牧心 in ${exams.length} exams`)
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect())
