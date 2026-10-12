import { expect, test } from '@playwright/test'
import { installApiMock } from './api-fixture'

test.beforeEach(async ({ page }) => {
  await page.clock.setFixedTime(new Date('2026-09-21T03:00:00Z'))
  await installApiMock(page)
})

test('空のDBでは初期予算を登録してホームへ進む', async ({ page }) => {
  await installApiMock(page, false)
  await page.goto('/')
  const dialog = page.getByRole('dialog', { name: '今月使える金額' })
  await expect(dialog).toBeVisible()
  await dialog.getByRole('button', { name: '5を入力' }).click()
  for (let index = 0; index < 4; index += 1) await dialog.getByRole('button', { name: '0を入力' }).click()
  await dialog.getByRole('button', { name: '保存する' }).click()
  await expect(dialog).toHaveCount(0)
  await expect(page.getByLabel('残り予算 50,000円')).toBeVisible()
})

test('APIのホーム応答・3タブ・素材が表示される', async ({ page }) => {
  await page.goto('/')
  await expect(page.getByLabel('残り予算 48,200円')).toBeVisible()
  await expect(page.locator('.remaining-days')).toHaveText('残10日')
  await expect(page.locator('.balance-summary .remaining-days')).toBeVisible()
  await expect(page.locator('.remaining-days')).toHaveCSS('background-color', 'rgba(0, 0, 0, 0)')
  const dayFontSizes = await page.locator('.remaining-days').evaluate(element => ({
    number: Number.parseFloat(getComputedStyle(element.querySelector('strong')!).fontSize),
    labels: [...element.querySelectorAll('span')].map(label => Number.parseFloat(getComputedStyle(label).fontSize)),
  }))
  expect(dayFontSizes.labels.every(size => size < dayFontSizes.number)).toBe(true)
  await expect(page.locator('.today-card')).toHaveCSS('background-color', 'rgb(255, 255, 255)')
  await expect(page.locator('.today-card .today-icon svg')).toBeVisible()
  await expect(page.locator('.today-icon')).toHaveCSS('background-image', 'linear-gradient(145deg, rgb(53, 164, 255) 0%, rgb(30, 144, 255) 100%)')
  const days = await page.locator('.remaining-days').boundingBox()
  const balance = await page.locator('.balance-summary').boundingBox()
  const spent = await page.locator('.today-card').boundingBox()
  expect(days && spent && spent.y - (days.y + days.height)).toBeGreaterThanOrEqual(8)
  expect(spent?.x).toBe(balance?.x)
  expect(spent?.width).toBe(balance?.width)
  await expect(page.getByRole('progressbar', { name: '今月使えるお金の残りの割合' })).toHaveCount(0)
  await expect(page.getByText('¥1,200')).toBeVisible()
  await expect(page.getByText('今日も、自分のペースで。')).toBeVisible()
  for (const name of ['ホーム', 'カレンダー', 'グラフ']) await expect(page.getByRole('button', { name, exact: true })).toBeVisible()
  await expect(page.getByText('1日あたり')).toHaveCount(0)
  await expect(page.locator('.dog img')).toHaveCount(3)
  await expect.poll(() => page.locator('.dog img').evaluateAll(images => images.every(img => (img as HTMLImageElement).complete && (img as HTMLImageElement).naturalWidth > 0))).toBe(true)
})

test('月度が翌暦月にまたがっても末日まで選択できる', async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto('/')
  await page.getByRole('button', { name: 'カレンダー', exact: true }).click()
  await expect(page.locator('.calendar-screen')).toHaveCSS('background-color', 'rgb(1, 122, 244)')
  await expect(page.getByText('9月18日〜10月17日')).toBeVisible()
  await page.getByRole('button', { name: '10月17日、支出なし' }).click()
  await expect(page.getByRole('heading', { name: '10月17日' })).toBeVisible()
  await expect(page.getByRole('button', { name: '支出を入力する' })).toBeVisible()
  await expect(page.getByRole('button', { name: '10月18日、支出なし' })).toHaveCount(0)
  await page.screenshot({ path: testInfo.outputPath('calendar-period-390.png'), fullPage: true })
})

