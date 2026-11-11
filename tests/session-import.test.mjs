import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdir, writeFile, rm, utimes } from 'node:fs/promises';
import { join } from 'node:path';
import { zstdCompressSync } from 'node:zlib';
import { createUserMessage } from '@deepseek-ai/dsh-llm';
import LocalFs from '@deepseek-ai/dsh-fs-local';
import WorkingDirectory from '@deepseek-ai/dsh-working-directory';
import * as Persistence from '@deepseek-ai/dsh-session-persistence-jsonl';
import Query from '@deepseek-ai/dsh-session-query';
import References from '@deepseek-ai/dsh-session-reference';
import WorkspaceRegistry from '@deepseek-ai/dsh-workspace';
import { resolveImportWorkspace } from '../dist/import-workspace.js';
import { MessageHistory } from '../dist/message-history.js';
import { createSidebarMentionSource } from '../dist/mention-menu.js';
import { createSessionTreeStore } from '../dist/session-tree.js';
import { host } from './fixture.mjs';

const ids = {
  claude: '11111111-1111-4111-a111-111111111111',
  codex: '22222222-2222-4222-a222-222222222222',
  other: '33333333-3333-4333-a333-333333333333',
};
const time = '2026-10-20T10:00:00.000Z';
const jsonl = rows => Buffer.from(rows.map(row => JSON.stringify({ timestamp: time, ...row })).join('\r\n') + '\r\n');
const invoke = (h, method, args, peer = h.peer) => h.ctx.typertGateway.invoke({ namespace: 'sessivraImport', method, args, peer });
async function install(h) {
  await h.ctx.plugin(LocalFs);
  await h.ctx.plugin(WorkingDirectory);
  await h.ctx.plugin(Persistence, { root: join(h.root, 'native-sessions') });
  await h.ctx.plugin(Query);
}

test('workspace recovery uses evidence and preserves explicit or existing paths', async t => {
  const h = await host();
  t.after(() => h.close());
  const project = join(h.root, 'project');
  const inner = join(project, 'component');
  const other = join(h.root, 'other');
  await Promise.all([mkdir(inner, { recursive: true }), mkdir(other)]);
  const missing = join(inner, 'gone');
  assert.deepEqual(await resolveImportWorkspace({ original: inner, explicit: other }), { cwd: other, recoveredProject: false });
  assert.deepEqual(await resolveImportWorkspace({ original: inner, declared: [other] }), { cwd: inner, recoveredProject: false });
  assert.deepEqual(await resolveImportWorkspace({ original: missing, registered: [project, inner] }), { cwd: inner, recoveredProject: true });
  assert.deepEqual(await resolveImportWorkspace({ original: join(h.root, 'unrelated'), declared: [project, other], fallback: h.root }),
    { cwd: h.root, recoveredProject: false });
});

function codexLog(id, cwd) {
  const message = (role, text) => ({ type: 'response_item', payload: { type: 'message', role, content: [{ type: 'input_text', text }] } });
  return jsonl([
    { type: 'session_meta', payload: { id, cwd, timestamp: time } },
    message('developer', 'DO_NOT_REPLAY_IMPORTED_POLICY'),
    message('user', '<external_codex_apps_open_page>{"page_id":null}</external_codex_apps_open_page>'),
    message('user', '<external_codex_apps_selected_page_part_1_of_2>{"page_id":"PAGE_METADATA_ONLY","padding":"' + 'x'.repeat(270_000) + '"}</external_codex_apps_selected_page_part_1_of_2>'),
    { type: 'response_item', payload: { type: 'message', role: 'user', content: [
      { type: 'input_text', text: '<external_codex_apps_selected_page_part_2_of_2>{}</external_codex_apps_selected_page_part_2_of_2>\n<external_codex_apps_open_page>{}</external_codex_apps_open_page>\nCodex 原始问题' },
      { type: 'input_text', text: '<external_codex_apps_open_page>{"page_id":null}</external_codex_apps_open_page>' },
    ] } },
    { type: 'event_msg', payload: { type: 'user_message', message: 'Codex 原始问题' } },
    { type: 'response_item', payload: { type: 'function_call', name: 'OLD_TOOL_ONLY_IN_RAW' } },
    { type: 'response_item', payload: { type: 'function_call_output', output: 'x'.repeat(210_000) } },
    message('assistant', 'Codex 原始回答'),
  ]);
}

