// backend/src/main/resources/db/migration/V1__initial_schema.sql と同じ構造。
// 端末内DBの変更時は新しい番号の migration を追加し、既存のSQLは変更しない。
export const migrations = [
  {
    version: 1,
    sql: `
CREATE TABLE app_settings (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  monthly_notification_enabled INTEGER NOT NULL DEFAULT 1 CHECK (monthly_notification_enabled IN (0, 1)),
  timezone TEXT NOT NULL DEFAULT 'Asia/Tokyo' CHECK (length(timezone) BETWEEN 1 AND 64),
  created_at TEXT NOT NULL CHECK (length(created_at) >= 20),
  updated_at TEXT NOT NULL CHECK (length(updated_at) >= 20)
);

CREATE TABLE budget_cycle_rules (
  id TEXT PRIMARY KEY CHECK (length(id) = 36),
  start_day INTEGER NOT NULL CHECK (start_day BETWEEN 1 AND 31),
  adjust_for_weekends_and_holidays INTEGER NOT NULL DEFAULT 1 CHECK (adjust_for_weekends_and_holidays IN (0, 1)),
  effective_from TEXT NOT NULL CHECK (length(effective_from) = 10),
  effective_to TEXT CHECK (effective_to IS NULL OR (length(effective_to) = 10 AND effective_to >= effective_from)),
  created_at TEXT NOT NULL CHECK (length(created_at) >= 20),
  updated_at TEXT NOT NULL CHECK (length(updated_at) >= 20),
  UNIQUE (effective_from)
);
CREATE UNIQUE INDEX budget_cycle_rules_one_open_rule ON budget_cycle_rules ((1)) WHERE effective_to IS NULL;
CREATE INDEX budget_cycle_rules_effective_dates ON budget_cycle_rules (effective_from, effective_to);

CREATE TABLE budget_periods (
  id TEXT PRIMARY KEY CHECK (length(id) = 36),
  cycle_rule_id TEXT NOT NULL,
  label_month TEXT NOT NULL UNIQUE CHECK (length(label_month) = 10 AND substr(label_month, 9, 2) = '01'),
  start_date TEXT NOT NULL CHECK (length(start_date) = 10),
  nominal_end_date TEXT NOT NULL CHECK (length(nominal_end_date) = 10),
  end_date TEXT NOT NULL CHECK (length(end_date) = 10),
  budget_amount INTEGER NOT NULL CHECK (budget_amount > 0),
  created_at TEXT NOT NULL CHECK (length(created_at) >= 20),
  updated_at TEXT NOT NULL CHECK (length(updated_at) >= 20),
  FOREIGN KEY (cycle_rule_id) REFERENCES budget_cycle_rules (id) ON DELETE RESTRICT,
  CHECK (start_date <= end_date),
  CHECK (end_date <= nominal_end_date),
  UNIQUE (start_date, end_date)
);
CREATE INDEX budget_periods_date_range ON budget_periods (start_date, end_date);

CREATE TABLE expenses (
  id TEXT PRIMARY KEY CHECK (length(id) = 36),
  budget_period_id TEXT NOT NULL,
  spent_on TEXT NOT NULL CHECK (length(spent_on) = 10),
  amount INTEGER NOT NULL CHECK (amount > 0),
  memo TEXT CHECK (memo IS NULL OR length(memo) <= 120),
  created_at TEXT NOT NULL CHECK (length(created_at) >= 20),
  updated_at TEXT NOT NULL CHECK (length(updated_at) >= 20),
  FOREIGN KEY (budget_period_id) REFERENCES budget_periods (id) ON DELETE RESTRICT
);
CREATE INDEX expenses_period_and_date ON expenses (budget_period_id, spent_on, id);
CREATE INDEX expenses_spent_on ON expenses (spent_on);

CREATE TABLE holiday_calendar_coverage (
  calendar_year INTEGER PRIMARY KEY CHECK (calendar_year BETWEEN 2000 AND 2200),
  source TEXT NOT NULL CHECK (length(source) BETWEEN 1 AND 255),
  imported_at TEXT NOT NULL CHECK (length(imported_at) >= 20)
);
CREATE TABLE holidays (
  holiday_date TEXT PRIMARY KEY CHECK (length(holiday_date) = 10),
  calendar_year INTEGER NOT NULL,
  name TEXT NOT NULL CHECK (length(name) BETWEEN 1 AND 100),
  source TEXT NOT NULL CHECK (length(source) BETWEEN 1 AND 255),
  created_at TEXT NOT NULL CHECK (length(created_at) >= 20),
  FOREIGN KEY (calendar_year) REFERENCES holiday_calendar_coverage (calendar_year) ON DELETE RESTRICT,
  CHECK (calendar_year = CAST(substr(holiday_date, 1, 4) AS INTEGER))
);

CREATE VIEW budget_period_summary AS
SELECT p.id AS budget_period_id, p.label_month, p.start_date, p.end_date, p.budget_amount,
       COALESCE(SUM(e.amount), 0) AS spent_amount,
       p.budget_amount - COALESCE(SUM(e.amount), 0) AS remaining_amount,
       COUNT(e.id) AS expense_count
FROM budget_periods AS p
LEFT JOIN expenses AS e ON e.budget_period_id = p.id
GROUP BY p.id, p.label_month, p.start_date, p.end_date, p.budget_amount;
`,
  },
  {
    version: 2,
    sql: `
DROP VIEW budget_period_summary;
CREATE TABLE expenses_backup_v2 AS SELECT * FROM expenses;
DROP TABLE expenses;
CREATE TABLE budget_periods_new (
  id TEXT PRIMARY KEY CHECK (length(id) = 36),
  cycle_rule_id TEXT NOT NULL,
  label_month TEXT NOT NULL UNIQUE CHECK (length(label_month) = 10 AND substr(label_month, 9, 2) = '01'),
  start_date TEXT NOT NULL CHECK (length(start_date) = 10),
  nominal_end_date TEXT NOT NULL CHECK (length(nominal_end_date) = 10),
  end_date TEXT NOT NULL CHECK (length(end_date) = 10),
  budget_amount INTEGER NOT NULL CHECK (budget_amount >= 0),
  created_at TEXT NOT NULL CHECK (length(created_at) >= 20),
  updated_at TEXT NOT NULL CHECK (length(updated_at) >= 20),
  FOREIGN KEY (cycle_rule_id) REFERENCES budget_cycle_rules (id) ON DELETE RESTRICT,
  CHECK (start_date <= end_date),
  CHECK (end_date <= nominal_end_date),
  UNIQUE (start_date, end_date)
);
INSERT INTO budget_periods_new
  (id, cycle_rule_id, label_month, start_date, nominal_end_date, end_date, budget_amount, created_at, updated_at)
SELECT p.id, p.cycle_rule_id, p.label_month, p.start_date, p.nominal_end_date, p.end_date,
       CASE WHEN p.created_at = (SELECT created_at FROM app_settings WHERE id = 1)
                 OR p.updated_at <> p.created_at
            THEN p.budget_amount ELSE 0 END,
       p.created_at, p.updated_at
FROM budget_periods AS p;
DROP TABLE budget_periods;
ALTER TABLE budget_periods_new RENAME TO budget_periods;
CREATE INDEX budget_periods_date_range ON budget_periods (start_date, end_date);
CREATE TABLE expenses (
  id TEXT PRIMARY KEY CHECK (length(id) = 36),
  budget_period_id TEXT NOT NULL,
  spent_on TEXT NOT NULL CHECK (length(spent_on) = 10),
  amount INTEGER NOT NULL CHECK (amount > 0),
  memo TEXT CHECK (memo IS NULL OR length(memo) <= 120),
  created_at TEXT NOT NULL CHECK (length(created_at) >= 20),
  updated_at TEXT NOT NULL CHECK (length(updated_at) >= 20),
  FOREIGN KEY (budget_period_id) REFERENCES budget_periods (id) ON DELETE RESTRICT
);
INSERT INTO expenses SELECT * FROM expenses_backup_v2;
DROP TABLE expenses_backup_v2;
CREATE INDEX expenses_period_and_date ON expenses (budget_period_id, spent_on, id);
CREATE INDEX expenses_spent_on ON expenses (spent_on);
CREATE VIEW budget_period_summary AS
SELECT p.id AS budget_period_id, p.label_month, p.start_date, p.end_date, p.budget_amount,
       COALESCE(SUM(e.amount), 0) AS spent_amount,
       p.budget_amount - COALESCE(SUM(e.amount), 0) AS remaining_amount,
       COUNT(e.id) AS expense_count
FROM budget_periods AS p
LEFT JOIN expenses AS e ON e.budget_period_id = p.id
GROUP BY p.id, p.label_month, p.start_date, p.end_date, p.budget_amount;
`,
  },
  {
    version: 3,
    sql: `
ALTER TABLE app_settings ADD COLUMN notification_hour INTEGER NOT NULL DEFAULT 9 CHECK (notification_hour BETWEEN 0 AND 23);
ALTER TABLE app_settings ADD COLUMN notification_minute INTEGER NOT NULL DEFAULT 0 CHECK (notification_minute BETWEEN 0 AND 59);
`,
  },
  {
    version: 4,
    sql: `
ALTER TABLE budget_periods ADD COLUMN budget_configured INTEGER NOT NULL DEFAULT 0
  CHECK (budget_configured IN (0, 1));
UPDATE budget_periods SET budget_configured = 1 WHERE budget_amount > 0;
`,
  },
  {
    version: 5,
    sql: `
CREATE TABLE onboarding_state (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  completed INTEGER NOT NULL DEFAULT 0 CHECK (completed IN (0, 1))
);
INSERT INTO onboarding_state (id, completed) VALUES (1, 0);
`,
  },
] as const;
