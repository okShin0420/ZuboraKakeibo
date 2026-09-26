BEGIN;

DROP VIEW IF EXISTS budget_period_summary;
DROP TABLE IF EXISTS expenses;
DROP TABLE IF EXISTS holidays;
DROP TABLE IF EXISTS holiday_calendar_coverage;
DROP TABLE IF EXISTS budget_periods;
DROP TABLE IF EXISTS budget_cycle_rules;
DROP TABLE IF EXISTS app_settings;

COMMIT;
