import fs from 'fs'
import path from 'path'
import dotenv from 'dotenv'
import prisma from '../utils/prisma'

dotenv.config()

interface FileGroup {
  id: string
  name: string
  icon: string
  order: number
}

interface FileEntry {
  id: string
  name: string
  description: string
  icon?: string
  iconName?: string
  tags?: string[]
  url: string
  status: string
  featured?: boolean
  group: string
  usage?: number
  order?: number
}

interface CliOptions {
  file: string
  tenant: string
}

function parseArgs(): CliOptions {
  const args = process.argv.slice(2)
  let file = ''
  let tenant = 'default'

  for (let i = 0; i < args.length; i++) {
    const arg = args[i]
    if (arg === '--file' && args[i + 1]) {
      file = args[i + 1]
      i++
    } else if (arg === '--tenant' && args[i + 1]) {
      tenant = args[i + 1]
      i++
    }
  }

  if (!file) {
    file = path.resolve(__dirname, '../../../iai-teaching-portal/public/config/entries.json')
    console.log(`[entries] 未指定 --file，使用默认文件: ${file}`)
  }

  return { file, tenant }
}

function loadFile(filePath: string): { groups: FileGroup[]; entries: FileEntry[] } {
  const raw = fs.readFileSync(filePath, 'utf8')
  const json = JSON.parse(raw)
  if (!json.groups || !json.entries) {
    throw new Error('文件缺少 groups 或 entries 字段')
  }
  return { groups: json.groups, entries: json.entries }
}

async function importEntries(groups: FileGroup[], entries: FileEntry[], tenantId: string) {
  const groupIds = groups.map((g) => g.id)
  const entryIds = entries.map((e) => e.id)

  await prisma.$transaction(async (tx) => {
    // 先删除不在文件内的 entries，再删 group
    await tx.entry.deleteMany({
      where: { id: { notIn: entryIds } }
    })
    await tx.group.deleteMany({
      where: { id: { notIn: groupIds } }
    })

    // Upsert groups
    for (const g of groups) {
      await tx.group.upsert({
        where: { id: g.id },
        update: { name: g.name, icon: g.icon, order: g.order },
        create: { id: g.id, name: g.name, icon: g.icon, order: g.order }
      })
    }

    // Upsert entries
    for (const e of entries) {
      await tx.entry.upsert({
        where: { id: e.id },
        update: {
          name: e.name,
          description: e.description,
          icon: e.icon || e.iconName || '',
          url: e.url,
          status: e.status,
          featured: !!e.featured,
          order: e.order ?? 0,
          usage: e.usage ?? 0,
          groupId: e.group,
          tags: Array.isArray(e.tags) ? e.tags.join(',') : e.tags
        },
        create: {
          id: e.id,
          name: e.name,
          description: e.description,
          icon: e.icon || e.iconName || '',
          url: e.url,
          status: e.status,
          featured: !!e.featured,
          order: e.order ?? 0,
          usage: e.usage ?? 0,
          groupId: e.group,
          tags: Array.isArray(e.tags) ? e.tags.join(',') : e.tags
        }
      })
    }
  })
}

async function main() {
  const { file, tenant } = parseArgs()
  const abs = path.resolve(process.cwd(), file)
  console.log(`[entries] 读取文件: ${abs}`)
  const { groups, entries } = loadFile(abs)
  console.log(`[entries] 将写入 groups=${groups.length}, entries=${entries.length}`)
  await importEntries(groups, entries, tenant)
  console.log('[entries] 导入完成，数据已同步到数据库')
}

main()
  .catch((err) => {
    console.error('[entries] 导入失败:', err)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
