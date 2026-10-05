import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import test from 'node:test'
import { DatabaseSync } from 'node:sqlite'
import { fileURLToPath } from 'node:url'

const backendRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const migration = (dialect, version, direction) => readFileSync(
  resolve(backendRoot, 'migrations', dialect, `${String(version).padStart(3, '0')}_${version === 1 ? 'initial' : 'expand_budget_cycle_start_day'}.${direction}.sql`),
  'utf8',
)

const expectedColumns = {
  app_settings: ['id', 'monthly_notification_enabled', 'timezone', 'created_at', 'updated_at'],
  budget_cycle_rules: ['id', 'start_day', 'adjust_for_weekends_and_holidays', 'effective_from', 'effective_to', 'created_at', 'updated_at'],
  budget_periods: ['id', 'cycle_rule_id', 'label_month', 'start_date', 'nominal_end_date', 'end_date', 'budget_amount', 'created_at', 'updated_at'],
  expenses: ['id', 'budget_period_id', 'spent_on', 'amount', 'memo', 'created_at', 'updated_at'],
  holiday_calendar_coverage: ['calendar_year', 'source', 'imported_at'],
  holidays: ['holiday_date', 'calendar_year', 'name', 'source', 'created_at'],
}

const ids = {
  rule: '11111111-1111-4111-8111-111111111111',
  period: '22222222-2222-4222-8222-222222222222',
  expense: '33333333-3333-4333-8333-333333333333',
}
const timestamp = '2026-09-22T00:00:00.000Z'

function createSqliteAdapter() {
  const database = new DatabaseSync(':memory:')
  database.exec('PRAGMA foreign_keys = ON;')
  database.exec(migration('sqlite', 1, 'up'))
  return {
    bool: value => value ? 1 : 0,
    run: async (sql, values = []) => database.prepare(sql).run(...values),
    one: async (sql, values = []) => database.prepare(sql).get(...values),
    columns: async table => database.prepare(`PRAGMA table_info(${table})`).all().map(column => column.name),
    rollback: async () => {
      database.exec(migration('sqlite', 1, 'down'))
    },
    close: async () => database.close(),
  }
}

const postgresParameters = sql => {
  let index = 0
  return sql.replace(/\?/g, () => `$${++index}`)
}

