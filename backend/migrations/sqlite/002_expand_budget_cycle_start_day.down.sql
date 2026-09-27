PRAGMA foreign_keys = OFF;

BEGIN;

CREATE TEMP TABLE budget_cycle_rules_rollback_guard (
  start_day INTEGER NOT NULL CHECK (start_day BETWEEN 1 AND 28)
);

INSERT INTO budget_cycle_rules_rollback_guard (start_day)
SELECT start_day FROM budget_cycle_rules;

DROP TABLE budget_cycle_rules_rollback_guard;

CREATE TABLE budget_cycle_rules_previous (
  id TEXT PRIMARY KEY CHECK (length(id) = 36),
  start_day INTEGER NOT NULL CHECK (start_day BETWEEN 1 AND 28),
  adjust_for_weekends_and_holidays INTEGER NOT NULL DEFAULT 1
    CHECK (adjust_for_weekends_and_holidays IN (0, 1)),
  effective_from TEXT NOT NULL CHECK (length(effective_from) = 10),
  effective_to TEXT CHECK (
    effective_to IS NULL OR
    (length(effective_to) = 10 AND effective_to >= effective_from)
  ),
  created_at TEXT NOT NULL CHECK (length(created_at) >= 20),
  updated_at TEXT NOT NULL CHECK (length(updated_at) >= 20),
  UNIQUE (effective_from)
);

INSERT INTO budget_cycle_rules_previous (
  id,
  start_day,
  adjust_for_weekends_and_holidays,
  effective_from,
  effective_to,
  created_at,
  updated_at
)
SELECT
  id,
  start_day,
  adjust_for_weekends_and_holidays,
  effective_from,
  effective_to,
  created_at,
  updated_at
FROM budget_cycle_rules;

DROP TABLE budget_cycle_rules;
ALTER TABLE budget_cycle_rules_previous RENAME TO budget_cycle_rules;

CREATE UNIQUE INDEX budget_cycle_rules_one_open_rule
  ON budget_cycle_rules ((1))
  WHERE effective_to IS NULL;

CREATE INDEX budget_cycle_rules_effective_dates
  ON budget_cycle_rules (effective_from, effective_to);

PRAGMA user_version = 1;

COMMIT;

PRAGMA foreign_keys = ON;
