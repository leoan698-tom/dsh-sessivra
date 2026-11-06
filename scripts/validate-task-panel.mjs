/** Run the panel against the rc.5 Gateway with deterministic model output and real task storage. */
import assert from 'node:assert/strict';
import { build } from 'esbuild';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { taskHost, scenario, until, version } from '../tests/support/tasks-host.mjs';

const { chromium } = await import(pathToFileURL(process.env.PLAYWRIGHT_MODULE).href);
const h = await taskHost();
const browser = await chromium.launch({ executablePath: process.env.CHROME_EXECUTABLE, args: ['--no-sandbox'] });
const output = new URL('../artifacts/task-panel/', import.meta.url);
await mkdir(output, { recursive: true });
try {
  const coordinator = (await h.create('panel-browser-A')).agent;
  const artifact = join(h.root, 'result.txt');
  scenario(h, {
    worker: async (task) => {
      if (task.title === '建设 B') await writeFile(artifact, 'task-panel evidence', 'utf8');
      else
        await until(
          async () => (await readFile(artifact, 'utf8').catch(() => '')) === 'task-panel evidence',
          'C must read the artifact written by B',
        );
      return [
        'session_task_report',
        {
          ...version(task),
          phase: 'result',
          summary: '提交核验',
          done: task.acceptance,
          remaining: [],
          artifacts: [artifact],
          evidence: [artifact],
        },
      ];
    },
  });
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.exposeFunction('invoke', async (method, args) => {
    try {
      return {
        ok: true,
        value: await h.ctx.typertGateway.invoke({ namespace: 'sessivraTaskPanel', method, args, peer: h.peer }),
      };
    } catch (e) {
      return { ok: false, error: { message: e.message } };
    }
  });
  const js = await build({
    stdin: {
      contents: `
    import React from 'react';import {createRoot} from 'react-dom/client';import {TaskPanel} from './src/task-panel.tsx';
    const api={operation:id=>invoke('operation',{id}),participants:()=>invoke('participants',{}),list:query=>invoke('list',{query}),detail:id=>invoke('detail',{id}),preview:(id,index)=>invoke('preview',{id,index}),command:command=>invoke('command',{command})};
    createRoot(document.getElementById('root')).render(<TaskPanel api={api} initialSession="panel-browser-A" open={()=>{}}/>);`,
      loader: 'tsx',
      resolveDir: process.cwd(),
    },
    bundle: true,
    write: false,
  });
  await page.route('http://127.0.0.1:41929/**', (r) =>
    r.fulfill({
      body: '<html lang="zh"><meta charset="utf-8"><div id="root"></div></html>',
      contentType: 'text/html',
    }),
  );
  await page.goto('http://127.0.0.1:41929/panel').catch(async () => {
    await page.setContent('<div id="root"></div>');
  });
  await page.addScriptTag({ content: js.outputFiles[0].text });
  const btn = (name) => page.getByRole('button', { name, exact: true });
  const form = page.locator('form');
  async function create(title, group) {
    await btn('新建任务').click();
    await form.locator('select').first().selectOption(coordinator.id);
    await form.getByLabel('标题').fill(title);
    await form.getByLabel('目标', { exact: true }).fill('核对任务面板产物');
    await form.locator('[name="acceptance"]').fill('产物包含 task-panel evidence');
    await form.locator('summary').click();
    if (group) await form.locator('[name="group"]').selectOption(group);
    await form.locator('[name="prerequisite"]').fill('选择核对方式');
    await form.locator('[name="context"]').fill('同一份产物');
    await form.locator('[name="options"]').fill('核对原文\n检查长度');
    await btn('创建并安排').click();
    await form.waitFor({ state: 'hidden' });
    await page.locator('.st-detail h3', { hasText: title }).waitFor();
  }
  await create('建设 B');
  const list = async () =>
    h.ctx.typertGateway.invoke({
      namespace: 'sessivraTaskPanel',
      method: 'list',
      args: { query: { view: 'all' } },
      peer: h.peer,
    });
  const group = (await list()).groups[0].id;
  await create('复核 C', group);
  assert.equal((await list()).attention.filter((x) => x.kind === '待回答').length, 1);
  await btn('回答问题').click();
  await form.locator('[name="answer"]').fill('核对原文');
  await btn('确认回答问题').click();
  await form.waitFor({ state: 'hidden' });
  for (const title of ['复核 C', '建设 B']) {
    if (title === '建设 B') {
      await btn('全部任务').click();
      await page.locator('.st-row').filter({ hasText: title }).click();
    }
    await btn('预览产物').click();
    await page.getByText('task-panel evidence', { exact: true }).waitFor();
    if (title === '复核 C') {
      await btn('验收结果').click();
      await form.locator('[name="outcome"]').selectOption('rework');
      await form.locator('[name="remaining"]').fill('重新读取建设 B 的产物');
      await form.locator('[name="evidence"]').fill('原文已提交，要求独立复读');
      await form.locator('[name="reason"]').fill('验证相同任务的补做记录');
      await btn('确认验收结果').click();
      await form.waitFor({state:'hidden'});
      await page.getByText('版本与投递', {exact:true}).click();
      await page.locator('.st-detail').getByText(/当前 v2/).waitFor();
      await page.getByText('版本与投递', {exact:true}).click();
    }
    await btn('验收结果').click();
    await form.locator('[name="criterion-0"]').check();
    await form.locator('[name="evidence"]').fill('读取 result.txt，内容为 task-panel evidence');
    await form.locator('[name="reason"]').fill('已核对原文');
    await btn('确认验收结果').click();
    await btn('归档').waitFor();
    await page.screenshot({ path: new URL('browser-review.png', output).pathname.replace(/^\/(\w:)/, '$1') });
    await btn('归档').click();
    await btn('确认归档').click();
    await form.waitFor({ state: 'hidden' });
  }
  assert.equal((await list()).total, 0);
  await btn('历史').click();
  await page.locator('.st-row').filter({ hasText: '建设 B' }).waitFor();
  assert.equal(await page.locator('.st-chipbar button').count(), 0, 'Global history must not inherit a session directory');
  await page.locator('.st-row').filter({hasText:'建设 B'}).click();
  await page.locator('.st-outcome').getByText('用户已验收', {exact:true}).waitFor();
  await page.locator('.st-outcome').getByText('提交核验', {exact:true}).waitFor();
  await page.setViewportSize({width:390,height:780});
  assert.equal(await page.locator('.st-items').isVisible(),false,'Narrow detail should fill the panel');
  assert.ok(await page.locator('.sessivra-tasks').evaluate(el=>el.scrollWidth<=el.clientWidth+1),'No horizontal overflow');
  await btn('返回列表').click();
  assert.equal(await page.locator('.st-items').isVisible(),true);
  await btn('筛选').click();
  await page.getByLabel('状态', {exact:true}).selectOption('running');
  await page.getByText('没有符合条件的任务。',{exact:true}).waitFor();
  await btn('清除筛选').click();
  await page.locator('.st-row').filter({hasText:'建设 B'}).waitFor();
  assert.deepEqual(errors, []);
  console.log('PASS: browser create B/C, shared answer, artifact review, archive, history via owner Gateway');
} finally {
  await browser.close();
  await h.close();
}
