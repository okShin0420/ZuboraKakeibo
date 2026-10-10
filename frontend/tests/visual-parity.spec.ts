import { expect, test } from '@playwright/test'
import { installApiMock } from './api-fixture'

test.skip(!process.env.VISUAL_QA, 'Run explicitly for Web / Expo visual comparison')

test('Web版とExpo版の主要画面を同条件で撮影する', async ({ browser }, testInfo) => {
  test.setTimeout(180_000)
  const viewport = {
    width: Number(process.env.VISUAL_WIDTH ?? 390),
    height: Number(process.env.VISUAL_HEIGHT ?? 844),
  }
  const time = new Date('2026-09-21T03:00:00Z')

  const web = await browser.newPage({ viewport })
  await web.clock.setFixedTime(time)
  await installApiMock(web)
  // Match the state created below in the device-local SQLite database.
  await web.route('**/api/v1/**', route => {
    const path = new URL(route.request().url()).pathname
    const send = (value: unknown) => route.fulfill({ contentType: 'application/json', body: JSON.stringify(value) })
    if (path.endsWith('/home')) return send({
      labelMonth: '2026-09-01', budgetAmount: 49_400, spentAmount: 1_200,
      remainingAmount: 48_200, todayExpense: 1_200, remainingDays: 27,
      message: '今日も、自分のペースで。',
    })
    if (path.endsWith('/settings')) return send({
      monthlyNotificationEnabled: true, timezone: 'Asia/Tokyo', startDay: 18,
      adjustForWeekendsAndHolidays: false, currentBudgetAmount: 49_400,
      currentPeriodRange: { labelMonth: '2026-09-01', startDate: '2026-09-01', endDate: '2026-10-17' },
      nextPeriodRange: { labelMonth: '2026-10-01', startDate: '2026-10-18', endDate: '2026-11-17' },
    })
    if (path.endsWith('/budgets/current')) return send({
      budgetPeriodId: '22222222-2222-4222-8222-222222222222', labelMonth: '2026-09-01',
      budgetAmount: 49_400, remainingAmount: 48_200, updatedAt: '2026-09-21T03:00:00Z',
    })
    if (path.endsWith('/calendar')) return send({
      month: '2026-09', periodStart: '2026-09-01', periodEnd: '2026-10-17',
      dailyTotals: [{ date: '2026-09-21', totalAmount: 1_200 }],
    })
    if (path.endsWith('/calendar/days/2026-09-21')) return send({
      date: '2026-09-21', totalAmount: 1_200, expenses: [{
        id: '11111111-1111-4111-8111-111111111111', budgetPeriodId: '22222222-2222-4222-8222-222222222222',
        spentOn: '2026-09-21', amount: 1_200, memo: null,
        createdAt: '2026-09-21T03:00:00Z', updatedAt: '2026-09-21T03:00:00Z',
      }],
    })
    if (path.endsWith('/graphs/yearly')) return send({
      year: 2026, availableYears: [2026], monthlySummaries: Array.from({ length: 12 }, (_, index) => ({
        month: index + 1, budgetAmount: index === 8 || index === 9 ? 49_400 : 0,
        spentAmount: index === 8 ? 1_200 : 0,
        remainingAmount: index === 8 ? 48_200 : index === 9 ? 49_400 : 0,
        expenseCount: index === 8 ? 1 : 0,
      })),
    })
    return route.fallback()
  })
  await web.goto('http://127.0.0.1:5173')
  await expect(web.getByLabel('残り予算 48,200円')).toBeVisible()
  console.log('WEB HOME', await Promise.all(['.home-header', '.dog-scene', '.balance-summary', '.today-card', '.record-button', '.bottom-nav'].map(async selector => [selector, await web.locator(selector).boundingBox()])))
  await web.screenshot({ path: testInfo.outputPath('web-home.png') })
  await web.getByRole('button', { name: '入力する', exact: true }).click()
  await web.waitForTimeout(400)
  await web.screenshot({ path: testInfo.outputPath('web-expense.png') })
  await web.getByRole('button', { name: '閉じる', exact: true }).click()
  await web.getByRole('button', { name: 'カレンダー', exact: true }).click()
  await expect(web.getByRole('heading', { name: 'カレンダー' })).toBeVisible()
  await web.screenshot({ path: testInfo.outputPath('web-calendar.png') })
  await web.getByRole('button', { name: 'グラフ', exact: true }).click()
  await expect(web.getByRole('heading', { name: 'やりくり金額' })).toBeVisible()
  await web.waitForTimeout(600)
  await web.screenshot({ path: testInfo.outputPath('web-graph.png') })
  await web.locator('.graph-year-switcher').click()
  await web.waitForTimeout(400)
  await web.screenshot({ path: testInfo.outputPath('web-year-picker.png') })
  await web.getByRole('button', { name: '年選択を閉じる' }).click()
  await web.getByRole('button', { name: 'ホーム', exact: true }).click()
  await web.getByRole('button', { name: '設定', exact: true }).click()
  await web.waitForTimeout(400)
  await web.screenshot({ path: testInfo.outputPath('web-settings.png') })
  await web.getByRole('button', { name: /月度の開始日: 18日/ }).click()
  await web.waitForTimeout(400)
  await web.screenshot({ path: testInfo.outputPath('web-start-day-picker.png') })
  await web.getByRole('button', { name: '開始日の変更をキャンセル' }).click()
  await web.getByRole('button', { name: /今月使える金額/ }).click()
  await web.waitForTimeout(400)
  await web.screenshot({ path: testInfo.outputPath('web-money.png') })
  await web.close()

  const mobile = await browser.newPage({ viewport })
  await mobile.clock.setFixedTime(time)
  mobile.on('pageerror', error => console.error('Expo preview:', error.message))
  await mobile.goto('http://localhost:19006', { timeout: 90_000 })
  await expect(mobile.getByText('今月使える金額')).toBeVisible({ timeout: 60_000 })
  await mobile.screenshot({ path: testInfo.outputPath('mobile-setup.png') })
  for (const digit of ['4', '9', '4', '0', '0']) await mobile.getByText(digit, { exact: true }).click()
  await mobile.getByText('保存する', { exact: true }).click()
  await expect(mobile.getByText('今月あとつかえるお金')).toBeVisible()
  await mobile.getByRole('button', { name: '設定' }).click()
  await mobile.waitForTimeout(450)
  await mobile.getByRole('button', { name: /月度の開始日/ }).click()
  await mobile.getByRole('button', { name: '18日', exact: true }).click()
  await mobile.getByRole('button', { name: '開始日を確定' }).click()
  await mobile.getByRole('button', { name: '設定を閉じる' }).last().click()
  await mobile.getByText('入力する', { exact: true }).click()
  await mobile.waitForTimeout(500)
  await mobile.screenshot({ path: testInfo.outputPath('mobile-expense.png') })
  await mobile.getByRole('button', { name: '使った金額 0円' }).click()
  for (const digit of ['1', '2', '0', '0']) await mobile.getByText(digit, { exact: true }).click()
  await mobile.getByText('保存する', { exact: true }).click()
  await expect(mobile.getByText('¥48,200')).toBeVisible()
  await mobile.waitForTimeout(950)
  console.log('MOBILE HOME', await Promise.all(['9月', '今日も、自分のペースで。', '今月あとつかえるお金', '今日つかった', '入力する'].map(async label => [label, await mobile.getByText(label, { exact: true }).first().boundingBox()])))
  await mobile.screenshot({ path: testInfo.outputPath('mobile-home.png') })
  // Expo Web has no native safe-area insets. Simulate an iPhone with a notch
  // so controls hidden beneath the tab bar are caught by this visual check.
  const safeArea = mobile.getByTestId('app-safe-area')
  const simulateIphoneInsets = () => safeArea.evaluate(element => {
    Object.assign((element as HTMLElement).style, { position: 'absolute', top: '59px', bottom: '34px', height: 'auto', width: '100%' })
  })
  const clearIphoneInsets = () => safeArea.evaluate(element => {
    Object.assign((element as HTMLElement).style, { position: '', top: '', bottom: '', height: '', width: '' })
  })
  await simulateIphoneInsets()
  await mobile.waitForTimeout(150)
  const homeButton = await mobile.getByRole('button', { name: '入力する' }).boundingBox()
  const homeNavigation = await mobile.getByTestId('tab-bar').boundingBox()
  expect(homeButton && homeNavigation && homeButton.y + homeButton.height < homeNavigation.y).toBeTruthy()
  await mobile.screenshot({ path: testInfo.outputPath('mobile-home-iphone-safe-area.png') })
  await clearIphoneInsets()
  await mobile.getByText('カレンダー', { exact: true }).last().click()
  await expect(mobile.getByText('9月 2026年')).toBeVisible()
  await mobile.getByRole('button', { name: /21日、1,200円/ }).click()
  await expect(mobile.getByText('9月21日')).toBeVisible()
  await expect(mobile.getByText('メモなし')).toBeVisible()
  await mobile.screenshot({ path: testInfo.outputPath('mobile-calendar.png') })
  await simulateIphoneInsets()
  await mobile.waitForTimeout(150)
  const expenseRow = await mobile.getByText('メモなし').boundingBox()
  const calendarNavigation = await mobile.getByTestId('tab-bar').boundingBox()
  expect(expenseRow && calendarNavigation && expenseRow.y + expenseRow.height < calendarNavigation.y).toBeTruthy()
  await mobile.screenshot({ path: testInfo.outputPath('mobile-calendar-iphone-safe-area.png') })
  await clearIphoneInsets()
  await mobile.getByText('グラフ', { exact: true }).last().click()
  await expect(mobile.getByText('やりくり金額')).toBeVisible()
  await mobile.screenshot({ path: testInfo.outputPath('mobile-graph.png') })
  await simulateIphoneInsets()
  await mobile.waitForTimeout(150)
  const monthLabels = await mobile.getByTestId('graph-month-labels').boundingBox()
  const graphNavigation = await mobile.getByTestId('tab-bar').boundingBox()
  expect(monthLabels && graphNavigation && monthLabels.y + monthLabels.height < graphNavigation.y).toBeTruthy()
  await mobile.screenshot({ path: testInfo.outputPath('mobile-graph-iphone-safe-area.png') })
  await clearIphoneInsets()
  await mobile.getByRole('button', { name: '表示年 2026年' }).click()
  await mobile.waitForTimeout(450)
  await mobile.screenshot({ path: testInfo.outputPath('mobile-year-picker.png') })
  await mobile.getByRole('button', { name: '年選択を閉じる' }).last().click()
  await mobile.getByText('ホーム', { exact: true }).last().click()
  await mobile.getByRole('button', { name: '設定' }).click()
  await mobile.waitForTimeout(500)
  await mobile.screenshot({ path: testInfo.outputPath('mobile-settings.png') })
  await mobile.getByRole('button', { name: /月度の開始日/ }).click()
  await mobile.waitForTimeout(500)
  await mobile.screenshot({ path: testInfo.outputPath('mobile-start-day-picker.png') })
  await mobile.getByRole('button', { name: '31日', exact: true }).click()
  await expect(mobile.getByText('31日から開始します')).toBeVisible()
  await mobile.getByRole('button', { name: '開始日の変更をキャンセル' }).click()
  await mobile.getByText('今月使える金額').last().click()
  await mobile.waitForTimeout(500)
  await mobile.screenshot({ path: testInfo.outputPath('mobile-money.png') })
  await mobile.close()
})
