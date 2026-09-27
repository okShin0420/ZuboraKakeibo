import { mkdirSync, readFileSync, readdirSync } from 'node:fs'
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

const migrationsFor = targetDialect => readdirSync(resolve(backendRoot, 'migrations', targetDialect))
  .map(name => {
    const match = name.match(/^(\d+)_.*\.(up|down)\.sql$/)
    return match ? { version: Number(match[1]), direction: match[2], name } : null
  })
  .filter(Boolean)
  .reduce((migrations, migration) => {
    if (migration.direction === 'up') migrations.push(migration)
    return migrations
  }, [])
  .sort((left, right) => left.version - right.version)

const readMigration = (targetDialect, version, migrationDirection) => {
  const migration = migrationsFor(targetDialect).find(candidate => candidate.version === version)
  if (!migration) throw new Error(`マイグレーション ${version} が見つかりません`)
  const fileName = migration.name.replace('.up.sql', `.${migrationDirection}.sql`)
  return readFileSync(resolve(backendRoot, 'migrations', targetDialect, fileName), 'utf8')
}

if (dialect === 'sqlite') {
  const configuredPath = process.env.SQLITE_PATH ?? './data/zubora-kakeibo.sqlite'
  const databasePath = resolve(process.cwd(), configuredPath)
  mkdirSync(dirname(databasePath), { recursive: true })
  const database = new DatabaseSync(databasePath)

  try {
    database.exec('PRAGMA foreign_keys = ON;')
    const currentVersion = database.prepare('PRAGMA user_version').get().user_version
    const migrations = migrationsFor('sqlite')
    const latestVersion = migrations.at(-1)?.version ?? 0
    if (currentVersion > latestVersion) throw new Error(`SQLiteのスキーマバージョン ${currentVersion} に対応するマイグレーションがありません`)

    if (direction === 'up') {
      const pending = migrations.filter(migration => migration.version > currentVersion)
      for (const migration of pending) {
        database.exec(readMigration('sqlite', migration.version, 'up'))
        console.log(`SQLite migration ${migration.version} up completed: ${databasePath}`)
      }
      if (pending.length === 0) console.log(`SQLite migration is already up to date: ${databasePath}`)
    } else if (currentVersion === 0) {
      console.log(`SQLite migration is already at version 0: ${databasePath}`)
    } else {
      database.exec(readMigration('sqlite', currentVersion, 'down'))
      console.log(`SQLite migration ${currentVersion} down completed: ${databasePath}`)
    }

    const foreignKeyViolations = database.prepare('PRAGMA foreign_key_check').all()
    if (foreignKeyViolations.length > 0) throw new Error('SQLite外部キー整合性チェックに失敗しました')
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
    await client.query(readMigration('postgresql', 1, direction))
    console.log(`PostgreSQL migration ${direction} completed`)
  } catch (error) {
    await client.query('ROLLBACK').catch(() => undefined)
    throw error
  } finally {
    await client.end()
  }
}
