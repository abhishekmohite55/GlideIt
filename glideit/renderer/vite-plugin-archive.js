import { existsSync, mkdirSync, readFileSync, unlinkSync, writeFileSync } from 'fs'
import { resolve } from 'path'

const ARCHIVE_ID_REGEX = /^\/api\/archives\/([a-f0-9]+)$/

function resolveOutputDir() {
  // Allow override via env var, otherwise resolve relative to project root
  const envDir = process.env.GLIDEIT_OUTPUT_DIR
  if (envDir) return resolve(envDir)

  // Default: two levels up from renderer/ to project root, then glideit-out/
  return resolve(process.cwd(), '..', 'glideit-out')
}

function archivesDir(outputDir) {
  return resolve(outputDir, 'archives')
}

function indexFile(outputDir) {
  return resolve(archivesDir(outputDir), 'index.json')
}

function loadIndex(outputDir) {
  const idx = indexFile(outputDir)
  if (!existsSync(idx)) return []
  try {
    return JSON.parse(readFileSync(idx, 'utf-8'))
  } catch {
    return []
  }
}

function saveIndex(outputDir, index) {
  const dir = archivesDir(outputDir)
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true })
  writeFileSync(indexFile(outputDir), JSON.stringify(index, null, 2), 'utf-8')
}

export default function archivePlugin() {
  const outputDir = resolveOutputDir()

  return {
    name: 'vite-plugin-archive',
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        if (req.method !== 'DELETE') return next()

        const match = req.url.match(ARCHIVE_ID_REGEX)
        if (!match) return next()

        const archiveId = match[1]
        const index = loadIndex(outputDir)
        const entry = index.find(e => e.id === archiveId)

        if (!entry) {
          res.statusCode = 404
          res.setHeader('Content-Type', 'application/json')
          res.end(JSON.stringify({ error: 'Archive not found' }))
          return
        }

        const archivePath = resolve(archivesDir(outputDir), entry.filename)
        if (existsSync(archivePath)) unlinkSync(archivePath)

        saveIndex(outputDir, index.filter(e => e.id !== archiveId))

        res.statusCode = 200
        res.setHeader('Content-Type', 'application/json')
        res.end(JSON.stringify({ success: true }))
      })
    },
  }
}
