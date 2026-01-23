import fs from 'fs'
import path from 'path'
import dotenv from 'dotenv'
import { PrismaClient } from '@prisma/client'

dotenv.config()

const prisma = new PrismaClient()

interface StudentRow {
  studentId: string
  name: string
  grade?: string
  classNo?: string
  entryYear?: string
  gender?: string
  address?: string
  phone?: string
  parentName?: string
  homeroomTeacher?: string
}

const COLUMN_MAP: Record<keyof StudentRow, string> = {
  studentId: '学号',
  entryYear: '入学年度',
  grade: '年级',
  classNo: '班级',
  name: '姓名',
  gender: '性别',
  address: '家庭住址',
  phone: '联系电话',
  parentName: '家长姓名',
  homeroomTeacher: '班主任'
}

function parseTsv(filePath: string): StudentRow[] {
  const content = fs.readFileSync(filePath, 'utf8')
  const lines = content.split(/\r?\n/).filter((line) => line.trim().length > 0)
  if (lines.length === 0) return []

  const headers = lines[0].split('\t').map((h) => h.trim())
  const headerIndex: Record<string, number> = {}
  headers.forEach((h, idx) => {
    headerIndex[h] = idx
  })

  // Basic validation
  if (headerIndex[COLUMN_MAP.studentId] === undefined || headerIndex[COLUMN_MAP.name] === undefined) {
    console.warn('TSV Missing required columns (studentId/name). Headers found:', headers)
    return []
  }

  const rows: StudentRow[] = []
  for (let i = 1; i < lines.length; i++) {
    const cols = lines[i].split('\t')
    const row: StudentRow = {
      studentId: cols[headerIndex[COLUMN_MAP.studentId]]?.trim(),
      name: cols[headerIndex[COLUMN_MAP.name]]?.trim()
    }

    for (const [key, colName] of Object.entries(COLUMN_MAP)) {
      if (key === 'studentId' || key === 'name') continue
      const idx = headerIndex[colName]
      if (idx !== undefined) {
        row[key as keyof StudentRow] = cols[idx]?.trim()
      }
    }

    if (row.studentId && row.name) {
      rows.push(row)
    }
  }

  return rows
}

async function main() {
  console.log('--- Starting Transcript Demo Setup ---')

  // 1. Import Students from TSV
  const tsvPath = path.resolve(process.cwd(), '../asset/StudentsToExcel2026-1-6.xls') // It's TSV
  console.log(`Reading students from ${tsvPath}...`)
  
  let rows: StudentRow[] = []
  try {
    rows = parseTsv(tsvPath)
    console.log(`Parsed ${rows.length} students.`)
  } catch (e) {
    console.error('Error reading TSV:', e)
  }

  console.log('Upserting students to DB...')
  for (const row of rows) {
    const className = row.grade
      ? `${row.grade}${row.classNo ? `-${row.classNo}` : ''}`
      : row.classNo || 'Unknown'
    
    await prisma.student.upsert({
      where: { tenantId_studentId: { tenantId: 'default', studentId: row.studentId } },
      update: {
        name: row.name,
        class: className
      },
      create: {
        tenantId: 'default',
        studentId: row.studentId,
        name: row.name,
        class: className
      }
    })
  }
  console.log('Bulk student import done.')

  // 2. Add "Li Shishi" (李世石)
  console.log('Ensuring Li Shishi exists...')
  const liShishi = await prisma.student.upsert({
    where: { tenantId_studentId: { tenantId: 'default', studentId: '2026999999' } },
    update: {
      name: '李世石',
      class: '7-1'
    },
    create: {
      tenantId: 'default',
      studentId: '2026999999',
      name: '李世石',
      class: '7-1'
    }
  })
  console.log('Li Shishi ID:', liShishi.id)

  // 3. Create Sample Exams
  console.log('Creating exams...')
  const exams = [
    { name: '2025 Fall Midterm', date: new Date('2025-11-10'), type: 'Midterm' },
    { name: '2025 Fall Final', date: new Date('2026-01-15'), type: 'Final' }
  ]

  const examRecords = []
  for (const e of exams) {
    const exam = await prisma.exam.upsert({
      where: { tenantId_name: { tenantId: 'default', name: e.name } },
      update: {},
      create: {
        tenantId: 'default',
        name: e.name,
        date: e.date,
        type: e.type
      }
    })
    examRecords.push(exam)
  }

  // 4. Add Scores for Li Shishi
  console.log('Adding scores for Li Shishi...')
  const subjects = ['Chinese', 'Math', 'English', 'Physics', 'Chemistry', 'Biology', 'History']
  
  // Clear existing scores for this student to avoid duplicates in this demo run
  await prisma.score.deleteMany({
    where: { studentId: liShishi.id }
  })

  for (const exam of examRecords) {
    for (const subject of subjects) {
      // Generate somewhat realistic scores (70-100)
      const scoreValue = Math.floor(Math.random() * 31) + 70 
      
      await prisma.score.create({
        data: {
          tenantId: 'default',
          value: scoreValue,
          subject: subject,
          studentId: liShishi.id,
          examId: exam.id
        }
      })
    }
  }

  console.log('--- Setup Complete ---')
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
