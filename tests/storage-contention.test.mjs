import test from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { join, resolve, dirname, sep } from 'node:path';
import { mkdir, mkdtemp, readFile, writeFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import { host, value } from './fixture.mjs';
import { archiveFiles } from './support/archive.mjs';

let candidate;
if (process.env.DSHSM_TEST_ARCHIVE) {
  const base=resolve('node_modules/.cache/storage-contention-rc3');
  await mkdir(base,{recursive:true});
  const stage=await mkdtemp(join(base,'package-'));
  for (const [name,bytes] of archiveFiles(await readFile(process.env.DSHSM_TEST_ARCHIVE))) {
    const path=resolve(stage,name.slice('package/'.length));
    if (!path.startsWith(stage+sep)) throw Error('PACKAGE_PATH_DENIED');
    await mkdir(dirname(path),{recursive:true}); await writeFile(path,bytes,{flag:'wx'});
  }
  candidate=await import(pathToFileURL(join(stage,'dist/index.js')));
}
const candidateHost=()=>host(undefined,candidate);

// Own isolated Host only. The reader deliberately denies FILE_SHARE_DELETE,
// matching the Windows failure class observed in the native acceptance run.
async function lockOwnFile(path) {
  const script = "$p=$env:DSHSM_LOCK_PATH; $s=[IO.File]::Open($p,[IO.FileMode]::Open,[IO.FileAccess]::Read,[IO.FileShare]::Read); try { [Console]::WriteLine('READY'); [Console]::ReadLine() | Out-Null } finally { $s.Dispose() }";
  const child = spawn('pwsh', ['-NoProfile', '-Command', script], { windowsHide: true, env: { ...process.env, DSHSM_LOCK_PATH: path }, stdio: ['pipe', 'pipe', 'pipe'] });
  let error = '';
  child.stderr.on('data', data => error += data.toString());
  await Promise.race([
    new Promise((resolve, reject) => {
      child.stdout.on('data', data => { if (data.toString().includes('READY')) resolve(); });
      child.once('exit', () => reject(new Error('LOCK_HELPER_EXIT: ' + error)));
      child.once('error', reject);
    }),
    new Promise((_, reject) => { const timer = setTimeout(() => reject(new Error('LOCK_HELPER_TIMEOUT')), 10000); timer.unref(); }),
  ]);
  const ended = once(child, 'exit');
  let released = false;
  return async () => { if (!released) { released = true; child.stdin.end('\n'); } await ended; };
}

test('formal send survives a short Windows reader lock without duplicate dispatch', { skip: process.platform !== 'win32', timeout: 20000 }, async t => {
  const h = await candidateHost(); t.after(() => h.close());
  const a = await h.create('session-contention-A'), b = await h.create('session-contention-B');
  await h.ctx.sessionMessenger.messenger.selectRecipient(a.agent, b.agent.id, 'Synthetic B');
  const selected = await h.rpc('selectedFor', { sourceId: a.agent.id });
  await h.rpc('authorizeSelected', { sourceId: a.agent.id, revision: selected.revision });
  // Create the main storage document before locking it.
  value(await h.tool(a.agent, 'session_message_send', { id: 'contention-baseline', text: 'Synthetic baseline', selectionRevision: selected.revision }));
  await b.agent.whenIdle();
  const before = h.adapter.calls.length;
  const unlock = await lockOwnFile(join(h.root, 'dsh_session_messenger.json'));
  const release = setTimeout(() => unlock().catch(() => {}), 650);
  const result = await h.tool(a.agent, 'session_message_send', { id: 'contention-locked', text: 'Synthetic locked send', selectionRevision: selected.revision });
  clearTimeout(release);
  // The timeout may already have released it; terminate only our helper via stdin.
  await unlock();
  assert.equal(result.isError, false, JSON.stringify(result));
  assert.equal(value(result).id, 'contention-locked');
  await b.agent.whenIdle();
  assert.equal(h.adapter.calls.length - before, 1);
  const record = (await h.rpc('view')).state.messages['contention-locked'];
  assert.ok(['delivered', 'claimed'].includes(record.status));
});

test('formal reply survives reader contention and reaches the original A once', { skip: process.platform !== 'win32', timeout: 20000 }, async t => {
  const h = await candidateHost(); t.after(() => h.close());
  const a = await h.create('session-contention-reply-A'), b = await h.create('session-contention-reply-B');
  await h.ctx.sessionMessenger.messenger.selectRecipient(a.agent, b.agent.id, 'Synthetic B');
  const selected = await h.rpc('selectedFor', { sourceId: a.agent.id });
  await h.rpc('authorizeSelected', { sourceId: a.agent.id, revision: selected.revision });
  value(await h.tool(a.agent, 'session_message_send', { id: 'reply-parent', text: 'Synthetic request', selectionRevision: selected.revision }));
  await b.agent.whenIdle();
  const before = h.adapter.calls.length;
  const unlock = await lockOwnFile(join(h.root, 'dsh_session_messenger.json'));
  const release = setTimeout(() => unlock().catch(() => {}), 650);
  const result = await h.tool(b.agent, 'session_message_reply', { id: 'reply-locked', replyTo: 'reply-parent', text: 'Synthetic reply' });
  clearTimeout(release); await unlock();
  assert.equal(result.isError, false, JSON.stringify(result));
  await a.agent.whenIdle();
  assert.equal(h.adapter.calls.length - before, 1);
  const records = (await h.rpc('view')).state.messages;
  assert.equal(Object.values(records).filter(m => m.replyTo === 'reply-parent').length, 1);
  assert.equal(records['reply-locked'].target, a.agent.id);
  assert.ok(['delivered', 'claimed'].includes(records['reply-locked'].status));
});

test('persistent reader lock stops before dispatch and leaves no false committed message', { skip: process.platform !== 'win32', timeout: 20000 }, async t => {
  const h = await candidateHost(); t.after(() => h.close());
  const a = await h.create('session-contention-stop-A'), b = await h.create('session-contention-stop-B');
  await h.ctx.sessionMessenger.messenger.selectRecipient(a.agent, b.agent.id, 'Synthetic B');
  const selected = await h.rpc('selectedFor', { sourceId: a.agent.id });
  await h.rpc('authorizeSelected', { sourceId: a.agent.id, revision: selected.revision });
  value(await h.tool(a.agent, 'session_message_send', { id: 'stop-baseline', text: 'Synthetic baseline', selectionRevision: selected.revision }));
  await b.agent.whenIdle();
  const before = h.adapter.calls.length;
  const unlock = await lockOwnFile(join(h.root, 'dsh_session_messenger.json'));
  let result;
  try { result = await h.tool(a.agent, 'session_message_send', { id: 'stop-locked', text: 'Synthetic blocked', selectionRevision: selected.revision }); }
  finally { await unlock(); }
  assert.equal(result.isError, true);
  assert.match(result.error.message, /EPERM|EACCES|EBUSY/);
  assert.equal(h.adapter.calls.length, before);
  assert.equal((await h.rpc('view')).state.messages['stop-locked'], undefined);
});
