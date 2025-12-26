const fs = require('fs')
const path = require('path')

async function main() {
  const buildServer = require('../dist/main.js').default
  const app = await buildServer()
  await app.ready()

  const res = await app.inject({
    method: 'GET',
    url: '/docs/json'
  })

  if (res.statusCode !== 200) {
    throw new Error(`failed to fetch openapi, status ${res.statusCode}`)
  }

  const outPath = path.join(__dirname, '..', 'openapi.json')
  fs.writeFileSync(outPath, res.body, 'utf8')
  // eslint-disable-next-line no-console
  console.log(`openapi.json written to ${outPath}`)

  await app.close()
}

main().catch((err) => {
  // eslint-disable-next-line no-console
  console.error(err)
  process.exit(1)
})
