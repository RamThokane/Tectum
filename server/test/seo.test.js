import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { isKnownPage, robotsTxt, sitemapXml, canonicalFor, withCanonical } from '../src/utils/seo.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

test('known app pages vs unknown addresses', () => {
  for (const p of ['/', '/home', '/cases', '/cases/6abf7abe0ee3b3679194b1b9', '/ward/anatomy', '/legal/terms', '/collaboration', '/profile/6abf7abe0ee3b3679194b1b9/']) {
    assert.equal(isKnownPage(p), true, p);
  }
  for (const p of ['/this-page-does-not-exist', '/nope', '/legal/refunds', '/post/123', '/cases/x/y']) {
    assert.equal(isKnownPage(p), false, p);
  }
});

test('robots.txt blocks the signed-in app and points to the sitemap', () => {
  const txt = robotsTxt('https://www.tectum.co.in');
  assert.match(txt, /Disallow: \/home/);
  assert.match(txt, /Disallow: \/api\//);
  assert.match(txt, /Sitemap: https:\/\/www\.tectum\.co\.in\/sitemap\.xml/);
});

test('sitemap lists the public pages', () => {
  const xml = sitemapXml('https://www.tectum.co.in', '2026-10-02');
  for (const p of ['/', '/legal/terms', '/legal/privacy', '/signup']) assert.ok(xml.includes(`<loc>https://www.tectum.co.in${p}</loc>`), p);
  assert.ok(!xml.includes('/home'));
});

test('canonical link', () => {
  assert.equal(canonicalFor('https://x.in', '/cases/'), 'https://x.in/cases');
  assert.equal(canonicalFor('https://x.in', '/'), 'https://x.in/');
  const html = withCanonical('<head><link rel="canonical" href="https://x.in/" /></head>', 'https://x.in/wards');
  assert.equal((html.match(/rel="canonical"/g) ?? []).length, 1);
  assert.ok(html.includes('href="https://x.in/wards"'));
});

// The real app in production mode (it only serves the built web app there).
const dist = path.resolve(__dirname, '../../client/dist/index.html');
test('production server: 404 for unknown pages, text/plain robots.txt', { skip: !fs.existsSync(dist) && 'client not built' }, async () => {
  const script = `
    const { createApp } = await import('./src/app.js');
    const s = createApp().listen(0, () => console.log('PORT=' + s.address().port));
  `;
  const child = spawn(process.execPath, ['--input-type=module', '-e', script], {
    cwd: path.resolve(__dirname, '..'),
    env: { ...process.env, NODE_ENV: 'production', CLIENT_URL: 'https://www.tectum.co.in', MONGO_URI: 'mongodb://127.0.0.1:1/unused', JWT_SECRET: 'x'.repeat(32), DOTENV_CONFIG_PATH: 'none' },
  });
  try {
    const port = await new Promise((resolve, reject) => {
      child.stdout.on('data', (d) => {
        const m = String(d).match(/PORT=(\d+)/);
        if (m) resolve(m[1]);
      });
      child.on('exit', (code) => reject(new Error(`server exited ${code}`)));
      setTimeout(() => reject(new Error('server did not start')), 15000);
    });
    const base = `http://127.0.0.1:${port}`;
    const nope = await fetch(`${base}/nope`, { method: 'HEAD' });
    assert.equal(nope.status, 404);
    const page = await fetch(`${base}/this-page-does-not-exist`);
    assert.equal(page.status, 404);
    assert.match(await page.text(), /<div id="root">/); // the app still loads and shows its own 404 page
    const home = await fetch(`${base}/cases`);
    assert.equal(home.status, 200);
    assert.match(await home.text(), /<link rel="canonical" href="https:\/\/www\.tectum\.co\.in\/cases" \/>/);
    const robots = await fetch(`${base}/robots.txt`);
    assert.equal(robots.status, 200);
    assert.match(robots.headers.get('content-type'), /^text\/plain/);
    const sitemap = await fetch(`${base}/sitemap.xml`);
    assert.match(sitemap.headers.get('content-type'), /xml/);
  } finally {
    child.kill();
  }
});
