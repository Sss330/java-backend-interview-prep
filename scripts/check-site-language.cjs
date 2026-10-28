// Build with Hugo, then run:
// node scripts/check-site-language.cjs <playwright-module> <browser-executable> <toml-module>
const assert = require('node:assert/strict');
const fs = require('node:fs');
const http = require('node:http');
const path = require('node:path');
const os = require('node:os');
const { chromium } = require(process.argv[2] || 'playwright');
const toml = require(process.argv[4] || '@iarna/toml');
const root = path.resolve(__dirname, '..');
function walk(dir) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap(entry =>
    entry.isDirectory() ? walk(path.join(dir, entry.name)) : [path.join(dir, entry.name)]);
}

async function main() {
  const publicDir = path.join(root, 'public');
  const prefix = '/java-backend-interview-prep/';
  const server = http.createServer((request, response) => {
    const url = new URL(request.url, 'http://localhost');
    if (!url.pathname.startsWith(prefix)) { response.writeHead(404).end(); return; }
    const relative = decodeURIComponent(url.pathname.slice(prefix.length));
    const file = path.resolve(publicDir, relative + (relative.endsWith('/') || !relative ? 'index.html' : ''));
    if (!file.startsWith(publicDir + path.sep) || !fs.existsSync(file) || !fs.statSync(file).isFile()) {
      response.writeHead(404).end(); return;
    }
    const types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png', '.json': 'application/json', '.svg': 'image/svg+xml' };
    response.setHeader('Content-Type', types[path.extname(file)] || 'application/octet-stream');
    response.end(fs.readFileSync(file));
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const base = `http://127.0.0.1:${server.address().port}${prefix}`;
  let browser;
  try {
    browser = await chromium.launch({ headless: true, ...(process.argv[3] ? { executablePath: process.argv[3] } : {}) });
    const makeContext = async options => {
      const context = await browser.newContext(options);
      await context.route('**/*', route => route.request().url().startsWith('http://127.0.0.1:') ? route.continue() : route.abort());
      return context;
    };
    const context = await makeContext();
    const page = await context.newPage();
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    const sourceDir = path.join(root, 'data/tech-questions');
    const categories = walk(sourceDir).filter(file => file.endsWith('.toml')).map(file => ({
      route: 'tech-questions/' + path.relative(sourceDir, file).replaceAll(path.sep, '/').replace(/\.toml$/, '/'),
      source: toml.parse(fs.readFileSync(file, 'utf8'))
    }));
    const anchorsByRoute = new Map();
    let total = 0;
    for (const category of categories) {
      await page.goto(base + category.route + '?lang=ru');
      await page.waitForFunction(() => document.documentElement.lang === 'ru');
      const ru = await page.locator('[data-question-id] > h4').evaluateAll(nodes => nodes.map(node => node.id));
      const ruTables = await page.locator('[data-answer] table').count();
      const ruCode = await page.locator('[data-answer] pre').count();
      await page.goto(base + 'en/' + category.route);
      assert.equal(await page.locator('html').getAttribute('lang'), 'en');
      const questions = page.locator('[data-question-id]');
      assert.equal(await questions.count(), category.source.questions.length, category.route);
      assert.doesNotMatch(await page.locator('article').innerText(), /[А-Яа-яЁё]/, category.route);
      const en = await page.locator('[data-question-id] > h4').evaluateAll(nodes => nodes.map(node => node.id));
      assert.deepEqual(en, ru, `Question anchors changed: ${category.route}`);
      anchorsByRoute.set(category.route, en);
      if (!category.route.includes('/collections/')) {
        assert.equal(await page.locator('[data-answer] table').count(), ruTables, `Tables: ${category.route}`);
        assert.equal(await page.locator('[data-answer] pre').count(), ruCode, `Code blocks: ${category.route}`);
      }
      assert.doesNotMatch(await page.locator('.book-menu').innerText(), /[А-Яа-яЁё]/, 'English navigation');
      const brokenImages = await page.locator('article img').evaluateAll(images => images.filter(img => !img.complete || !img.naturalWidth).map(img => img.src));
      assert.deepEqual(brokenImages, [], `Images: ${category.route}`);
      const tocTargets = await page.locator('#TableOfContents a').evaluateAll(links => links.map(link => decodeURIComponent(link.hash.slice(1))));
      for (const target of tocTargets) assert.ok(await page.evaluate(id => Boolean(document.getElementById(id)), target), 'Missing TOC target: ' + target);
      total += category.source.questions.length;
    }

    await page.goto(base + 'en/questions/');
    assert.equal(await page.locator('[data-question-link]').count(), total);
    const questionLinks = await page.locator('[data-question-link] a').evaluateAll(links => links.map(link => ({ path: new URL(link.href).pathname, hash: decodeURIComponent(link.hash.slice(1)) })));
    for (const link of questionLinks) {
      const route = link.path.slice((prefix + 'en/').length);
      assert.ok(anchorsByRoute.get(route)?.includes(link.hash), `Broken index link: ${link.path}#${link.hash}`);
    }
    assert.doesNotMatch(await page.locator('article').innerText(), /[А-Яа-яЁё]/);

    const spring = categories.find(category => category.route.includes('/spring/'));
    const anchor = anchorsByRoute.get(spring.route)[24];
    await page.goto(base + 'en/' + spring.route + '#' + encodeURIComponent(anchor));
    await page.locator('[data-language-link="ru"]').click();
    await page.waitForURL(url => !url.pathname.includes('/en/'));
    assert.equal(decodeURIComponent(new URL(page.url()).hash.slice(1)), anchor);
    assert.equal(await page.locator('html').getAttribute('lang'), 'ru');
    await page.locator('[data-language-link="en"]').click();
    await page.waitForURL(url => url.pathname.includes('/en/'));
    assert.equal(decodeURIComponent(new URL(page.url()).hash.slice(1)), anchor);

    // Saved preference works on old Russian links, with explicit overrides.
    await page.goto(base + 'tech-questions/data-management/sql/');
    await page.waitForURL(url => url.pathname.includes('/en/'));
    await page.goto(base + spring.route + '?lang=ru');
    assert.equal(await page.locator('html').getAttribute('lang'), 'ru');
    await page.goto(base + spring.route + '?lang=en');
    await page.waitForURL(url => url.pathname.includes('/en/'));
    await page.reload();
    assert.equal(await page.locator('html').getAttribute('lang'), 'en');

    // English search results link into the English site.
    const search = page.locator('#book-search-input');
    assert.equal(await search.getAttribute('placeholder'), 'Search');
    await search.fill('dependency injection');
    await search.press('n');
    await search.press('Backspace');
    await page.waitForFunction(() => document.querySelectorAll('#book-search-results a').length > 0);
    const results = await page.locator('#book-search-results a').evaluateAll(links => links.map(link => link.href));
    assert.ok(results.some(url => url.includes('/en/tech-questions/architecture/spring/')));
    assert.ok(results.every(url => new URL(url).pathname.startsWith(prefix + 'en/')));
    await search.fill('');
    await page.goto(base + 'en/' + spring.route);
    await page.screenshot({ path: path.join(os.tmpdir(), 'java-prep-english-spring.png') });
    await page.setViewportSize({ width: 390, height: 844 });
    const selector = page.locator('[data-language-switcher]');
    assert.equal(await selector.isVisible(), true);
    const bounds = await selector.boundingBox();
    assert.ok(bounds.x >= 0 && bounds.x + bounds.width <= 390);
    await page.screenshot({ path: path.join(os.tmpdir(), 'java-prep-english-mobile.png') });

    const blocked = await makeContext();
    await blocked.addInitScript(() => Object.defineProperty(window, 'localStorage', { get() { throw new Error('Storage disabled'); } }));
    const blockedPage = await blocked.newPage();
    await blockedPage.goto(base + spring.route + '?lang=invalid');
    assert.equal(await blockedPage.locator('html').getAttribute('lang'), 'ru');
    await blockedPage.locator('[data-language-link="en"]').click();
    await blockedPage.waitForURL(url => url.pathname.includes('/en/'));
    assert.equal(await blockedPage.locator('html').getAttribute('lang'), 'en');
    await blocked.close();

    const legacy = await makeContext();
    await legacy.addInitScript(() => localStorage.setItem('collections-language', 'en'));
    const legacyPage = await legacy.newPage();
    await legacyPage.goto(base + 'tech-questions/fundamentals/collections/');
    await legacyPage.waitForURL(url => url.pathname.includes('/en/'));
    await legacy.close();

    const noJs = await makeContext({ javaScriptEnabled: false });
    const staticPage = await noJs.newPage();
    await staticPage.goto(base + spring.route);
    await staticPage.locator('[data-language-link="en"]').click();
    assert.equal(await staticPage.locator('html').getAttribute('lang'), 'en');
    assert.equal(await staticPage.locator('[data-question-id]').count(), 53);
    await noJs.close();
    assert.deepEqual(errors, []);
    console.log(`PASS: ${total} questions in ${categories.length} categories, both locales, all index links and anchors, images, tables, code, English search, persistence, mobile, blocked storage, legacy preference, and no-JS switching.`);
  } finally {
    if (browser) await browser.close();
    await new Promise(resolve => server.close(resolve));
  }
}
main().catch(error => { console.error(error); process.exitCode = 1; });