test('owner previews directory, project and single-session imports, then downloads the exact source bytes', async t => {
  const h = await host();
  t.after(() => h.close());
  await install(h);
  const project = join(h.root, 'project'), other = join(h.root, 'project-sibling');
  const claude = join(h.root, 'claude'), codex = join(h.root, 'codex');
  const claudeProject = join(claude, 'projects', 'project');
  const claudeFile = join(claudeProject, ids.claude + '.jsonl');
  const codexFile = join(codex, 'sessions', 'rollout-' + ids.codex + '.jsonl');
  const memory = join(claudeProject, 'memory', 'MEMORY.md');
  for (const dir of [project, other, join(claudeProject, 'memory'), join(codex, 'sessions'), join(codex, 'archived_sessions'), join(codex, 'memories_v2', 'rollout_summaries')])
    await mkdir(dir, { recursive: true });
  const claudeRaw = jsonl([
    { type: 'user', uuid: 'user', parentUuid: null, sessionId: ids.claude, cwd: project, message: { role: 'user', content: 'Claude 原始问题' } },
    { type: 'assistant', uuid: 'discarded', parentUuid: 'user', sessionId: ids.claude, cwd: project, message: { role: 'assistant', content: [{ type: 'text', text: '已丢弃分支' }] } },
    { type: 'assistant', uuid: 'chosen', parentUuid: 'user', sessionId: ids.claude, cwd: project, message: { role: 'assistant', content: [{ type: 'text', text: 'Claude 原始回答' }, { type: 'tool_use', name: 'OLD_TOOL_ONLY_IN_RAW' }] } },
  ]);
  const codexRaw = codexLog(ids.codex, project);
  const memoryRaw = Buffer.from('\uFEFF记住项目代号 Saffron。\r\n');
  await writeFile(claudeFile, claudeRaw);
  await writeFile(memory, memoryRaw);
  await writeFile(codexFile, codexRaw);
  await writeFile(join(codex, 'archived_sessions', 'rollout-' + ids.other + '.jsonl'), codexLog(ids.other, other));
  await writeFile(join(codex, 'memories_v2', 'rollout_summaries', 'task-' + ids.codex + '.md'), 'Codex 会话记忆');
  await writeFile(join(codex, 'memories_v2', 'memory_summary.md'), '全局记忆');

  const preview = query => invoke(h, 'preview', { query });
  const denied = { ...h.peer, principal: { kind: 'synthetic-untrusted' } };
  await assert.rejects(invoke(h, 'preview', { query: { source: 'claude', scope: 'directory', target: claude } }, denied), /access denied|IMPORT_OWNER_REQUIRED/);
  const browse = (kind, path, source = 'codex', peer) => invoke(h, 'browse', { browse: { source, kind, path } }, peer);
  await assert.rejects(browse('session', codexFile, 'codex', denied), /access denied|IMPORT_OWNER_REQUIRED/);
  const picker = { query: { source: 'codex', kind: 'session' } };
  await assert.rejects(invoke(h, 'pickFile', picker, denied), /access denied|IMPORT_OWNER_REQUIRED/);
  assert.deepEqual(await invoke(h, 'pickFile', picker), { native: false, path: null });
  const location = await browse('session', codexFile);
  assert.equal(location.path, join(codex, 'sessions'));
  assert.equal(location.parent, codex);
  assert.deepEqual(location.entries.map(entry => entry.path), [codexFile]);
  assert.ok((await browse('directory', codex)).entries.every(entry => entry.kind === 'directory'));
  assert.deepEqual((await browse('memory', memory, 'claude')).entries.map(entry => entry.path), [memory]);
  console.log('IMPORT_PICKER_PASS');
  const claudePlan = await preview({ source: 'claude', scope: 'directory', target: claude });
  const claudeCatalog = await preview({ source: 'claude', scope: 'catalog', home: claude });
  assert.deepEqual(claudeCatalog.rows.map(row => [row.project, row.displayTitle]), [[undefined, 'Claude 原始问题']]);
  assert.deepEqual(claudePlan.rows.map(row => row.sourceId), [ids.claude]);
  assert.deepEqual(claudePlan.rows[0].memory, [memory]);
  assert.equal((await preview({ source: 'claude', scope: 'project', target: project, home: claude })).rows[0].sourceId, ids.claude);
  assert.equal((await preview({ source: 'claude', scope: 'session', target: ids.claude, home: claude })).rows[0].file, claudeFile);
  const claudeResult = await invoke(h, 'commit', { token: claudePlan.token, keys: [claudePlan.rows[0].key] });
  assert.deepEqual(claudeResult.failures, []);
  assert.equal(claudeResult.sessions[0].projectedMessages, 2);

  const directory = await preview({ source: 'codex', scope: 'directory', target: codex, home: codex });
  assert.deepEqual(directory.rows.map(row => row.sourceId).sort(), [ids.codex, ids.other]);
  const projectPlan = await preview({ source: 'codex', scope: 'project', target: project, home: codex });
  assert.deepEqual(projectPlan.rows.map(row => row.sourceId), [ids.codex]);
  assert.equal(projectPlan.rows[0].title, 'Codex · Codex 原始问题');
  assert.equal(projectPlan.rows[0].memory.length, 1);
  const explicit = await preview({ source: 'codex', scope: 'session', target: codexFile, home: codex, memory, includeGlobalMemory: true });
  assert.equal(explicit.rows[0].memory.length, 3);
  const params = { token: explicit.token, keys: [explicit.rows[0].key] };
  const codexResult = await invoke(h, 'commit', params);
  assert.deepEqual(codexResult.failures, []);
  assert.equal(codexResult.sessions[0].projectedMessages, 2);
  assert.equal(codexResult.sessions[0].title, 'Codex · Codex 原始问题');
  const id = codexResult.sessions[0].id;
  assert.equal((await invoke(h, 'commit', params)).sessions[0].status, 'existing');
  assert.equal(h.ctx.agents.get(id), undefined);
  assert.equal(h.adapter.calls.length, 0);
  assert.equal((await h.ctx.sessionPersistence.list()).length, 2);
  {
    await using handle = await h.ctx.sessionPersistence.open(id, 'read');
    assert.doesNotMatch(JSON.stringify((await handle.read()).events), /OLD_TOOL_ONLY_IN_RAW|function_call_output|external_codex_apps_/);
  }
  {
    await using handle = await h.ctx.sessionPersistence.open(id, 'write');
    const { events } = await handle.read();
    await handle.append([{
      type: 'session/title', seq: events.length, time: Date.now(),
      data: { title: '保留原生改名', messageSeqs: [], source: { kind: 'user' } },
    }]);
    await handle.flush();
  }
  assert.equal((await invoke(h, 'commit', params)).sessions[0].title, '保留原生改名');
  await assert.rejects(invoke(h, 'chunk', { id, offset: 0 }, denied), /access denied|IMPORT_OWNER_REQUIRED/);
  const download = async (session, name) => {
    const files = await invoke(h, 'archive', { id: session });
    const file = files.find(item => item.name === name);
    const chunks = [];
    for (let offset = file.offset; offset < file.offset + file.chunks; offset++)
      chunks.push(Buffer.from(await invoke(h, 'chunk', { id: session, offset }), 'base64'));
    return Buffer.concat(chunks);
  };
  await rm(codexFile);
  assert.deepEqual(await download(id, 'rollout-' + ids.codex + '.jsonl'), codexRaw);
  assert.deepEqual(await download(claudeResult.sessions[0].id, ids.claude + '.jsonl'), claudeRaw);
  assert.deepEqual(await download(claudeResult.sessions[0].id, 'MEMORY.md'), memoryRaw);
  assert.deepEqual(await download(id, 'task-' + ids.codex + '.md'), Buffer.from('Codex 会话记忆'));
  console.log('IMPORT_SCOPE_PASS');
});

