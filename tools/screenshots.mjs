// Serves public/ locally, opens every page on desktop and iPhone sizes,
// saves full-page screenshots to shots/, and fails on JavaScript errors,
// missing local files (4xx/5xx from the local server) or sideways scrolling
// on the phone. Outside hosts (analytics, fonts) are blocked so the run
// never sends real traffic.
import { chromium, devices } from 'playwright';
import { createServer } from 'node:http';
import { readFile, readdir, mkdir } from 'node:fs/promises';
import { extname, join, normalize } from 'node:path';

const ROOT = new URL('../public/', import.meta.url).pathname;
const TYPES = { '.html': 'text/html', '.css': 'text/css', '.js': 'text/javascript', '.png': 'image/png',
  '.webp': 'image/webp', '.svg': 'image/svg+xml', '.jpg': 'image/jpeg', '.ico': 'image/x-icon',
  '.mp4': 'video/mp4', '.webm': 'video/webm', '.json': 'application/json', '.woff2': 'font/woff2' };

const server = createServer(async (req, res) => {
  let path = decodeURIComponent(new URL(req.url, 'http://x').pathname);
  if (path.endsWith('/')) path += 'index.html';
  const file = normalize(join(ROOT, path));
  if (!file.startsWith(ROOT)) { res.writeHead(403).end(); return; }
  for (const f of [file, file + '.html']) {
    try {
      const body = await readFile(f);
      res.writeHead(200, { 'content-type': TYPES[extname(f)] || 'application/octet-stream' }).end(body);
      return;
    } catch {}
  }
  res.writeHead(404).end('not found');
});
await new Promise(r => server.listen(0, '127.0.0.1', r));
const origin = `http://127.0.0.1:${server.address().port}`;

const pages = (await readdir(ROOT)).filter(f => f.endsWith('.html')).sort();
const sizes = [
  ['desktop', { viewport: { width: 1440, height: 900 } }],
  ['iphone', devices['iPhone 13']],
];
await mkdir('shots', { recursive: true });
const browser = await chromium.launch();
const problems = [];
for (const [label, opts] of sizes) {
  const ctx = await browser.newContext(opts);
  await ctx.route('**/*', route =>
    route.request().url().startsWith(origin) || route.request().url().startsWith('data:')
      ? route.continue() : route.abort());
  for (const name of pages) {
    const page = await ctx.newPage();
    page.on('pageerror', e => problems.push(`${label} ${name}: script error: ${e.message}`));
    page.on('response', r => {
      if (r.url().startsWith(origin) && r.status() >= 400) problems.push(`${label} ${name}: ${r.status()} ${r.url().slice(origin.length)}`);
    });
    page.on('console', m => { if (m.type() === 'error') console.log(`note ${label} ${name}: console: ${m.text()}`); });
    await page.goto(`${origin}/${name}`, { waitUntil: 'load' });
    await page.waitForTimeout(500);
    if (label === 'iphone') {
      const wide = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
      if (wide > 1) problems.push(`${label} ${name}: page scrolls sideways by ${wide}px`);
    }
    await page.screenshot({ path: `shots/${label}-${name.replace('.html', '')}.png`, fullPage: true });
    await page.close();
  }
  await ctx.close();
}
await browser.close();
server.close();
console.log(`${pages.length} pages x ${sizes.length} sizes checked`);
if (problems.length) { console.error(problems.join('\n')); process.exit(1); }