test('カレンダーから2030年12月度へ移動し、支出をスワイプして削除できる', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto('/')
  await page.getByRole('button', { name: 'カレンダー', exact: true }).click()
  await page.getByRole('button', { name: '表示する月度を選択' }).click()
  const picker = page.getByRole('dialog', { name: '表示する月度を選択' })
  await picker.getByRole('button', { name: '2030年' }).click()
  await picker.getByRole('button', { name: '12月' }).click()
  await expect(page.getByRole('button', { name: '表示する月度を選択' })).toContainText('2030年')
  await page.getByRole('button', { name: '表示する月度を選択' }).click()
  await picker.getByRole('button', { name: '2026年' }).click()
  await picker.getByRole('button', { name: '9月' }).click()
  await expect(page.getByRole('button', { name: '表示する月度を選択' })).toHaveText('2026年 9月')
  await expect(page.locator('.calendar-month-picker-trigger svg')).toHaveCount(0)
  await page.getByRole('button', { name: '9月21日、1,200円' }).click()
  const row = page.getByRole('button', { name: /ランチ、800円を編集/ })
  await expect(row).toHaveCSS('background-color', 'rgb(255, 255, 255)')
  await expect(row.locator('svg')).toHaveCount(0)
  const box = await row.boundingBox()
  if (!box) throw new Error('支出行が見つかりません')
  await page.mouse.move(box.x + box.width - 15, box.y + box.height / 2)
  await page.mouse.down()
  await page.mouse.move(box.x + 10, box.y + box.height / 2, { steps: 5 })
  await page.mouse.up()
  await expect(page.getByRole('dialog', { name: /支出/ })).toHaveCount(0)
  await expect(row).toHaveAttribute('data-open', 'true')
  await expect(row).toHaveCSS('background-color', 'rgb(238, 231, 229)')
  const openedBox = await row.boundingBox()
  if (!openedBox) throw new Error('開いた支出行が見つかりません')
  await page.mouse.move(openedBox.x + 80, openedBox.y + openedBox.height / 2)
  await page.mouse.down()
  await page.mouse.move(openedBox.x + 150, openedBox.y + openedBox.height / 2, { steps: 5 })
  await page.mouse.up()
  await page.mouse.move(1, 1)
  await expect(row).toHaveAttribute('data-open', 'false')
  await expect(row).toHaveCSS('background-color', 'rgb(255, 255, 255)')
  await expect(row).toHaveCSS('border-radius', '10px')
  const closedBox = await row.boundingBox()
  if (!closedBox) throw new Error('戻した支出行が見つかりません')
  await page.mouse.move(closedBox.x + closedBox.width - 15, closedBox.y + closedBox.height / 2)
  await page.mouse.down()
  await page.mouse.move(closedBox.x + 10, closedBox.y + closedBox.height / 2, { steps: 5 })
  await page.mouse.up()
  await expect(row).toHaveAttribute('data-open', 'true')
  await page.getByRole('button', { name: 'ランチ、800円の支出を削除' }).click()
  await expect(page.getByText('1件の支出')).toBeVisible()
  await expect(page.getByRole('button', { name: /ランチ、800円を編集/ })).toHaveCount(0)
})

for (const viewport of [{ width: 320, height: 667 }, { width: 390, height: 844 }, { width: 1440, height: 1000 }]) {
  test(`${viewport.width}pxで重なり・横スクロールがない`, async ({ page }, testInfo) => {
    await page.setViewportSize(viewport)
    await page.goto('/')
    const bounds = await page.evaluate(() => ({ width: document.documentElement.clientWidth, scrollWidth: document.documentElement.scrollWidth, height: document.documentElement.scrollHeight }))
    expect(bounds.scrollWidth).toBeLessThanOrEqual(bounds.width)
    if (viewport.width === 390) expect(bounds.height).toBeLessThanOrEqual(viewport.height)
    const names = ['.home-header', '.balance-card', '.today-card', '.record-button', '.bottom-nav']
    let bottom = 0
    for (const selector of names) {
      const rect = await page.locator(selector).boundingBox()
      expect(rect).not.toBeNull()
      expect(rect!.y).toBeGreaterThanOrEqual(bottom - 1)
      bottom = rect!.y + rect!.height
    }
    for (const button of await page.getByRole('button').all()) {
      const rect = await button.boundingBox()
      expect(rect!.width).toBeGreaterThanOrEqual(44)
      expect(rect!.height).toBeGreaterThanOrEqual(44)
    }
    await page.screenshot({ path: testInfo.outputPath(`home-${viewport.width}.png`), fullPage: true })
  })
}

