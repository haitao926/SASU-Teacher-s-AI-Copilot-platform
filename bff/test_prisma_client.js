// Temporary test script to verify Prisma Client
const { PrismaClient } = require('@prisma/client')
const prisma = new PrismaClient()

async function main() {
  console.log('Checking prisma client...')
  const dmmf = PrismaClient.dmmf
  console.log('Models:', dmmf.datamodel.models.map(m => m.name))
}

main()
  .catch(e => console.error(e))
  .finally(async () => await prisma.$disconnect())