async function runContract(adapter) {
  await adapter.run(
    'INSERT INTO app_settings (id, monthly_notification_enabled, timezone, created_at, updated_at) VALUES (?, ?, ?, ?, ?)',
    [1, adapter.bool(true), 'Asia/Tokyo', timestamp, timestamp],
  )
  await adapter.run(
    `INSERT INTO budget_cycle_rules
      (id, start_day, adjust_for_weekends_and_holidays, effective_from, effective_to, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [ids.rule, 1, adapter.bool(true), '2026-09-01', null, timestamp, timestamp],
  )
  await adapter.run(
    `INSERT INTO budget_periods
      (id, cycle_rule_id, label_month, start_date, nominal_end_date, end_date, budget_amount, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [ids.period, ids.rule, '2026-09-01', '2026-09-01', '2026-09-30', '2026-09-30', 50000, timestamp, timestamp],
  )
  await adapter.run(
    `INSERT INTO expenses
      (id, budget_period_id, spent_on, amount, memo, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [ids.expense, ids.period, '2026-09-21', 1200, '日用品', timestamp, timestamp],
  )

  const summary = await adapter.one(
    'SELECT budget_amount, spent_amount, remaining_amount, expense_count FROM budget_period_summary WHERE budget_period_id = ?',
    [ids.period],
  )
  assert.deepEqual(
    Object.fromEntries(Object.entries(summary).map(([key, value]) => [key, Number(value)])),
    { budget_amount: 50000, spent_amount: 1200, remaining_amount: 48800, expense_count: 1 },
  )

  await assert.rejects(
    adapter.run(
      `INSERT INTO expenses
        (id, budget_period_id, spent_on, amount, memo, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      ['44444444-4444-4444-8444-444444444444', ids.period, '2026-09-22', 0, null, timestamp, timestamp],
    ),
  )
  await assert.rejects(
    adapter.run(
      `INSERT INTO expenses
        (id, budget_period_id, spent_on, amount, memo, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      ['55555555-5555-4555-8555-555555555555', ids.period, '2026-09-22', 100, 'あ'.repeat(121), timestamp, timestamp],
    ),
  )
  await assert.rejects(
    adapter.run(
      `INSERT INTO expenses
        (id, budget_period_id, spent_on, amount, memo, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      ['66666666-6666-4666-8666-666666666666', '99999999-9999-4999-8999-999999999999', '2026-09-22', 100, null, timestamp, timestamp],
    ),
  )
}

test('SQLiteの初期スキーマと共通契約', async () => {
  const adapter = createSqliteAdapter()
  try {
    for (const [table, columns] of Object.entries(expectedColumns)) {
      assert.deepEqual(await adapter.columns(table), columns)
    }
    await runContract(adapter)
    await adapter.run('UPDATE budget_cycle_rules SET start_day = ? WHERE id = ?', [31, ids.rule])
    assert.equal((await adapter.one('SELECT start_day FROM budget_cycle_rules WHERE id = ?', [ids.rule])).start_day, 31)
    await assert.rejects(adapter.run('UPDATE budget_cycle_rules SET start_day = ? WHERE id = ?', [32, ids.rule]))
    await adapter.run('UPDATE budget_cycle_rules SET start_day = ? WHERE id = ?', [1, ids.rule])
    await adapter.rollback()
    assert.equal((await adapter.one('PRAGMA user_version')).user_version, 0)
    assert.equal((await adapter.one("SELECT COUNT(*) AS count FROM sqlite_master WHERE type = 'table' AND name = 'expenses'")).count, 0)
  } finally {
    await adapter.close()
  }
})

test('SQLite v1は31日を許可し、32日を拒否する', () => {
  const database = new DatabaseSync(':memory:')
  try {
    database.exec('PRAGMA foreign_keys = ON;')
    database.exec(migration('sqlite', 1, 'up'))
    database.prepare(
      `INSERT INTO budget_cycle_rules
        (id, start_day, adjust_for_weekends_and_holidays, effective_from, effective_to, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
    ).run(ids.rule, 28, 1, '2026-09-01', null, timestamp, timestamp)

    assert.equal(database.prepare('PRAGMA user_version').get().user_version, 1)
    assert.equal(database.prepare('SELECT start_day FROM budget_cycle_rules WHERE id = ?').get(ids.rule).start_day, 28)
    database.prepare('UPDATE budget_cycle_rules SET start_day = ? WHERE id = ?').run(31, ids.rule)
    assert.throws(() => database.prepare('UPDATE budget_cycle_rules SET start_day = ? WHERE id = ?').run(32, ids.rule))
  } finally {
    database.close()
  }
})

test('SQLite v1のロールバックは31日の設定も削除する', () => {
  const database = new DatabaseSync(':memory:')
  try {
    database.exec('PRAGMA foreign_keys = ON;')
    database.exec(migration('sqlite', 1, 'up'))
    database.prepare(
      `INSERT INTO budget_cycle_rules
        (id, start_day, adjust_for_weekends_and_holidays, effective_from, effective_to, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
    ).run(ids.rule, 31, 1, '2026-09-01', null, timestamp, timestamp)

    assert.equal(database.prepare('SELECT start_day FROM budget_cycle_rules WHERE id = ?').get(ids.rule).start_day, 31)
  } finally {
    database.close()
  }
})

const postgresUrl = process.env.TEST_DATABASE_URL

test('PostgreSQLの初期スキーマと共通契約', { skip: postgresUrl ? false : 'TEST_DATABASE_URL が未設定です' }, async () => {
  const { Client } = await import('pg')
  const client = new Client({ connectionString: postgresUrl })
  const schema = `zubora_test_${Date.now()}_${Math.random().toString(16).slice(2)}`
  await client.connect()

  try {
    await client.query(`CREATE SCHEMA "${schema}"`)
    await client.query(`SET search_path TO "${schema}"`)
    await client.query(migration('postgresql', 1, 'up'))
    const adapter = {
      bool: value => value,
      run: async (sql, values = []) => client.query(postgresParameters(sql), values),
      one: async (sql, values = []) => (await client.query(postgresParameters(sql), values)).rows[0],
      columns: async table => (await client.query(
        `SELECT column_name FROM information_schema.columns
         WHERE table_schema = $1 AND table_name = $2 ORDER BY ordinal_position`,
        [schema, table],
      )).rows.map(column => column.column_name),
    }
    for (const [table, columns] of Object.entries(expectedColumns)) {
      assert.deepEqual(await adapter.columns(table), columns)
    }
    await runContract(adapter)
    await client.query(migration('postgresql', 1, 'down'))
  } finally {
    await client.query('RESET search_path').catch(() => undefined)
    await client.query(`DROP SCHEMA IF EXISTS "${schema}" CASCADE`).catch(() => undefined)
    await client.end()
  }
})