test('支出ボトムシート・4つの閉じ方・破棄・フォーカス復帰', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto('/')
  const record = page.getByRole('button', { name: '入力する', exact: true })
  for (const close of ['button', 'backdrop', 'escape', 'save']) {
    await record.click()
    const dialog = page.getByRole('dialog')
    await expect(dialog).toBeVisible()
    const amount = page.getByRole('button', { name: '使った金額 0円' })
    await expect(page.getByRole('region', { name: '金額入力キーパッド' })).toHaveCount(0)
    await amount.click()
    await expect(page.getByRole('region', { name: '金額入力キーパッド' })).toBeVisible()
    await page.getByRole('button', { name: '1を入力' }).click()
    await page.getByRole('button', { name: '2を入力' }).click()
    await page.getByRole('button', { name: '0を入力' }).click()
    await page.getByRole('button', { name: '0を入力' }).click()
    await expect(page.getByRole('button', { name: '使った金額 1,200円' })).toBeVisible()
    await page.getByRole('textbox', { name: /メモ/ }).fill('ランチ')
    await expect(page.getByRole('textbox', { name: /メモ/ })).not.toHaveAttribute('required')
    if (close === 'button') {
      await page.screenshot({ path: 'test-results/expense-bottom-sheet.png' })
      await page.getByRole('button', { name: '閉じる', exact: true }).click()
    }
    if (close === 'backdrop') await page.mouse.click(12, 20)
    if (close === 'escape') await page.keyboard.press('Escape')
    if (close === 'save') await page.getByRole('button', { name: '保存する' }).click()
    await expect(dialog).toHaveCount(0)
    await expect(record).toBeFocused()
    await expect(page.getByLabel(close === 'save' ? '残り予算 47,000円' : '残り予算 48,200円')).toBeVisible()
    await expect(page.getByText(close === 'save' ? '¥2,400' : '¥1,200')).toBeVisible()
  }
  expect(await page.evaluate(() => localStorage.length)).toBe(0)
})

test('モーダルにフォーカスが留まり、動きを減らせる', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.goto('/')
  for (const selector of ['.dog', '.dog-head', '.dog-blink']) expect(await page.locator(selector).evaluate(el => getComputedStyle(el).animationName)).toBe('none')
  await page.getByRole('button', { name: '入力する', exact: true }).click()
  await page.getByRole('button', { name: '使った金額 0円' }).click()
  await page.getByRole('button', { name: '1を入力' }).click()
  const lastControl = page.getByRole('region', { name: '金額入力キーパッド' }).getByRole('button').last()
  await lastControl.focus()
  await page.keyboard.press('Tab')
  await expect(page.getByRole('button', { name: '閉じる', exact: true })).toBeFocused()
  await page.keyboard.press('Shift+Tab')
  await expect(lastControl).toBeFocused()
  await expect(page.getByRole('dialog')).toHaveAttribute('aria-labelledby', 'expense-title')
})