test('native DSH resumes both imported sessions after host restart and sends historical text and memory on the next turn', async t => {
  const original = await host();
  const project = join(original.root, 'project');
  let reopened;
  t.after(async () => { await reopened?.close(); await original.close(); });
  await mkdir(project);
  await install(original);
  const memory = join(project, 'memory.md');
  await writeFile(memory, '继续时沿用校验口令 Import-Fern。');
  const sessions = [];
  for (const source of ['claude', 'codex']) {
    const file = join(original.root, source === 'codex' ? 'codex.jsonl.zst' : 'claude.jsonl');
    const raw = source === 'codex' ? codexLog(ids.codex, project) : jsonl([
      { type: 'user', sessionId: ids.claude, cwd: project, message: { role: 'user', content: 'Claude 原始问题' } },
      { type: 'assistant', sessionId: ids.claude, cwd: project, message: { role: 'assistant', content: 'Claude 原始回答' } },
    ]);
    await writeFile(file, source === 'codex' ? zstdCompressSync(raw) : raw);
    const plan = await invoke(original, 'preview', { query: { source, scope: 'session', target: file, memory, includeAutomaticMemory: false } });
    const batch = await invoke(original, 'commit', { token: plan.token, keys: [plan.rows[0].key] });
    assert.deepEqual(batch.failures, []);
    sessions.push({ source, id: batch.sessions[0].id });
  }
  await original.ctx.fiber.dispose();
  reopened = await host(original.root);
  await install(reopened);
  for (const { source, id } of sessions) {
    const observed = await reopened.ctx.sessionQuery.observeSession(id);
    assert.equal(observed.header.cwd, project);
    observed[Symbol.dispose]();
    const { agent } = await reopened.ctx.agents.resume({ resumeSessionId: id, agentOptions: { provider: 'synthetic-free', model: 'fixture' } });
    agent.followup(createUserMessage({ source: { kind: 'user' }, content: [{ type: 'text', text: '请从这里继续。' }] }));
    await agent.whenIdle();
    const messages = reopened.adapter.calls.at(-1).messages;
    const text = messages.flatMap(message => message.content.map(block => block.text ?? '')).join('\n');
    const label = source === 'codex' ? 'Codex' : 'Claude';
    assert.match(text, new RegExp(label + ' 原始问题'));
    assert.match(text, new RegExp(label + ' 原始回答'));
    assert.match(text, /Import-Fern/);
    assert.match(text, /请从这里继续/);
    assert.doesNotMatch(text, /DO_NOT_REPLAY_IMPORTED_POLICY|OLD_TOOL_ONLY_IN_RAW|external_codex_apps_/);
    assert.ok(agent.session.snapshotEvents().some(event => event.type === 'assistant/message' && event.data.message.source.provider === 'synthetic-free'));
  }
  assert.equal(reopened.adapter.calls.length, 2);
  console.log('IMPORT_RESUME_PASS');
});

