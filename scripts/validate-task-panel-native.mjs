/** Exercise the installed bundles on a disposable local DSH web profile. */
import assert from 'node:assert/strict';
import { readFile, mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

const profile = process.env.SESSIVRA_TEST_PROFILE;
assert.ok(profile, 'Set SESSIVRA_TEST_PROFILE to the disposable profile directory');
const log = await readFile(join(profile, 'coexist-web.log'), 'utf8');
const url = log.match(/dsh web: (http:\/\/127\.0\.0\.1:[^\s]+)/)?.[1];
assert.ok(url, 'Expected the isolated loopback web server');
const { chromium } = await import(pathToFileURL(process.env.PLAYWRIGHT_MODULE).href);
const browser = await chromium.launch({ executablePath: process.env.CHROME_EXECUTABLE, args: ['--no-sandbox'] });
try {
  const page = await browser.newPage({ viewport: { width: 1280, height: 820 } });
  page.setDefaultTimeout(12000);
  const btn = (name) => page.getByRole('button', { name, exact: true });
  await page.addLocatorHandler(page.getByRole('dialog').last(), async (dialog) => {
    const close = dialog.getByRole('button', { name: /跳过|稍后|关闭|以后|完成|继续/ }).last();
    await close.click();
  });
  const title = '本地双插件核验 ' + Date.now();
  const directory = join(profile, 'panel-example');
  await mkdir(directory, { recursive: true });
  await page.goto(url).catch(() => {throw new Error('The isolated loopback web server is unavailable');});
  const panel = btn('任务中心');
  await panel.waitFor();
  await panel.click();
  await page.getByRole('heading', { name: '任务中心' }).waitFor();
  await btn('新建任务').click();
  const form = page.locator('.sessivra-tasks form');
  await form.locator('select').first().selectOption('new');
  await form.locator('[name="coordinatorDirectory"]').fill(directory);
  await form.locator('[name="title"]').fill(title);
  await form.locator('[name="goal"]').fill('确认同一宿主中的任务归属');
  await form.locator('[name="acceptance"]').fill('用户可核查等待原因及归档记录');
  await form.locator('summary').click();
  await form.locator('[name="prerequisite"]').fill('选择核验方式');
  await form.locator('[name="context"]').fill('本地示例');
  await form.locator('[name="options"]').fill('人工\n自动');
  await btn('创建并安排').click();
  const detail = page.locator('.st-detail');
  try { await detail.getByRole('heading', { name: title }).waitFor(); }
  catch (error) { throw new Error('Native create failed: ' + (await page.locator('.sessivra-tasks [role=alert]').allTextContents()).join(' '), { cause: error }); }
  await detail.locator('.st-question').getByText('选择核验方式',{exact:true}).waitFor();
  const output = join(process.cwd(), 'artifacts/task-panel');
  await mkdir(output, {recursive:true});
  await page.screenshot({ path: join(output, 'native-panel.png') });
  const openCoordinator = detail.getByRole('button', {name: /^协调 ·/});
  await detail.getByText('任务要求与会话', {exact:true}).click();
  await openCoordinator.click();
  const editor = page.locator('[contenteditable="true"]:visible, textarea:visible').last();
  const draft = '保留的未发送草稿 ' + title;
  try { await editor.fill(draft); }
  catch(error) { throw new Error('Native conversation after open: ' + (await page.locator('body').innerText()).slice(-1200), {cause:error}); }
  await panel.click();
  await btn('全部任务').click();
  try { await page.locator('.st-row').filter({hasText:title}).click(); }
  catch (error) { throw new Error('Task list after returning from draft: ' + (await page.locator('.sessivra-tasks').innerText()).slice(0,1800),{cause:error}); }
  await detail.getByText('任务要求与会话', {exact:true}).click();
  await detail.getByRole('button', {name: /^协调 ·/}).click();
  assert.equal(await editor.evaluate(el => el.value ?? el.innerText), draft);
  await panel.click();
  await btn('全部任务').click();
  await page.locator('.st-row').filter({hasText:title}).click();
  await btn('取消任务').click();
  await form.locator('[name="reason"]').fill('双插件核验完成');
  await btn('确认取消任务').click();
  await btn('归档').click();
  await btn('确认归档').click();
  await form.waitFor({ state:'hidden' });
  await btn('历史').click();
  await page.locator('.st-row').filter({hasText:title}).waitFor();
  await btn('Superagent').click();
  try { await page.getByText(/没有待处理的工单|No tickets need|No tickets to/i).filter({visible:true}).first().waitFor(); }
  catch(error) { throw new Error('Superagent overview: ' + (await page.locator('body').innerText()).slice(-1450), {cause:error}); }
  await page.screenshot({ path: join(output, 'native-superagent.png') });
  await panel.click();
  await btn('历史').click();
  await page.locator('.st-row').filter({hasText:title}).waitFor();
  console.log('PASS: installed native Sessivra and Superagent sidebars; create coordinator and child, wait, cancel, archive, reopen history');
} finally { await browser.close(); }