test('主要画面を移動し、設定した月予算をホームへ反映する', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto('/')
  await expect(page.getByLabel('残り予算 48,200円')).toBeVisible()

  await page.getByRole('button', { name: '設定', exact: true }).click()
  await expect(page.getByRole('heading', { name: '設定', exact: true })).toBeVisible()
  await expect(page.getByRole('switch', { name: '月初通知' })).toHaveAttribute('aria-checked', 'true')
  await page.getByRole('switch', { name: '月初通知' }).click()
  await expect(page.getByRole('switch', { name: '月初通知' })).toHaveAttribute('aria-checked', 'false')
  await page.getByRole('button', { name: /今月使える金額/ }).click()
  await expect(page.getByRole('heading', { name: '今月使える金額' })).toBeVisible()
  const moneyDialog = page.getByRole('dialog', { name: '今月使える金額' })
  for (let index = 0; index < 5; index += 1) await moneyDialog.getByRole('button', { name: '削除' }).click()
  await expect(moneyDialog.getByRole('textbox', { name: '今月使える金額' })).toHaveValue('0')
  await moneyDialog.getByRole('button', { name: '6を入力' }).click()
  for (let index = 0; index < 4; index += 1) await moneyDialog.getByRole('button', { name: '0を入力' }).click()
  await page.getByRole('button', { name: '保存する' }).click()
  await expect(page.getByText('¥60,000')).toBeVisible()
  await expect(page.getByRole('switch', { name: '月初通知' })).toHaveAttribute('aria-checked', 'false')
  await page.getByRole('button', { name: '設定を閉じる' }).click()
  await expect(page.getByLabel('残り予算 58,200円')).toBeVisible()
  await expect(page.getByRole('heading', { name: '9月' })).toBeVisible()

  await page.getByRole('button', { name: 'カレンダー', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'カレンダー' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'カレンダー', exact: true })).toHaveAttribute('aria-current', 'page')
  await page.getByRole('button', { name: '9月21日、1,200円' }).click()
  await expect(page.getByText('2件の支出')).toBeVisible()
  await page.getByRole('button', { name: 'ランチ、800円を編集' }).click()
  await expect(page.getByRole('heading', { name: '支出を編集' })).toBeVisible()
  await expect(page.getByRole('button', { name: '使った金額 800円' })).toBeVisible()
  await page.getByRole('button', { name: '閉じる', exact: true }).click()

  await page.getByRole('button', { name: 'グラフ', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'やりくり金額' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'グラフ', exact: true })).toHaveAttribute('aria-current', 'page')
  const yearButton = page.getByRole('button', { name: '2026年', exact: true })
  await expect(yearButton).toHaveAttribute('aria-expanded', 'false')
  await yearButton.click()
  const yearDialog = page.getByRole('dialog', { name: '表示する年' })
  await expect(yearDialog).toBeVisible()
  await expect(yearButton).toHaveAttribute('aria-expanded', 'true')
  await yearDialog.getByRole('radio', { name: '2026年' }).click()
  await expect(yearDialog).toHaveCount(0)
  await page.getByRole('button', { name: '2026年9月、9,400円' }).click()
  await expect(page.locator('.graph-summary strong')).toHaveText('¥9,400')

  await page.getByRole('button', { name: 'ホーム', exact: true }).click()
  await expect(page.getByLabel('残り予算 58,200円')).toBeVisible()
})

test('主要な文字色が通常テキストのコントラスト基準を満たす', async ({ page }) => {
  await page.goto('/')
  const tokens = await page.evaluate(() => {
    const css = getComputedStyle(document.documentElement)
    return Object.fromEntries(['--text', '--muted', '--surface', '--canvas', '--accent', '--secondary-surface'].map(name => [name, css.getPropertyValue(name).trim()]))
  })
  const luminance = (hex: string) => {
    const rgb = [1, 3, 5].map(offset => parseInt(hex.slice(offset, offset + 2), 16) / 255).map(n => n <= .04045 ? n / 12.92 : ((n + .055) / 1.055) ** 2.4)
    return rgb[0] * .2126 + rgb[1] * .7152 + rgb[2] * .0722
  }
  for (const [foreground, background] of [['--text', '--surface'], ['--muted', '--canvas'], ['--muted', '--surface'], ['--text', '--secondary-surface'], ['--surface', '--accent']]) {
    const values = [luminance(tokens[foreground]), luminance(tokens[background])].sort((a, b) => b - a)
    expect((values[0] + .05) / (values[1] + .05)).toBeGreaterThanOrEqual(4.5)
  }
})