test('compressed Codex rollouts work in all scopes, archive exact compressed bytes and share identity with JSONL', async t => {
  const h = await host();
  t.after(() => h.close());
  await install(h);
  const sessions = join(h.root, 'sessions');
  const archived = join(h.root, 'archived_sessions');
  const project = join(h.root, 'project');
  const sibling = join(h.root, 'project-sibling');
  for (const dir of [sessions, archived, project, sibling]) await mkdir(dir);
  const name = 'rollout-' + ids.codex + '.jsonl.zst';
  const file = join(archived, name);
  const raw = codexLog(ids.codex, project);
  const split = raw.indexOf(10) + 1;
  const encoded = Buffer.concat([
    zstdCompressSync(raw.subarray(0, split)),
    Buffer.from('502a4d180100000000', 'hex'), // Skippable frame.
    zstdCompressSync(raw.subarray(split)),
  ]);
  await writeFile(file, encoded);
  const assigned = '44444444-4444-4444-a444-444444444444';
  const standalone = '55555555-5555-4555-a555-555555555555';
  await writeFile(join(h.root, 'session_index.jsonl'), jsonl([{ id: ids.codex, thread_name: '桌面会话标题' }]));
  await writeFile(join(h.root, '.codex-global-state.json'), JSON.stringify({
    'local-projects': { local: { name: '桌面项目名称', rootPaths: [project] } },
    'thread-project-assignments': { [assigned]: { projectKind: 'local', projectId: 'local' } },
    'projectless-thread-ids': [standalone],
  }));
  await writeFile(join(sessions, ids.other + '.jsonl.zst'), zstdCompressSync(codexLog(ids.other, sibling)));
  const broken = join(sessions, 'broken.jsonl.zst');
  await writeFile(broken, encoded.subarray(0, 9));
  const preview = (scope, target) => invoke(h, 'preview', { query: {
    source: 'codex', scope, ...(target ? { target } : {}), home: h.root, includeAutomaticMemory: false,
  } });
  const directory = await preview('directory', h.root);
  assert.deepEqual(directory.rows.map(row => row.sourceId).sort(), [ids.codex, ids.other]);
  assert.match(directory.warnings.join(' '), /压缩原档无法读取/);
  await assert.rejects(preview('session', broken), /压缩帧不完整|压缩帧头不完整/);
  const byProject = await preview('project', project);
  assert.deepEqual(byProject.rows.map(row => row.file), [file]);
  const byId = await preview('session', ids.codex);
  assert.equal(byId.rows[0].file, file);
  assert.deepEqual((await invoke(h, 'browse', { browse: { source: 'codex', kind: 'session', path: archived } })).entries.map(entry => entry.path), [file]);
  const exact = await preview('session', file);
  assert.equal(exact.rows[0].title, 'Codex · Codex 原始问题');
  const commit = plan => invoke(h, 'commit', { token: plan.token, keys: [plan.rows[0].key] });
  const indexed = await invoke(h, 'preview', { query: { source: 'codex', scope: 'catalog', catalogOffset: 0, home: h.root } });
  const indexedRow = indexed.rows.find(row => row.sourceId === ids.codex);
  assert.equal(indexedRow.displayTitle, '桌面会话标题');
  const batch = await commit({ ...indexed, rows: [indexedRow] });
  assert.deepEqual(batch.failures, []);
  const [imported] = batch.sessions;
  assert.equal(imported.title, 'Codex · Codex 原始问题');
  assert.equal(imported.projectedMessages, 2);
  assert.equal(imported.files[0].name, name);
  const stored = Buffer.from(await invoke(h, 'chunk', { id: imported.id, offset: 0 }), 'base64');
  assert.deepEqual(stored, encoded);
  await writeFile(join(sessions, assigned + '.jsonl'), codexLog(assigned, sibling));
  await writeFile(join(sessions, standalone + '.jsonl'), codexLog(standalone, project));
  const catalog = await preview('catalog');
  const selected = catalog.rows.find(row => row.sourceId === ids.codex);
  assert.equal(selected.project.name, '桌面项目名称');
  assert.equal(selected.displayTitle, '桌面会话标题');
  assert.equal(selected.title, 'Codex · Codex 原始问题');
  assert.equal(catalog.rows.find(row => row.sourceId === assigned).project.name, '桌面项目名称');
  assert.equal(catalog.rows.find(row => row.sourceId === standalone).project, undefined);
  assert.equal(catalog.rows.find(row => row.sourceId === ids.other).project, undefined);
  assert.equal((await commit({ ...catalog, rows: [selected] })).sessions[0].status, 'existing');
  console.log('IMPORT_CATALOG_PASS');
  const plain = join(sessions, ids.codex + '.jsonl');
  await writeFile(plain, raw);
  const duplicate = await commit(await preview('session', plain));
  assert.equal(duplicate.sessions[0].id, imported.id);
  assert.equal(duplicate.sessions[0].status, 'existing');
  assert.deepEqual(duplicate.sessions[0].files, imported.files);
  assert.equal((await h.ctx.sessionPersistence.list()).length, 1);
  console.log('IMPORT_ZSTD_PASS');
});

