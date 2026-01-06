import fs from 'fs'
import path from 'path'
import prisma from '../utils/prisma'

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

interface CliOptions {
  file: string
  tenant: string
  dryRun: boolean
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

function parseArgs(): CliOptions {
  const args = process.argv.slice(2)
  let file = ''
  let tenant = 'default'
  let dryRun = false

  for (let i = 0; i < args.length; i++) {
    const arg = args[i]
    if (arg === '--file' && args[i + 1]) {
      file = args[i + 1]
      i++
    } else if (arg === '--tenant' && args[i + 1]) {
      tenant = args[i + 1]
      i++
    } else if (arg === '--dry-run') {
      dryRun = true
    }
  }

  if (!file) {
    throw new Error('请通过 --file 指定学生数据文件路径（支持 UTF-8 TSV/伪 XLS）。')
  }

  return { file, tenant, dryRun }
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

  const requiredCols = [COLUMN_MAP.studentId, COLUMN_MAP.name]
  for (const col of requiredCols) {
    if (headerIndex[col] === undefined) {
      throw new Error(`缺少必需列: ${col}`)
    }
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

    if (!row.studentId || !row.name) {
      console.warn(`第 ${i + 1} 行缺少学号或姓名，已跳过。`)
      continue
    }

    rows.push(row)
  }

  return rows
}

async function importStudents(rows: StudentRow[], tenantId: string, dryRun: boolean) {
  let created = 0
  let updated = 0

  for (const row of rows) {
    const className = row.grade
      ? `${row.grade}${row.classNo ? `-${row.classNo}` : ''}`
      : row.classNo || ''

    if (dryRun) {
      // Dry-run mode: just simulate
      continue
    }

    const existing = await prisma.student.findUnique({
      where: { tenantId_studentId: { tenantId, studentId: row.studentId } }
    })

    if (!existing) {
      await prisma.student.create({
        data: {
          tenantId,
          studentId: row.studentId,
          name: row.name,
          class: className
        }
      })
      created++
    } else {
      await prisma.student.update({
        where: { id: existing.id },
        data: {
          name: row.name,
          class: className
        }
      })
      updated++
    }
  }

  return { created, updated }
}

async function main() {
  const { file, tenant, dryRun } = parseArgs()
  const absPath = path.resolve(process.cwd(), file)
  console.log(`[students] 读取文件: ${absPath}`)

  const rows = parseTsv(absPath)
  console.log(`[students] 解析完成，记录数: ${rows.length}`)

  const { created, updated } = await importStudents(rows, tenant, dryRun)
  console.log(
    dryRun
      ? `[students] Dry run 完成（未写入数据库）`
      : `[students] 导入完成: 新增 ${created} 条，更新 ${updated} 条`
  )
}

main()
  .catch((err) => {
    console.error('[students] 导入失败:', err)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
