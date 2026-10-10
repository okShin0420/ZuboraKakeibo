import { chromium } from 'playwright';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const browser = await chromium.launch({ channel: 'msedge', headless: true });
try {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
  const page = await context.newPage();
  await page.goto(pathToFileURL(resolve('../docs/design/monthly-budget-preview.html')).href);
  await page.screenshot({ path: resolve('../docs/design/monthly-budget-preview.png') });
  await page.screenshot({ path: resolve('../docs/design/monthly-budget-preview-keypad.png') });
  console.log('Monthly welcome previews saved.');
} finally {
  await browser.close();
}
