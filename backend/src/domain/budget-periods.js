const ISO_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/

const parseIsoDate = (value, fieldName) => {
  if (!ISO_DATE_PATTERN.test(value)) throw new Error(`${fieldName} は YYYY-MM-DD 形式で指定してください`)
  const [year, month, day] = value.split('-').map(Number)
  const date = new Date(Date.UTC(year, month - 1, day))
  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day
  ) throw new Error(`${fieldName} は実在する日付を指定してください`)
  return date
}

const formatIsoDate = date => [
  String(date.getUTCFullYear()).padStart(4, '0'),
  String(date.getUTCMonth() + 1).padStart(2, '0'),
  String(date.getUTCDate()).padStart(2, '0'),
].join('-')

const addDays = (date, amount) => {
  const result = new Date(date)
  result.setUTCDate(result.getUTCDate() + amount)
  return result
}

const isWeekend = date => date.getUTCDay() === 0 || date.getUTCDay() === 6

const assertDay = (value, fieldName, nullable = false) => {
  if (nullable && value === null) return
  if (!Number.isInteger(value) || value < 1 || value > 28) {
    throw new Error(`${fieldName} は1〜28の整数で指定してください`)
  }
}

const assertHolidayCoverage = (nominalEnd, holidayCoverage) => {
  if (!holidayCoverage) throw new Error('祝日データの対象期間が確認できません')
  const coverageStart = parseIsoDate(holidayCoverage.start, 'holidayCoverage.start')
  const coverageEnd = parseIsoDate(holidayCoverage.end, 'holidayCoverage.end')
  if (nominalEnd < coverageStart || nominalEnd > coverageEnd) {
    throw new Error('締め日の祝日データが不足しています')
  }
}

export function calculateBudgetPeriod({
  labelMonth,
  startDay,
  closingDay,
  adjustForWeekendsAndHolidays,
  holidayDates = [],
  holidayCoverage,
}) {
  assertDay(startDay, 'startDay')
  assertDay(closingDay, 'closingDay', true)

  const label = parseIsoDate(labelMonth, 'labelMonth')
  if (label.getUTCDate() !== 1) throw new Error('labelMonth は対象月の1日を指定してください')

  const year = label.getUTCFullYear()
  const monthIndex = label.getUTCMonth()
  const nominalEnd = closingDay === null
    ? new Date(Date.UTC(year, monthIndex + 1, 0))
    : new Date(Date.UTC(year, monthIndex, closingDay))

  const startMonthIndex = startDay <= nominalEnd.getUTCDate() ? monthIndex : monthIndex - 1
  const start = new Date(Date.UTC(year, startMonthIndex, startDay))
  let end = new Date(nominalEnd)

  if (adjustForWeekendsAndHolidays) {
    assertHolidayCoverage(nominalEnd, holidayCoverage)
    const holidays = new Set(holidayDates)
    while (isWeekend(end) || holidays.has(formatIsoDate(end))) end = addDays(end, -1)
  }

  if (end < start) throw new Error('調整後の締め日が期間開始日より前になります')

  return {
    labelMonth: formatIsoDate(label),
    startDate: formatIsoDate(start),
    nominalEndDate: formatIsoDate(nominalEnd),
    endDate: formatIsoDate(end),
  }
}

export function assertExpenseDateWithinPeriod(spentOn, period) {
  const spent = parseIsoDate(spentOn, 'spentOn')
  const start = parseIsoDate(period.startDate, 'period.startDate')
  const end = parseIsoDate(period.endDate, 'period.endDate')
  if (spent < start || spent > end) throw new Error('支出日は予算期間内で指定してください')
}

export function assertNoBudgetPeriodOverlap(candidate, existingPeriods) {
  const candidateStart = parseIsoDate(candidate.startDate, 'candidate.startDate')
  const candidateEnd = parseIsoDate(candidate.endDate, 'candidate.endDate')
  if (candidateEnd < candidateStart) throw new Error('予算期間の終了日は開始日以降にしてください')

  for (const period of existingPeriods) {
    const existingStart = parseIsoDate(period.startDate, 'period.startDate')
    const existingEnd = parseIsoDate(period.endDate, 'period.endDate')
    if (candidateStart <= existingEnd && candidateEnd >= existingStart) {
      throw new Error('予算期間が既存の期間と重複しています')
    }
  }
}

export function planCycleRuleChange({ currentRule, nextPeriodStart, nextRule, nextRuleId, now }) {
  assertDay(nextRule.startDay, 'nextRule.startDay')
  assertDay(nextRule.closingDay, 'nextRule.closingDay', true)
  const effectiveFrom = parseIsoDate(nextPeriodStart, 'nextPeriodStart')
  const currentEffectiveFrom = parseIsoDate(currentRule.effectiveFrom, 'currentRule.effectiveFrom')
  if (effectiveFrom <= currentEffectiveFrom) throw new Error('新しい設定は現在の設定より後から適用してください')

  return {
    currentRuleUpdate: {
      id: currentRule.id,
      effectiveTo: formatIsoDate(addDays(effectiveFrom, -1)),
      updatedAt: now,
    },
    newRule: {
      id: nextRuleId,
      startDay: nextRule.startDay,
      closingDay: nextRule.closingDay,
      adjustForWeekendsAndHolidays: nextRule.adjustForWeekendsAndHolidays,
      effectiveFrom: formatIsoDate(effectiveFrom),
      effectiveTo: null,
      createdAt: now,
      updatedAt: now,
    },
  }
}
