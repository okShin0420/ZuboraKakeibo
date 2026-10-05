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
