import { test, expect, type Page } from '@playwright/test';
import fs from 'node:fs/promises';
const article = '/articles/reading-guide/';
async function ready(page: Page) {
  await page.evaluate(async () => { await navigator.serviceWorker.ready; });
  await expect.poll(() => page.evaluate(() => Boolean(navigator.serviceWorker.controller))).toBe(true);
}
async function rendered(page: Page) {
  await expect(page.locator('[data-mermaid][data-rendered="true"] svg')).toBeVisible();
  await expect(page.locator('.katex-display')).toBeVisible();
}

test('navigation, topics, category, tags, archive, RSS, and draft exclusion', async ({ page, request }) => {
  await page.goto('/');
  await expect(page.locator('nav[aria-label="主导航"] a')).toHaveText(['首页', '文章', '专题', '归档']);
  await expect(page.locator('#main')).not.toContainText(/精选|热门|个人介绍/);
  await page.getByRole('link', { name: '浏览全部文章' }).click();
  await expect(page).toHaveURL(/\/articles\/$/);
  await page.locator('.category-nav').getByRole('link', { name: '站务' }).click();
  await expect(page.locator('h1')).toContainText('站务');
  await page.goto('/tags/');
  await page.getByRole('link', { name: /Mermaid/ }).click();
  await expect(page.locator('h1')).toContainText('Mermaid');
  await page.goto('/archive/');
  await expect(page.locator('.archive-year')).toContainText('阅读，从这里开始');
  await page.goto('/topics/');
  const external = page.getByRole('link', { name: '进入独立专题' });
  await expect(external).toHaveAttribute('href', 'https://trojanbox.github.io/world-history-in-progress/');
  await expect(external).toHaveAttribute('target', '_blank');
  expect((await request.get('/articles/draft-example/')).status()).toBe(404);
  expect(await (await request.get('/rss.xml')).text()).not.toContain('草稿');
  expect(await (await request.get('/sitemap.xml')).text()).not.toContain('draft-example');
});

test('article renders diagrams, formulas, code, table, image, footnotes and links in both themes', async ({ page }) => {
  const errors: string[] = []; page.on('pageerror', error => errors.push(error.message));
  await page.goto(article); await rendered(page);
  await expect(page.locator('.toc')).toBeVisible();
  await expect(page.locator('.heading-anchor').first()).toHaveAttribute('href', /#/);
  await expect(page.locator('.astro-code')).toBeVisible();
  await expect(page.locator('.table-scroll table')).toBeVisible();
  await expect(page.locator('figcaption')).toBeVisible();
  await expect(page.locator('.article-image img')).toHaveAttribute('width', /[1-9][0-9]*/);
  await expect(page.locator('.article-image img')).toHaveAttribute('height', /[1-9][0-9]*/);
  const lightCodeBackground = await page.locator('.astro-code').evaluate(el => getComputedStyle(el).backgroundColor);
  await expect(page.locator('.footnotes')).toBeVisible();
  await expect(page.locator('.katex').first()).toBeVisible();
  await page.locator('#open-settings').click();
  await page.locator('[data-theme-choice="dark"]').click();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  await page.locator('#close-settings').click(); await rendered(page);
  expect(await page.locator('.astro-code').evaluate(el => getComputedStyle(el).backgroundColor)).not.toBe(lightCodeBackground);
  expect(errors).toEqual([]);
});

test('preferences persist and reset without affecting unrelated project storage', async ({ page }) => {
  await page.goto(article);
  await page.evaluate(() => localStorage.setItem('world-history:settings', 'untouched'));
  await page.locator('#open-settings').click();
  await page.locator('#font-larger').click(); await page.locator('[data-theme-choice="dark"]').click();
  await page.reload();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  await expect.poll(() => page.locator('#article-body').evaluate(el => getComputedStyle(el).fontSize)).toBe('19px');
  await page.locator('#open-settings').click(); await page.locator('#reset-settings').click();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
  expect(await page.evaluate(() => localStorage.getItem('world-history:settings'))).toBe('untouched');
  await page.keyboard.press('Escape'); await expect(page.locator('#settings-dialog')).not.toBeVisible();
});

test('reading progress is relative to the article and supports explicit resume', async ({ page }) => {
  await page.goto(article); await rendered(page);
  await page.evaluate(() => {
    const body = document.querySelector('#article-body')!;
    scrollTo(0, body.getBoundingClientRect().top + scrollY + Math.max(0, (body as HTMLElement).offsetHeight - innerHeight) * .4);
  });
  await expect.poll(async () => Number((await page.locator('#reading-percent').textContent())?.replace('%', ''))).toBeGreaterThan(30);
  await expect.poll(() => page.evaluate(() => JSON.parse(localStorage.getItem('trojanbox-main:progress:v1:reading-guide') ?? '{}').progress ?? 0)).toBeGreaterThan(.3);
  await page.goto('/'); await page.goto(article); await rendered(page);
  await expect(page.locator('#resume-reading')).toBeVisible(); await page.locator('#resume-button').click();
  await expect(page.locator('#resume-reading')).not.toBeVisible();
  await expect.poll(async () => Number((await page.locator('#reading-percent').textContent())?.replace('%', ''))).toBeGreaterThan(30);
});

test('corrupt or denied storage never blocks content or preferences in memory', async ({ page }) => {
  await page.addInitScript(() => {
    Storage.prototype.getItem = () => { throw new DOMException('Storage denied', 'SecurityError'); };
    Storage.prototype.setItem = () => { throw new DOMException('Storage denied', 'SecurityError'); };
  });
  await page.goto(article); await rendered(page);
  await page.locator('#open-settings').click(); await page.locator('#font-larger').click();
  await expect(page.locator('#storage-note')).toContainText('本次阅读生效');
  await expect.poll(() => page.locator('#article-body').evaluate(el => getComputedStyle(el).fontSize)).toBe('19px');
});

test('first article visit is cached, including Mermaid, math and local images', async ({ page, context }) => {
  await page.goto(article); await rendered(page); await ready(page);
  await expect.poll(() => page.evaluate(async () => Boolean(await (await caches.open('trojanbox-main:documents:v1')).match(location.origin + '/articles/reading-guide/')))).toBe(true);
  await expect.poll(() => page.evaluate(async () => Boolean(await (await caches.open('trojanbox-main:assets:v1')).match(location.origin + '/media/reading-mark.svg')))).toBe(true);
  await context.setOffline(true); await page.reload(); await rendered(page);
  await page.locator('.article-image img').scrollIntoViewIfNeeded();
  await expect.poll(() => page.locator('.article-image img').evaluate((image: HTMLImageElement) => image.complete && image.naturalWidth > 0)).toBe(true);
  expect(await page.locator('.article-image img').evaluate((image: HTMLImageElement) => image.complete && image.naturalWidth > 0)).toBe(true);
  await expect(page.locator('.prose')).toContainText('断网时，继续已读的文章');
});

test('unvisited article gets an honest offline fallback', async ({ page, context }) => {
  await page.goto('/'); await ready(page);
  await context.setOffline(true); const response = await page.goto(article);
  expect(response?.status()).toBe(503);
  await expect(page.locator('h1')).toContainText('暂时断开');
});

test('main worker leaves other project responses and caches alone', async ({ page }) => {
  test.skip(Boolean(process.env.TEST_BASE_URL), 'Local independent-project fixture only');
  await fs.mkdir('dist/world-history-in-progress', { recursive: true });
  await fs.writeFile('dist/world-history-in-progress/test.html', '<!doctype html><html lang="zh-CN"><title>Independent</title><body>Independent project</body></html>');
  try {
    await page.goto('/'); await ready(page);
    await page.evaluate(async () => { await (await caches.open('world-history-cache')).put('/independent-data', new Response('keep')); });
    const response = await page.goto('/world-history-in-progress/test.html');
    expect(response?.fromServiceWorker()).toBe(false);
    await expect(page.locator('body')).toHaveText('Independent project');
    expect(await page.evaluate(async () => (await caches.keys()).includes('world-history-cache'))).toBe(true);
  } finally { await fs.rm('dist/world-history-in-progress', { recursive: true, force: true }); }
});

test('mobile layouts and maximum font size have no page-level horizontal overflow', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  for (const route of ['/', '/topics/', '/articles/', '/archive/', article]) {
    await page.goto(route); if (route === article) await rendered(page);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
  }
  await page.locator('#open-settings').click();
  await page.locator('#font-size').focus(); await page.locator('#font-size').press('End'); await page.locator('#close-settings').click();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
});

