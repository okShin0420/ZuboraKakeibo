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

-- Legacy rows have no explicit-setting flag. Preserve the setup month and edited rows;
-- automatically generated, untouched months become unconfigured (zero budget).
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