test('catalog keeps selections across pages and adds global memory only on request', async t => {
  const h = await host();
  t.after(() => h.close());
  await install(h);
  const dir = join(h.root, 'projects', 'fixture');
  await mkdir(dir, { recursive: true });
  await writeFile(join(h.root, 'CLAUDE.md'), '全局记忆');
  const idAt = i => `55555555-5555-4555-a555-${String(i).padStart(12, '0')}`;
  const logAt = async (i, cwd = h.root) => {
    const sessionId = idAt(i);
    const file = join(dir, sessionId + '.jsonl');
    await writeFile(file, jsonl([{ type: 'user', uuid: 'user', sessionId, cwd, message: { role: 'user', content: '会话 ' + i } }]));
    await utimes(file, 1000 + i, 1000 + i);
  };
  await Promise.all(Array.from({ length: 121 }, (_, i) => logAt(i, i ? h.root : join(h.root, 'missing'))));
  const query = { source: 'claude', scope: 'catalog', home: h.root, catalogOffset: 0 };
  const first = await invoke(h, 'preview', { query });
  assert.equal(first.rows.length, 120);
  await logAt(122); // A newly written log must not shift the existing cursor.
  const second = await invoke(h, 'preview', { query: { ...query, catalogOffset: first.nextOffset, catalogToken: first.token } });
  assert.equal(second.token, first.token);
  assert.deepEqual(second.rows.map(row => row.sourceId), [idAt(0)]);
  const commit = (keys, includeGlobalMemory) => invoke(h, 'commitCatalog', { token: first.token, keys, includeGlobalMemory });
  const withGlobal = await commit([second.rows[0].key], true);
  assert.deepEqual(withGlobal.failures, []);
  assert.equal(withGlobal.sessions[0].files[1].name, 'CLAUDE.md');
  const withoutGlobal = await commit([first.rows[0].key], false);
  assert.deepEqual(withoutGlobal.failures, []);
  assert.equal(withoutGlobal.sessions[0].files.length, 1);
  const existing = await commit([first.rows[0].key], true);
  assert.equal(existing.sessions[0].status, 'existing');
  assert.equal(existing.sessions[0].files.length, 1);
  console.log('IMPORT_DIRECT_MEMORY_PASS');
});

