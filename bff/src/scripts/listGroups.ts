import prisma from '../utils/prisma'

async function main() {
  const groups = await prisma.group.findMany()
  console.log('Groups:', JSON.stringify(groups, null, 2))
}

main()
  .catch(e => console.error(e))
  .finally(async () => {
    await prisma.$disconnect()
  })
