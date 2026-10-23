/** Browser acceptance check for the focused, shareable exoplanet review. */
import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { chromium } from 'playwright-core';

const url = process.env.EXO_REVIEW_URL ?? 'http://127.0.0.1:5294/exo/';
const output = process.env.EXO_REVIEW_OUTPUT ?? path.resolve('review-output');
await mkdir(output, { recursive: true });
const browser = await chromium.launch({ headless: true, ...(process.env.VZF_CHROME ? { executablePath: process.env.VZF_CHROME } : {}) });
const context = await browser.newContext({ viewport: { width: 1440, height: 1080 }, acceptDownloads: true });
const page = await context.newPage();
const errors = [];
page.on('pageerror', (error) => errors.push(error.message));
const ready = async (target) => {
  await target.getByRole('heading', { name: 'One planet. Several published values.' }).waitFor({ timeout: 90000 });
};
const receipt = async (target) => {
  const record = target.locator('details').filter({ has: target.locator('summary', { hasText: 'Inspect the execution record' }) });
  if ((await record.getAttribute('open')) === null) await record.locator('summary').click();
  const downloadReady = target.waitForEvent('download');
  await target.getByRole('button', { name: 'Download review evidence' }).click();
  const download = await downloadReady;
  const stream = await download.createReadStream();
  const chunks = [];
  for await (const chunk of stream) chunks.push(chunk);
  return JSON.parse(Buffer.concat(chunks).toString('utf8'));
};
try {
  await page.goto(url);
  await ready(page);
  assert.match(await page.locator('main').innerText(), /26 publication rows[\s\S]*19 report a radius value/);
  assert.equal(await page.getByLabel('Publication A', { exact: true }).inputValue(), 'TrES-2 b#0');
  assert.equal(await page.getByLabel('Publication B', { exact: true }).inputValue(), 'TrES-2 b#1');
  assert.match(await page.locator('.exo-measurement-0').innerText(), /13\.89916[\s\S]*1\.00881[\s\S]*0\.67254/);
  assert.match(await page.locator('.exo-composite-card').innerText(), /Stassun[\s\S]*uncertainties were not downloaded/);
  for (const href of await page.locator('.exo-measurement-source a').evaluateAll((links) => links.map((link) => link.href))) assert.match(href, /^https?:\/\//);
  await page.screenshot({ path: path.join(output, 'exoplanet-review-desktop.png'), fullPage: true });

  await page.getByLabel('Publication B', { exact: true }).selectOption('TrES-2 b#19');
  await page.getByRole('button', { name: 'Copy review link' }).click();
  await page.getByRole('link', { name: 'Open this saved evidence review' }).waitFor();
  const sharedUrl = await page.getByRole('link', { name: 'Open this saved evidence review' }).getAttribute('href');
  assert.ok(sharedUrl.includes('#review='));
  // A separate context proves this is a link, not remembered tab state.
  const freshContext = await browser.newContext({ viewport: { width: 1440, height: 1080 }, acceptDownloads: true });
  const fresh = await freshContext.newPage();
  fresh.on('pageerror', (error) => errors.push(error.message));
  await fresh.goto(sharedUrl);
  await ready(fresh);
  assert.equal(await fresh.getByLabel('Publication B', { exact: true }).inputValue(), 'TrES-2 b#19');
  const before = await receipt(fresh);
  assert.equal(before.execution.filter((record) => record.viewId.startsWith('analysis:')).length, 5);
  assert.equal(before.execution.length, 6);
  await fresh.getByRole('button', { name: 'Replay this review' }).click();
  await fresh.getByRole('status').filter({ hasText: 'Replay complete' }).waitFor();
  const after = await receipt(fresh);
  assert.deepEqual(after.review, before.review);
  assert.deepEqual(after.publications, before.publications);
  assert.deepEqual(after.composite, before.composite);
  assert.equal(after.execution.length, 6);
  console.log('Passed: source cards, paper links, fresh-context sharing and fresh-session replay.');

  await fresh.getByLabel('Parameter', { exact: true }).selectOption('mass');
  await fresh.getByRole('button', { name: 'Copy review link' }).click();
  const massUrl = await fresh.getByRole('link', { name: 'Open this saved evidence review' }).getAttribute('href');
  const massPage = await context.newPage();
  await massPage.goto(massUrl);
  await ready(massPage);
  assert.equal(await massPage.getByLabel('Parameter', { exact: true }).inputValue(), 'mass');
  await massPage.getByLabel('Planet', { exact: true }).fill('14 Her b');
  await massPage.getByRole('button', { name: 'Explore', exact: true }).click();
  await massPage.getByRole('heading', { name: '14 Her b, by publication' }).waitFor();
  await massPage.getByText('These records use different mass provenance types.', { exact: false }).waitFor();
  assert.match(await massPage.locator('.exo-composite-card').innerText(), /Provenance: Mass/);
  const massReceipt = await receipt(massPage);
  assert.equal(massReceipt.compositeSourceRow.mass_kind, 'Mass');
  assert.ok(massReceipt.publications.every((row) => row.measurement.mass_kind === 'Mass' || row.comparison.position === 'not-comparable'));

  const emptyUrl = new URL(sharedUrl);
  const empty = JSON.parse(decodeURIComponent(emptyUrl.hash.slice('#review='.length)));
  empty.measurementIds = [];
  emptyUrl.hash = `review=${encodeURIComponent(JSON.stringify(empty))}`;
  const emptyPage = await context.newPage();
  await emptyPage.goto(emptyUrl.href);
  await ready(emptyPage);
  assert.ok(await emptyPage.getByLabel('Publication B', { exact: true }).isDisabled());
  await emptyPage.getByLabel('Publication A', { exact: true }).selectOption('TrES-2 b#0');
  await emptyPage.getByRole('button', { name: 'Copy review link' }).click();
  const dense = JSON.parse(decodeURIComponent(new URL(await emptyPage.getByRole('link', { name: 'Open this saved evidence review' }).getAttribute('href')).hash.slice('#review='.length)));
  assert.deepEqual(dense.measurementIds, ['TrES-2 b#0']);
  console.log('Passed: mass provenance and empty-selection sharing.');

  // A stale pin must refuse, and must not silently switch the source slice.
  const invalidUrl = new URL(sharedUrl);
  const invalid = JSON.parse(decodeURIComponent(invalidUrl.hash.slice('#review='.length)));
  invalid.sources.ps = '0'.repeat(64);
  invalidUrl.hash = `review=${encodeURIComponent(JSON.stringify(invalid))}`;
  const invalidPage = await context.newPage();
  await invalidPage.goto(invalidUrl.href);
  await invalidPage.getByText('Its row ids cannot be replayed against this version.', { exact: false }).waitFor();
  assert.equal(await invalidPage.locator('.exo-review').count(), 0);

  // The bytes themselves, not only a manifest, must match.
  const alteredPage = await context.newPage();
  await alteredPage.route('**/data/exo/ps.csv', async (route) => {
    const response = await route.fetch();
    await route.fulfill({ response, body: `${await response.text()}\n` });
  });
  await alteredPage.goto(url);
  await alteredPage.getByText('SHA-256', { exact: false }).first().waitFor({ timeout: 90000 });
  assert.equal(await alteredPage.locator('.exo-review').count(), 0);

  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({ path: path.join(output, 'exoplanet-review-mobile.png'), fullPage: true });
  assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1), 'mobile page must not overflow horizontally');
  assert.deepEqual(errors, []);
  await writeFile(path.join(output, 'browser-check.json'), JSON.stringify({ passed: true, checkedAt: new Date().toISOString(), url, sharedUrl, checks: ['real paper links', 'asymmetric reported uncertainties', 'separate composite source', 'fresh-context link restore', 'fresh-session replay', 'same source rows before and after replay', 'parameter restoration', 'stale source refusal', 'altered CSV refusal', 'mobile layout', 'no page errors'], receipt: after }, null, 2));
  console.log('Exoplanet review acceptance check passed. Screenshots and evidence saved to', output);
} catch (error) {
  await page.screenshot({ path: path.join(output, 'failed-check.png'), fullPage: true }).catch(() => {});
  throw error;
} finally {
  await browser.close();
}
