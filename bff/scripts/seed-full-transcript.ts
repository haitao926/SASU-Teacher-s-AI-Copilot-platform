import prisma from '../src/utils/prisma'

async function main() {
  const tenantId = 'default'
  const studentId = '2024010101'
  
  // 1. Ensure Student exists
  let student = await prisma.student.findUnique({
    where: { tenantId_studentId: { tenantId, studentId } }
  })

  if (!student) {
    student = await prisma.student.create({
      data: {
        tenantId,
        studentId,
        name: '陈牧心',
        class: '高三(1)班' // Updated to Senior 3
      }
    })
    console.log('Created student: 陈牧心')
  } else {
    // Update class info
    await prisma.student.update({
      where: { id: student.id },
      data: { class: '高三(1)班' }
    })
  }

  // 2. Clear existing scores for this student to avoid duplicates/mess
  await prisma.score.deleteMany({
    where: { tenantId, studentId: student.id }
  })
  console.log('Cleared old scores')

  // 3. Define Exam Timeline (High School 3 Years)
  // Assume current is 2026 (Grade 3 finish)
  const examsConfig = [
    // Grade 1 (2023-2024)
    { name: '2023-2024 高一上学期期中考试', date: '2023-11-10', type: 'Midterm' },
    { name: '2023-2024 高一上学期期末考试', date: '2024-01-15', type: 'Final' },
    { name: '2023-2024 高一下学期期中考试', date: '2024-04-20', type: 'Midterm' },
    { name: '2023-2024 高一下学期期末考试', date: '2024-07-05', type: 'Final' },
    
    // Grade 2 (2024-2025)
    { name: '2024-2025 高二上学期月考(10月)', date: '2024-10-12', type: 'Monthly' },
    { name: '2024-2025 高二上学期期中考试', date: '2024-11-15', type: 'Midterm' },
    { name: '2024-2025 高二上学期期末考试', date: '2025-01-20', type: 'Final' },
    { name: '2024-2025 高二下学期期中考试', date: '2025-04-18', type: 'Midterm' },
    { name: '2024-2025 高二下学期期末学业水平测试', date: '2025-06-30', type: 'Final' },

    // Grade 3 (2025-2026)
    { name: '2025-2026 高三上学期期中联考', date: '2025-11-08', type: 'Midterm' },
    { name: '2025-2026 高三上学期一模考试', date: '2026-01-10', type: 'Mock' },
    { name: '2025-2026 高三下学期二模考试', date: '2026-04-05', type: 'Mock' },
    { name: '2025-2026 高三下学期三模考试', date: '2026-05-20', type: 'Mock' }
  ]

  const subjects = ['语文', '数学', '英语', '物理', '化学', '生物', '政治', '历史', '地理']
  
  // Helper to generate score with some trend
  // Base ability: 85. Fluctuation: +/- 10.
  const getScore = () => Math.min(150, Math.max(60, Math.floor(85 + (Math.random() * 20 - 10)))) 
  // Note: Standard score is 100 or 150. Let's assume 100 for simplicity or mix.
  // Let's assume 100 scale for all except maybe Yu/Shu/Ying which are 150 in Gaokao? 
  // Let's stick to 100 scale for simplicity in this demo to avoid confusion.

  const createdExams = []

  for (const cfg of examsConfig) {
    // Upsert Exam
    const exam = await prisma.exam.upsert({
      where: { tenantId_name: { tenantId, name: cfg.name } },
      update: { date: new Date(cfg.date), type: cfg.type },
      create: {
        tenantId,
        name: cfg.name,
        date: new Date(cfg.date),
        type: cfg.type
      }
    })
    createdExams.push(exam)

    // Create Scores
    for (const sub of subjects) {
      // Simulate: Physics/Math are harder, Scores slightly lower
      let base = 85
      if (['数学', '物理'].includes(sub)) base = 80
      if (['语文', '英语'].includes(sub)) base = 90
      
      // Random variation
      const val = Math.min(100, Math.max(50, Math.floor(base + (Math.random() * 25 - 12))))

      await prisma.score.create({
        data: {
          tenantId,
          studentId: student.id,
          examId: exam.id,
          subject: sub,
          value: val,
          updatedBy: 'system'
        }
      })
    }
  }
  
  console.log(`Successfully generated ${createdExams.length} exams and transcript data for ${student.name}`)
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect())
