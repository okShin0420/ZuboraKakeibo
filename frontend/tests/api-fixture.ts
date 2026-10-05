import type { Page } from '@playwright/test'

type Entry = { id: string; budgetPeriodId: string; spentOn: string; amount: number; memo: string | null; createdAt: string; updatedAt: string }
const instant = '2026-09-21T03:00:00Z'
const periodId = '22222222-2222-4222-8222-222222222222'

export async function installApiMock(page: Page, initiallyInitialized = true) {
  let initialized = initiallyInitialized
  let budget = 50_000
  let spent = 1_800
  let notification = true
  let startDay = 18
  let adjustHoliday = false
  const entries: Entry[] = [
    { id: '11111111-1111-4111-8111-111111111111', budgetPeriodId: periodId, spentOn: '2026-09-21', amount: 800, memo: 'ランチ', createdAt: instant, updatedAt: instant },
    { id: '22222222-2222-4222-8222-222222222223', budgetPeriodId: periodId, spentOn: '2026-09-21', amount: 400, memo: '飲みもの', createdAt: instant, updatedAt: instant },
  ]
  const settings = () => ({
    monthlyNotificationEnabled: notification, timezone: 'Asia/Tokyo', startDay,
    adjustForWeekendsAndHolidays: adjustHoliday, currentBudgetAmount: budget,
    currentPeriodRange: { labelMonth: '2026-09-01', startDate: '2026-09-18', endDate: '2026-10-17' },
    nextPeriodRange: { labelMonth: '2026-10-01', startDate: '2026-10-18', endDate: '2026-11-17' },
  })
  const graphAmounts = [16500, 18500, 15200, 27000, 11800, 14700, 2800, 1600, 9400, 11200, 22500, 12000]

  await page.route('**/api/v1/**', async route => {
    const request = route.request()
    const url = new URL(request.url())
    const path = url.pathname.replace(/^.*\/api\/v1/, '')
    const method = request.method()
    const body = request.postDataJSON() as Record<string, unknown> | null
    const respond = (value: unknown, status = 200) => route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(value) })

    if (path === '/setup' && method === 'GET') return respond({ initialized })
    if (path === '/setup' && method === 'POST') {
      if (initialized) return respond({ code: 'CONFLICT', message: '初期設定は完了しています', fieldErrors: {}, timestamp: instant }, 409)
      initialized = true
      budget = Number(body?.budgetAmount)
      spent = 0
      entries.length = 0
      startDay = 1
      return respond(settings(), 201)
    }
    if (path === '/home' && method === 'GET') return respond({
      labelMonth: '2026-09-01', budgetAmount: budget, spentAmount: spent,
      remainingAmount: budget - spent,
      todayExpense: entries.filter(entry => entry.spentOn === '2026-09-21').reduce((sum, entry) => sum + entry.amount, 0),
      remainingDays: 10, message: '今日も、自分のペースで。',
    })
    if (path === '/settings' && method === 'GET') return respond(settings())
    if (path === '/settings' && method === 'PUT') {
      notification = Boolean(body?.monthlyNotificationEnabled)
      startDay = Number(body?.startDay)
      adjustHoliday = Boolean(body?.adjustForWeekendsAndHolidays)
      return respond(settings())
    }
    if (path === '/budgets/current' && method === 'GET') return respond({ budgetPeriodId: periodId, labelMonth: '2026-09-01', budgetAmount: budget, remainingAmount: budget - spent, updatedAt: instant })
    if (path === '/budgets/current' && method === 'PUT') {
      budget = Number(body?.amount)
      return respond({ budgetPeriodId: periodId, labelMonth: '2026-09-01', budgetAmount: budget, remainingAmount: budget - spent, updatedAt: instant })
    }
    if (path === '/expenses' && method === 'POST') {
      const entry: Entry = { id: `33333333-3333-4333-8333-${String(entries.length + 1).padStart(12, '0')}`, budgetPeriodId: periodId,
        spentOn: String(body?.spentOn), amount: Number(body?.amount), memo: body?.memo ? String(body.memo) : null, createdAt: instant, updatedAt: instant }
      entries.push(entry)
      spent += entry.amount
      return respond(entry, 201)
    }
    if (path.startsWith('/expenses/') && method === 'PUT') {
      const entry = entries.find(item => item.id === path.split('/').at(-1))
      if (!entry) return respond({ code: 'NOT_FOUND', message: '支出が見つかりません', fieldErrors: {}, timestamp: instant }, 404)
      spent += Number(body?.amount) - entry.amount
      entry.amount = Number(body?.amount)
      entry.memo = body?.memo ? String(body.memo) : null
      entry.spentOn = String(body?.spentOn)
      return respond(entry)
    }
    if (path === '/calendar' && method === 'GET') {
      const month = url.searchParams.get('month')
      if (month !== '2026-09') return respond({ code: 'NOT_FOUND', message: '対象の月度が見つかりません', fieldErrors: {}, timestamp: instant }, 404)
      const totals = new Map<string, number>()
      for (const entry of entries) totals.set(entry.spentOn, (totals.get(entry.spentOn) ?? 0) + entry.amount)
      return respond({ month, periodStart: '2026-09-18', periodEnd: '2026-10-17',
        dailyTotals: [...totals].map(([date, totalAmount]) => ({ date, totalAmount })) })
    }
    if (path.startsWith('/calendar/days/') && method === 'GET') {
      const date = path.split('/').at(-1)
      const daily = entries.filter(entry => entry.spentOn === date)
      return respond({ date, totalAmount: daily.reduce((sum, entry) => sum + entry.amount, 0), expenses: daily })
    }
    if (path === '/graphs/yearly' && method === 'GET') return respond({
      year: 2026, availableYears: [2026],
      monthlySummaries: graphAmounts.map((remainingAmount, index) => ({ month: index + 1, budgetAmount: 30000,
        spentAmount: 30000 - remainingAmount, remainingAmount, expenseCount: 1 })),
    })
    return respond({ code: 'NOT_FOUND', message: '見つかりません', fieldErrors: {}, timestamp: instant }, 404)
  })
}