test('グラフは余白を詰めて選択月と棒を連動表示する', async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto('/')
  await page.getByRole('button', { name: 'グラフ', exact: true }).click()

  const metrics = await page.evaluate(() => {
    const summary = document.querySelector<HTMLElement>('.graph-summary')!.getBoundingClientRect()
    const year = document.querySelector<HTMLElement>('.graph-year-switcher')!.getBoundingClientRect()
    const selection = document.querySelector<HTMLElement>('.chart-selection-summary')!.getBoundingClientRect()
    const chart = document.querySelector<HTMLElement>('.chart')!.getBoundingClientRect()
    const monthLabel = document.querySelector<HTMLElement>('.bar-label')!.getBoundingClientRect()
    const nav = document.querySelector<HTMLElement>('.bottom-nav')!.getBoundingClientRect()
    return {
      summaryToYear: year.top - summary.bottom,
      yearToSelection: selection.top - year.bottom,
      chartHeight: chart.height,
      labelToNav: nav.top - monthLabel.bottom,
    }
  })
  expect(metrics.summaryToYear).toBeLessThanOrEqual(24)
  expect(metrics.yearToSelection).toBeLessThanOrEqual(12)
  expect(metrics.chartHeight).toBeGreaterThanOrEqual(226)
  expect(metrics.labelToNav).toBeGreaterThanOrEqual(24)

  const january = page.getByRole('button', { name: '2026年1月、16,500円' })
  const december = page.getByRole('button', { name: '2026年12月、12,000円' })
  for (const month of [january, december]) {
    await month.click()
    const expectedAmount = month === january ? '¥16,500' : '¥12,000'
    await expect(page.locator('.graph-summary strong')).toHaveText(expectedAmount)
    const { track, card } = await page.evaluate(() => {
      const track = document.querySelector<HTMLElement>('.chart-selection-track')!.getBoundingClientRect()
      const card = document.querySelector<HTMLElement>('.chart-selection-summary')!.getBoundingClientRect()
      return { track: { left: track.left, right: track.right }, card: { left: card.left, right: card.right } }
    })
    expect(card.left).toBeGreaterThanOrEqual(track.left)
    expect(card.right).toBeLessThanOrEqual(track.right)
  }

  for (const viewport of [{ width: 320, height: 667 }, { width: 1440, height: 1000 }]) {
    await page.setViewportSize(viewport)
    const bounds = await page.evaluate(() => ({ width: document.documentElement.clientWidth, scrollWidth: document.documentElement.scrollWidth }))
    expect(bounds.scrollWidth).toBeLessThanOrEqual(bounds.width)
    const chart = await page.locator('.chart').boundingBox()
    expect(chart?.height).toBeGreaterThanOrEqual(226)
  }

  await page.setViewportSize({ width: 390, height: 844 })

  await page.getByRole('button', { name: '2026年', exact: true }).click()
  const yearDialog = page.getByRole('dialog', { name: '表示する年' })
  await expect(yearDialog).toBeVisible()
  await page.keyboard.press('Escape')
  await expect(yearDialog).toHaveCount(0)
  await page.screenshot({ path: testInfo.outputPath('graph-390.png'), fullPage: true })
})

test('グラフ上部の犬は月と金額を隠さない', async ({ page }) => {
  for (const viewport of [{ width: 320, height: 667 }, { width: 390, height: 844 }, { width: 1440, height: 1000 }]) {
    await page.setViewportSize(viewport)
    await page.goto('/')
    await page.getByRole('button', { name: 'グラフ', exact: true }).click()
    const dog = page.locator('.graph-summary-dog')
    await expect(dog).toBeVisible()
    const positions = await page.evaluate(() => {
      const image = document.querySelector<HTMLElement>('.graph-summary-dog')!.getBoundingClientRect()
      const amount = document.querySelector<HTMLElement>('.graph-summary strong')!
      const range = document.createRange()
      range.selectNodeContents(amount)
      return { dogLeft: image.left, amountRight: range.getBoundingClientRect().right }
    })
    expect(positions.amountRight).toBeLessThan(positions.dogLeft)
    await page.screenshot({ path: `test-results/graph-dog-${viewport.width}.png` })
  }
})
