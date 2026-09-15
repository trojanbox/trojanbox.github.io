import { test, expect, type Page } from '@playwright/test';

const article = '/articles/reading-guide/';
async function rendered(page: Page) {
  await expect(page.locator('[data-mermaid][data-rendered="true"] svg')).toBeVisible();
}
function contrast(first: string, second: string) {
  const luminance = (color: string) => {
    const channels = (color.match(/[\d.]+/g) ?? []).slice(0, 3).map(Number);
    if (channels.length !== 3) throw new Error(`Expected an RGB color, received ${color}`);
    const linear = channels.map(value => { const channel = value / 255; return channel <= .04045 ? channel / 12.92 : ((channel + .055) / 1.055) ** 2.4; });
    return linear[0] * .2126 + linear[1] * .7152 + linear[2] * .0722;
  };
  const a = luminance(first), b = luminance(second);
  return (Math.max(a, b) + .05) / (Math.min(a, b) + .05);
}

test('home puts real titles in the first screen without editorial decoration', async ({ page }) => {
  for (const width of [1440, 390, 320]) {
    await page.setViewportSize({ width, height: 844 });
    await page.goto('/');
    await expect(page.locator('.article-item h2').first()).toBeInViewport();
    await expect(page.locator('.topic-cover, .item-number, .page-kicker')).toHaveCount(0);
    await expect(page.locator('#main')).not.toContainText(/THE JOURNAL|LATEST|EXPLORE|INDEPENDENT EXPLORATION/);
    const titles = await page.locator('.topic-item h3').allTextContents();
    expect(titles.length).toBeGreaterThan(0);
    expect(new Set(titles).size).toBe(titles.length);
    await expect(page.locator('.topic-item')).toHaveCount(titles.length);
    const dimensions = await page.evaluate(() => ({ width: innerWidth, scroll: document.documentElement.scrollWidth }));
    expect(dimensions.scroll).toBeLessThanOrEqual(dimensions.width + 1);
  }
});

test('reading starts in the first screen and the native contents control is keyboard accessible', async ({ page }) => {
  for (const width of [1440, 390, 320]) {
    await page.setViewportSize({ width, height: 844 });
    await page.goto(article); await rendered(page);
    await expect(page.locator('.toc')).not.toHaveAttribute('open', '');
    await expect(page.locator('#article-body > p').first()).toBeInViewport({ ratio: .2 });
    await expect(page.locator('#article-body')).toHaveCSS('font-size', '18px');
    const family = await page.locator('#article-body').evaluate(el => getComputedStyle(el).fontFamily);
    expect(family).toContain('sans-serif');
    expect(family).not.toContain('Georgia');
  }
  await page.locator('.toc summary').focus();
  await page.keyboard.press('Enter');
  await expect(page.locator('.toc nav')).toBeVisible();
  const link = page.locator('.toc a').first();
  const href = await link.getAttribute('href');
  await link.click();
  expect(decodeURIComponent(new URL(page.url()).hash)).toBe(decodeURIComponent(href!));
});

test('320px layouts and the largest reading size keep overflow inside rich-content blocks', async ({ page }) => {
  test.setTimeout(60_000);
  await page.setViewportSize({ width: 320, height: 760 });
  for (const route of ['/', '/articles/', '/topics/', '/archive/', '/tags/', '/categories/站务/', article]) {
    await page.goto(route);
    if (route === article) await rendered(page);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
  }
  await page.locator('#article-settings').click();
  await page.locator('#font-size').focus();
  await page.keyboard.press('End');
  await expect(page.locator('#font-value')).toHaveText('26 px');
  expect(await page.locator('#settings-dialog').evaluate(el => el.scrollWidth <= el.clientWidth + 1)).toBe(true);
  await page.keyboard.press('Escape');
  await expect(page.locator('#article-body')).toHaveCSS('font-size', '26px');
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
});

test('skip link, settings focus return, and primary touch targets remain usable', async ({ page }) => {
  await page.goto('/');
  await page.keyboard.press('Tab');
  await expect(page.locator('.skip-link')).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(page.locator('#main')).toBeFocused();
  await page.locator('#open-settings').focus();
  await page.keyboard.press('Enter');
  await expect(page.locator('#settings-dialog')).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.locator('#open-settings')).toBeFocused();
  await page.setViewportSize({ width: 320, height: 760 });
  for (const element of await page.locator('.primary-nav a, #open-settings').all()) {
    const box = await element.boundingBox();
    expect(box).not.toBeNull();
    expect(box!.height).toBeGreaterThanOrEqual(44);
    expect(box!.width).toBeGreaterThanOrEqual(44);
  }
});

test('key text contrasts and browser theme colors follow both palettes', async ({ page, request }) => {
  await page.goto('/');
  for (const theme of ['light', 'dark']) {
    await page.locator('#open-settings').click();
    await page.locator(`[data-theme-choice="${theme}"]`).click();
    await page.keyboard.press('Escape');
    await expect(page.locator('html')).toHaveAttribute('data-theme', theme);
    await page.locator('.primary-nav [aria-current]').evaluate(async element => {
      await Promise.all(element.getAnimations().map(animation => animation.finished));
    });
    const colors = await page.evaluate(() => {
      const style = (selector: string) => getComputedStyle(document.querySelector(selector)!);
      return {
        paper: style('html').getPropertyValue('--paper').trim(),
        meta: document.querySelector<HTMLMetaElement>('#theme-color')!.content,
        pairs: [
          [style('.article-item h2').color, style('.content-panel').backgroundColor],
          [style('.article-summary').color, style('.content-panel').backgroundColor],
          [style('.topic-summary').color, style('.topic-item').backgroundColor],
          [style('.browse-sidebar h3').color, style('body').backgroundColor],
          [style('.primary-nav [aria-current]').color, style('.primary-nav [aria-current]').backgroundColor],
        ],
      };
    });
    expect(colors.meta).toBe(colors.paper);
    for (const [foreground, background] of colors.pairs) expect(contrast(foreground, background)).toBeGreaterThanOrEqual(4.5);
    if (theme === 'light') {
      const manifest = await (await request.get('/manifest.webmanifest')).json();
      expect(manifest.theme_color).toBe(colors.paper);
      expect(manifest.background_color).toBe(colors.paper);
    }
  }
});

test('capture redesigned home, settings, narrow reading and dark surfaces', async ({ page }, testInfo) => {
  const capture = async (name: string, fullPage = false) => {
    const path = testInfo.outputPath(`${name}.png`);
    await page.screenshot({ path, fullPage, animations: 'disabled' });
    await testInfo.attach(name, { path, contentType: 'image/png' });
  };
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto('/'); await capture('home-light', true);
  await page.locator('#open-settings').click(); await capture('settings-light');
  await page.locator('[data-theme-choice="dark"]').click();
  await page.keyboard.press('Escape'); await capture('home-dark', true);
  await page.goto(article); await rendered(page); await capture('reading-dark');
  await page.locator('#open-settings').click();
  await page.locator('[data-theme-choice="light"]').click();
  await page.keyboard.press('Escape');
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(article); await rendered(page); await capture('reading-mobile');
  await page.locator('#open-settings').click(); await capture('settings-mobile');
});
