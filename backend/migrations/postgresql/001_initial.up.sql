BEGIN;

CREATE TABLE app_settings (
  id SMALLINT PRIMARY KEY CHECK (id = 1),
  monthly_notification_enabled BOOLEAN NOT NULL DEFAULT TRUE,
  timezone VARCHAR(64) NOT NULL DEFAULT 'Asia/Tokyo'
    CHECK (length(timezone) BETWEEN 1 AND 64),
  created_at TIMESTAMPTZ NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL
);

CREATE TABLE budget_cycle_rules (
  id UUID PRIMARY KEY,
  start_day SMALLINT NOT NULL CHECK (start_day BETWEEN 1 AND 28),
  closing_day SMALLINT CHECK (closing_day BETWEEN 1 AND 28),
  adjust_for_weekends_and_holidays BOOLEAN NOT NULL DEFAULT TRUE,
  effective_from DATE NOT NULL UNIQUE,
  effective_to DATE CHECK (effective_to IS NULL OR effective_to >= effective_from),
  created_at TIMESTAMPTZ NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL
);

CREATE UNIQUE INDEX budget_cycle_rules_one_open_rule
  ON budget_cycle_rules ((1))
  WHERE effective_to IS NULL;

CREATE INDEX budget_cycle_rules_effective_dates
  ON budget_cycle_rules (effective_from, effective_to);

CREATE TABLE budget_periods (
  id UUID PRIMARY KEY,
  cycle_rule_id UUID NOT NULL REFERENCES budget_cycle_rules (id) ON DELETE RESTRICT,
  label_month DATE NOT NULL UNIQUE
    CHECK (label_month = date_trunc('month', label_month)::date),
  start_date DATE NOT NULL,
  nominal_end_date DATE NOT NULL,
  end_date DATE NOT NULL,
  budget_amount BIGINT NOT NULL CHECK (budget_amount > 0),
  created_at TIMESTAMPTZ NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL,
  CHECK (start_date <= end_date),
  CHECK (end_date <= nominal_end_date),
  UNIQUE (start_date, end_date)
);

CREATE INDEX budget_periods_date_range
  ON budget_periods (start_date, end_date);

CREATE TABLE expenses (
  id UUID PRIMARY KEY,
  budget_period_id UUID NOT NULL REFERENCES budget_periods (id) ON DELETE RESTRICT,
  spent_on DATE NOT NULL,
  amount BIGINT NOT NULL CHECK (amount > 0),
  memo VARCHAR(120),
  created_at TIMESTAMPTZ NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL
);

CREATE INDEX expenses_period_and_date
  ON expenses (budget_period_id, spent_on, id);

CREATE INDEX expenses_spent_on
  ON expenses (spent_on);

CREATE TABLE holiday_calendar_coverage (
  calendar_year SMALLINT PRIMARY KEY CHECK (calendar_year BETWEEN 2000 AND 2200),
  source VARCHAR(255) NOT NULL CHECK (length(source) BETWEEN 1 AND 255),
  imported_at TIMESTAMPTZ NOT NULL
);

CREATE TABLE holidays (
  holiday_date DATE PRIMARY KEY,
  calendar_year SMALLINT NOT NULL REFERENCES holiday_calendar_coverage (calendar_year) ON DELETE RESTRICT,
  name VARCHAR(100) NOT NULL CHECK (length(name) BETWEEN 1 AND 100),
  source VARCHAR(255) NOT NULL CHECK (length(source) BETWEEN 1 AND 255),
  created_at TIMESTAMPTZ NOT NULL,
  CHECK (calendar_year = EXTRACT(YEAR FROM holiday_date))
);

CREATE VIEW budget_period_summary AS
SELECT
  p.id AS budget_period_id,
  p.label_month,
  p.start_date,
  p.end_date,
  p.budget_amount,
  COALESCE(SUM(e.amount), 0)::BIGINT AS spent_amount,
  (p.budget_amount - COALESCE(SUM(e.amount), 0))::BIGINT AS remaining_amount,
  COUNT(e.id)::BIGINT AS expense_count
FROM budget_periods AS p
LEFT JOIN expenses AS e ON e.budget_period_id = p.id
GROUP BY
  p.id,
  p.label_month,
  p.start_date,
  p.end_date,
  p.budget_amount;

COMMIT;
