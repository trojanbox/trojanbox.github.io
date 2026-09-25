import { test, expect, type Page } from '@playwright/test';

const article = '/articles/reading-guide/';
async function requirePublishedReadingGuide(page: Page) {
  test.skip(!(await page.request.get(article)).ok(), 'No public article is currently published.');
}

test('reading container stays narrow on desktop and full-width on phones', async ({ page }) => {
  await requirePublishedReadingGuide(page);
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto('/');
  const home = await page.locator('#main').boundingBox();
  await page.goto(article);
  const main = await page.locator('#main').boundingBox();
  const prose = await page.locator('#article-body').boundingBox();
  expect(home).not.toBeNull(); expect(main).not.toBeNull(); expect(prose).not.toBeNull();
  expect(main!.width).toBeLessThan(home!.width);
  expect(main!.width).toBeLessThanOrEqual(864);
  expect(prose!.width).toBeGreaterThanOrEqual(680);
  expect(prose!.width).toBeLessThanOrEqual(760);
  for (const width of [390, 320]) {
    await page.setViewportSize({ width, height: 844 });
    const mobile = await page.locator('#main').boundingBox();
    const text = await page.locator('#article-body').boundingBox();
    expect(mobile).not.toBeNull(); expect(text).not.toBeNull();
    expect(mobile!.x).toBe(0);
    expect(mobile!.width).toBe(width);
    expect(text!.x).toBe(20);
    expect(text!.width).toBe(width - 40);
  }
});

test('actual Chinese glyphs use an installed sans font, not a serif fallback', async ({ page, browserName }, testInfo) => {
  await requirePublishedReadingGuide(page);
  test.skip(browserName !== 'chromium', 'Chromium platform-font inspection uses CDP.');
  await page.goto(article);
  await page.evaluate(() => document.fonts.ready);
  const client = await page.context().newCDPSession(page);
  try {
    await client.send('DOM.enable');
    await client.send('CSS.enable');
    const { root } = await client.send('DOM.getDocument');
    for (const [label, selector] of [['title', '.article-header h1'], ['body', '#article-body > p:nth-of-type(2)']]) {
      const { nodeId } = await client.send('DOM.querySelector', { nodeId: root.nodeId, selector });
      expect(nodeId).toBeGreaterThan(0);
      const { fonts } = await client.send('CSS.getPlatformFontsForNode', { nodeId });
      await testInfo.attach(`rendered-fonts-${label}`, { body: JSON.stringify(fonts, null, 2), contentType: 'application/json' });
      const used = fonts.filter(font => font.glyphCount > 0);
      expect(used.length).toBeGreaterThan(0);
      expect(used.some(font => /WenQuanYi|Noto Sans|PingFang|YaHei|Heiti|Droid Sans|Source Han Sans/i.test(font.familyName))).toBe(true);
      for (const font of used) expect(font.familyName).not.toMatch(/Serif|Song|Ming|Mincho|Times/i);
    }
  } finally { await client.detach(); }
});