test('manifest and installation help are meaningful', async ({ page, request }) => {
  const manifest = await (await request.get('/manifest.webmanifest')).json();
  expect(manifest.display).toBe('standalone'); expect(manifest.start_url).toBe('/');
  for (const icon of manifest.icons) expect((await request.get(icon.src)).ok()).toBe(true);
  await page.addInitScript(() => window.addEventListener('beforeinstallprompt', event => event.stopImmediatePropagation(), true));
  await page.goto('/'); await page.locator('#footer-install').click();
  await expect(page.locator('#install-help')).toContainText('添加到主屏幕');
});

test('new worker waits for consent, keeps reading settings and unrelated caches', async ({ page }) => {
  test.skip(Boolean(process.env.TEST_BASE_URL), 'Local build mutation test only');
  const original = await fs.readFile('dist/sw.js', 'utf8');
  await page.goto(article); await ready(page);
  await page.evaluate(async () => {
    localStorage.setItem('trojanbox-main:settings:v1', '{"version":1,"theme":"dark","fontSize":21}');
    await (await caches.open('unrelated-topic-cache')).put('/other', new Response('safe'));
  });
  try {
    await fs.writeFile('dist/sw.js', original.replace(/"version":"[^"]+"/, '"version":"e2e-new-version"'));
    await page.evaluate(async () => { await (await navigator.serviceWorker.getRegistration('/'))!.update(); });
    await expect(page.locator('#update-notice')).toBeVisible();
    await Promise.all([page.waitForEvent('framenavigated', { predicate: frame => frame === page.mainFrame() }), page.locator('#apply-update').click()]);
    await page.waitForLoadState('domcontentloaded');
    await expect.poll(() => page.evaluate(async () => (await caches.keys()).includes('trojanbox-main:shell:e2e-new-version'))).toBe(true);
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
    expect(await page.evaluate(async () => (await caches.keys()).includes('unrelated-topic-cache'))).toBe(true);
  } finally { await fs.writeFile('dist/sw.js', original); }
});


test('capture the actual desktop, mobile and dark reading surfaces', async ({ page }) => {
  await fs.mkdir('test-results/screenshots', { recursive: true });
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto('/'); await page.screenshot({ path: 'test-results/screenshots/home-desktop.png', fullPage: true });
  await page.goto(article); await rendered(page);
  await page.screenshot({ path: 'test-results/screenshots/reading-desktop.png', fullPage: true });
  await page.locator('#open-settings').click(); await page.locator('[data-theme-choice="dark"]').click(); await page.locator('#close-settings').click();
  await rendered(page); await page.screenshot({ path: 'test-results/screenshots/reading-dark.png', fullPage: true });
  await page.locator('#open-settings').click(); await page.locator('[data-theme-choice="light"]').click(); await page.locator('#close-settings').click();
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/'); await page.screenshot({ path: 'test-results/screenshots/home-mobile.png', fullPage: true });
});
