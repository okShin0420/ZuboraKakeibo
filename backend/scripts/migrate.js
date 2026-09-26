import { mkdirSync, readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { DatabaseSync } from 'node:sqlite'

const backendRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const args = new Map()

for (let index = 2; index < process.argv.length; index += 2) {
  const key = process.argv[index]
  const value = process.argv[index + 1]
  if (!key?.startsWith('--') || !value) throw new Error(`引数が不正です: ${key ?? ''}`)
  args.set(key.slice(2), value)
}

const dialect = args.get('dialect')
const direction = args.get('direction')

if (!['sqlite', 'postgresql'].includes(dialect)) {
  throw new Error('--dialect には sqlite または postgresql を指定してください')
}

if (!['up', 'down'].includes(direction)) {
  throw new Error('--direction には up または down を指定してください')
}

const migrationPath = resolve(backendRoot, 'migrations', dialect, `001_initial.${direction}.sql`)
const sql = readFileSync(migrationPath, 'utf8')

if (dialect === 'sqlite') {
  const configuredPath = process.env.SQLITE_PATH ?? './data/zubora-kakeibo.sqlite'
  const databasePath = resolve(process.cwd(), configuredPath)
  mkdirSync(dirname(databasePath), { recursive: true })
  const database = new DatabaseSync(databasePath)

  try {
    database.exec('PRAGMA foreign_keys = ON;')
    database.exec(sql)
    console.log(`SQLite migration ${direction} completed: ${databasePath}`)
  } finally {
    database.close()
  }
} else {
  const connectionString = process.env.DATABASE_URL
  if (!connectionString) throw new Error('DATABASE_URL を設定してください')

  const { Client } = await import('pg')
  const client = new Client({ connectionString })
  await client.connect()

  try {
    await client.query(sql)
    console.log(`PostgreSQL migration ${direction} completed`)
  } catch (error) {
    await client.query('ROLLBACK').catch(() => undefined)
    throw error
  } finally {
    await client.end()
  }
}
