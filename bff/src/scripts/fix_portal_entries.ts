import prisma from '../utils/prisma'

async function main() {
  console.log('--- Checking Portal Groups ---')
  
  // 1. Find the 'Insights' group
  let group = await prisma.group.findFirst({
    where: {
      OR: [
        { name: '学情洞察' },
        { name: 'Academic Insight' } // fallback
      ]
    }
  })

  if (!group) {
    console.log('Group "学情洞察" not found. Listing all groups to help debug:')
    const allGroups = await prisma.group.findMany()
    allGroups.forEach(g => console.log(`- ${g.name} (${g.id})`))
    return
  }

  console.log(`Found Group: ${group.name} (${group.id})`)

  // 2. Check if the entry already exists
  const entryUrl = '/apps/assessment-data-manager'
  const existingEntry = await prisma.entry.findFirst({
    where: {
      OR: [
        { url: entryUrl },
        { name: '测评数据管理' }
      ]
    }
  })

  if (existingEntry) {
    console.log(`Entry already exists: ${existingEntry.name} (ID: ${existingEntry.id})`)
    // Optional: Update it to ensure it's correct
    await prisma.entry.update({
      where: { id: existingEntry.id },
      data: {
        name: '测评数据管理',
        description: '集中管理考试数据，支持批量上传、解析与维护',
        icon: 'gradient-teal',
        url: entryUrl,
        groupId: group.id,
        status: 'new',
        order: 0 // Make it first
      }
    })
    console.log('Entry updated to ensure correct configuration.')
  } else {
    // 3. Create the entry
    const newEntry = await prisma.entry.create({
      data: {
        name: '测评数据管理',
        description: '集中管理考试数据，支持批量上传、解析与维护',
        icon: 'gradient-teal',
        url: entryUrl,
        status: 'new',
        tags: '数据,管理,上传',
        groupId: group.id,
        order: 0
      }
    })
    console.log(`Successfully created Entry: ${newEntry.name} (ID: ${newEntry.id})`)
  }
}

main()
  .catch(e => {
    console.error('Error:', e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
