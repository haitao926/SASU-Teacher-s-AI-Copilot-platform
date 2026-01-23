import { PrismaClient } from '@prisma/client'
import path from 'path'

const dbUrl = process.env.DATABASE_URL
if (dbUrl?.startsWith('file:./')) {
  // 将相对路径转换为绝对路径，指向 prisma 目录下的数据库文件
  const relative = dbUrl.replace('file:./', '')
  const resolved = 'file:' + path.resolve(__dirname, '..', '..', 'prisma', relative)
  process.env.DATABASE_URL = resolved
}

const prisma = new PrismaClient()

export default prisma
