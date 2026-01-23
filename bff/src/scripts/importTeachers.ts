import fs from 'fs'
import path from 'path'
import dotenv from 'dotenv'
import prisma from '../utils/prisma'
import { hashPassword } from '../utils/password'

dotenv.config()

interface TeacherRow {
  username: string
  name: string
  role?: 'ADMIN' | 'TEACHER' | 'VIEWER'
  status?: 'ACTIVE' | 'DISABLED'
  password?: string
}

function parseArgs() {
  const args = process.argv.slice(2)
  let file = ''
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--file' && args[i + 1]) {
      file = args[i + 1]
      i++
    }
  }
  if (!file) {
    throw new Error('请通过 --file 指定教师数据文件，支持 CSV/TSV（含表头）')
  }
  return { file }
}

function parseDelimited(content: string): TeacherRow[] {
  const lines = content.split(/\r?\n/).filter((l) => l.trim().length > 0)
  if (lines.length === 0) return []
  const delimiter = lines[0].includes('\t') ? '\t' : ','
  const headers = lines[0].split(delimiter).map((h) => h.trim())
  const idx = (name: string) => headers.findIndex((h) => h === name)
  const rows: TeacherRow[] = []
  for (let i = 1; i < lines.length; i++) {
    const cols = lines[i].split(delimiter)
    const row: TeacherRow = {
      username: cols[idx('username')]?.trim(),
      name: cols[idx('name')]?.trim(),
      role: cols[idx('role')]?.trim() as any,
      status: cols[idx('status')]?.trim() as any,
      password: cols[idx('password')]?.trim()
    }
    if (!row.username || !row.name) {
      console.warn(`第 ${i + 1} 行缺少 username 或 name，已跳过`)
      continue
    }
    rows.push(row)
  }
  return rows
}

async function importTeachers(rows: TeacherRow[], tenantId: string) {
  let created = 0
  let updated = 0
  for (const row of rows) {
    const role = row.role && ['ADMIN', 'TEACHER', 'VIEWER'].includes(row.role) ? row.role : 'TEACHER'
    const status = row.status && ['ACTIVE', 'DISABLED'].includes(row.status) ? row.status : 'ACTIVE'
    const pwd = row.password || Math.random().toString(36).slice(2, 10)
    const existing = await prisma.user.findUnique({
      where: { tenantId_username: { tenantId, username: row.username } }
    })
    if (!existing) {
      await prisma.user.create({
        data: {
          tenantId,
          username: row.username,
          name: row.name,
          role,
          status,
          password: hashPassword(pwd)
        }
      })
      created++
      if (!row.password) {
        console.log(`创建 ${row.username} 初始密码: ${pwd}`)
      }
    } else {
      await prisma.user.update({
        where: { id: existing.id },
        data: {
          name: row.name,
          role,
          status,
          password: row.password ? hashPassword(row.password) : existing.password
        }
      })
      updated++
    }
  }
  return { created, updated }
}

async function main() {
  const { file } = parseArgs()
  const abs = path.resolve(process.cwd(), file)
  console.log('[teachers] 读取文件:', abs)
  const content = fs.readFileSync(abs, 'utf8')
  const rows = parseDelimited(content)
  console.log('[teachers] 解析记录:', rows.length)
  const { created, updated } = await importTeachers(rows, 'default')
  console.log(`[teachers] 导入完成: 新增 ${created}，更新 ${updated}`)
}

main()
  .catch((err) => {
    console.error('[teachers] 导入失败:', err)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