test('custom catalog loads SessionBridge raw device folders for the selected provider', async t => {
  const h = await host();
  t.after(() => h.close());
  await install(h);
  const dirs = ['devices/device/raw/claude', 'raw/claude', 'raw/codex', 'direct-cache/blobs'];
  for (const dir of dirs) await mkdir(join(h.root, dir), { recursive: true });
  const cwd = join(h.root, 'fixture-project', '.claude', 'worktrees', 'main-a12345');
  const projectRoot = join(h.root, 'fixture-project');
  await mkdir(projectRoot, { recursive: true });
  await h.ctx.plugin(WorkspaceRegistry);
  const raw = jsonl([{ type: 'user', uuid: 'first', sessionId: ids.claude, cwd,
    message: { role: 'user', content: '跨设备会话' } },
    { type: 'custom-title', sessionId: ids.claude, customTitle: '桌面保存的标题' }]);
  for (const dir of dirs) await writeFile(join(h.root, dir, 'a'.repeat(64) + '.jsonl'), raw);
  await writeFile(join(h.root, dirs[0], 'b'.repeat(64) + '.jsonl'), jsonl([
    { type: 'user', uuid: 'subagent', sessionId: ids.other, isSidechain: true, cwd: h.root,
      message: { role: 'user', content: '子代理' } },
  ]));
  const child = '44444444-4444-4444-a444-444444444444';
  await writeFile(join(h.root, dirs[0], 'c'.repeat(64) + '.jsonl'), jsonl([
    { type: 'user', uuid: 'child', sessionId: child, cwd, message: { role: 'user', content: '真实分支' } },
  ]));
  const { DatabaseSync } = await import('node:sqlite');
  const db = new DatabaseSync(join(h.root, 'sessions.sqlite'));
  try {
    db.exec('CREATE TABLE sessions (platform, present, sidechain, native_id, title, cwd, first_at, sha256)');
    const insert = db.prepare("INSERT INTO sessions VALUES ('claude', 1, 0, ?, ?, ?, ?, ?)");
    insert.run(ids.claude, '桌面保存的标题', cwd, '2026-10-19T10:00:00Z', 'a'.repeat(64));
    insert.run(child, '真实分支', cwd, '2026-10-20T10:00:00Z', 'c'.repeat(64));
  } finally { db.close(); }
  const result = await invoke(h, 'preview', { query: { source: 'claude', scope: 'catalog', catalogOffset: 0, home: h.root } });
  assert.deepEqual(result.rows.map(row => row.displayTitle).sort(), ['桌面保存的标题', '真实分支']);
  assert.ok(result.rows.every(row => /[\\/]raw[\\/]claude[\\/]/.test(row.file)));
  const nested = result.rows.find(row => row.sourceId === child);
  assert.equal(nested.parent.sourceId, ids.claude);
  assert.equal(nested.project.name, 'fixture-project');
  const rejected = await invoke(h, 'commitCatalog', { token: result.token, keys: [nested.key], includeGlobalMemory: false });
  assert.equal(rejected.sessions.length, 0);
  assert.match(rejected.failures[0].message, /随主会话/);
  const childPath = join(h.root, dirs[0], 'c'.repeat(64) + '.jsonl');
  await utimes(childPath, 100, 100);
  await Promise.all(Array.from({ length: 120 }, (_, i) => {
    const sessionId = `aaaaaaa1-5555-4555-a555-${String(i).padStart(12, '0')}`;
    return writeFile(join(h.root, dirs[1], sessionId + '.jsonl'), jsonl([
      { type: 'user', uuid: sessionId, sessionId, cwd, message: { role: 'user', content: '列表记录' } },
    ]));
  }));
  await utimes(join(h.root, dirs[1], 'a'.repeat(64) + '.jsonl'), 2_000_000_000, 2_000_000_000);
  const page = await invoke(h, 'preview', { query: { source: 'claude', scope: 'catalog', catalogOffset: 0, home: h.root } });
  const main = page.rows.find(row => row.sourceId === ids.claude);
  assert.ok(main);
  assert.ok(!page.rows.some(row => row.sourceId === child));
  const id = await invoke(h, 'startCatalogImport', { token: page.token, keys: [main.key], includeGlobalMemory: false });
  let job;
  for (let i = 0; i < 200; i++) {
    job = await invoke(h, 'catalogImportStatus', { id });
    if (job.phase === 'done' || job.phase === 'failed') break;
    await new Promise(resolve => setTimeout(resolve, 15));
  }
  assert.equal(job.phase, 'done');
  assert.equal(job.completed, 2);
  assert.deepEqual(job.result.failures, []);
  const [parent, branch] = job.result.sessions;
  assert.equal(branch.parentId, parent.id);
  const saved = await h.ctx.sessionQuery.listSessions();
  assert.ok(saved.filter(row => [parent.id, branch.id].includes(row.header.id)).every(row => row.header.cwd === projectRoot));
  const registered = await h.ctx.workspaceRegistry.resolveByPath(projectRoot);
  assert.deepEqual([...registered.sessionIds].sort(), [parent.id, branch.id].sort());
  assert.equal(saved.find(row => row.header.id === branch.id).header.parentSession, parent.id);
  assert.equal(saved.find(row => row.header.id === branch.id).header.origin, undefined);
  const tree = await h.ctx.typertGateway.invoke({ namespace: 'sessionCollaboration', method: 'tree', args: {}, peer: h.peer });
  assert.ok(tree.some(row => row.id === branch.id && row.parentId === parent.id && !row.subagent));

  let observed = [];
  const ctx = { get: key => key === 'sessionQuery' ? {
    observeSession: (id, options) => { observed.push(id); return h.ctx.sessionQuery.observeSession(id, options); },
  } : h.ctx.get(key) };
  let search = new MessageHistory(ctx);
  try {
    assert.equal((await search.search('跨设备会话')).items[0]?.sessionId, parent.id);
    assert.equal((await search.search('真实分支')).items[0]?.sessionId, branch.id);
    assert.equal(observed.length, 2);
    await search.close();
    observed = [];
    search = new MessageHistory(ctx);
    assert.equal((await search.search('跨设备会话')).items[0]?.sessionId, parent.id);
    assert.equal((await search.search('真实分支')).items[0]?.sessionId, branch.id);
    assert.deepEqual(observed, [], 'a fresh reader reuses the durable index without opening the logs');
    {
      await using handle = await h.ctx.sessionPersistence.open(branch.id, 'write');
      const { events } = await handle.read();
      await handle.append([{ type: 'session/title', seq: events.length, time: Date.now(),
        data: { title: '索引更新验证', messageSeqs: [], source: { kind: 'user' } } }]);
      await handle.flush();
    }
    assert.equal((await search.search('真实分支')).items[0]?.title, '索引更新验证');
    assert.deepEqual(observed, [branch.id], 'only the changed log is read');
  } finally { await search.close(); }
  console.log('PERSISTENT_MESSAGE_INDEX_PASS');

  const mentionStore = createSessionTreeStore({tree: async () => ({ok: true, value: tree})});
  const { promise: treeReady, resolve: markTreeReady } = Promise.withResolvers();
  const unsubscribe = mentionStore.subscribe(() => { if (mentionStore.getSnapshot().loaded) markTreeReady(); });
  try {
    await treeReady;
    const source = createSidebarMentionSource({list: {getSnapshot: () => ({
      ids: [parent.id, branch.id],
      byId: Object.fromEntries([parent.id, branch.id].map(id => [id, {blank: true, displayTitle: '未命名会话', retainedBy: {}}])),
    })}}, mentionStore, () => ({items: [registered], pinnedSessionIds: [], archivedSessionIds: []}), () => 'default');
    const caller = (await h.create('import-reference-caller', projectRoot)).agent;
    await h.ctx.plugin(References);
    const candidates = await source.candidates({sessionId: caller.id},
      {query: '桌面保存的标题', quoted: false, signal: new AbortController().signal});
    assert.deepEqual(candidates.map(row => row.value), [parent.id, branch.id]);
    const refs = candidates.map(candidate => source.onPick({candidate}).insert.ref);
    await caller.followup(createUserMessage({source: {kind: 'user'}, content: [{type: 'text', text: refs.join(' ')}]}));
    await caller.whenIdle();
    const context = h.adapter.calls.at(-1).messages.find(message => message.source?.kind === 'session-reference');
    assert.deepEqual(context.source.references.map(ref => ref.sessionId), [parent.id, branch.id]);
    assert.match(JSON.stringify(context.content), /跨设备会话/);
    assert.match(JSON.stringify(context.content), /真实分支/);
  } finally { unsubscribe(); mentionStore.dispose(); }
  console.log('IMPORTED_NATIVE_MENTION_PASS');

  const retry = await invoke(h, 'commitCatalog', { token: page.token, keys: [main.key], includeGlobalMemory: false });
  assert.deepEqual(retry.sessions.map(row => [row.id, row.status]), [[parent.id, 'existing'], [branch.id, 'existing']]);
  console.log('IMPORT_CLAUDE_FAMILY_PASS');
  console.log('IMPORT_WORKSPACE_FALLBACK_PASS');
  assert.deepEqual(result.warnings, []);
  console.log('IMPORT_CUSTOM_FOLDER_PASS');
});
