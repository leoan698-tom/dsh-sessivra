import React, { useCallback, useEffect, useRef, useState } from 'react';
import type { TaskPanelApi } from './task-panel.js';
import type { LocalCliStatus } from './local-cli.js';

const names = { claude: 'Claude Code', codex: 'Codex', grok: 'Grok Build' };
const commands = { claude: 'claude auth login', codex: 'codex login', grok: 'grok login' };

export function LocalCliPage({ api }: { api: Pick<TaskPanelApi, 'cliStatus' | 'refreshCliStatus' | 'cliLogin'> }) {
  const [rows, setRows] = useState<LocalCliStatus[]>();
  const [checking, setChecking] = useState(false);
  const [failed, setFailed] = useState(false);
  const [starting, setStarting] = useState<LocalCliStatus['provider']>();
  const [loginNote, setLoginNote] = useState<{ provider: LocalCliStatus['provider']; text: string }>();
  const scan = useRef(false);
  const refresh = useCallback(async (force = false) => {
    if (scan.current) return;
    scan.current = true;
    if (force) setChecking(true);
    try {
      const result = await (force ? api.refreshCliStatus() : api.cliStatus());
      if (!result.ok) throw new Error();
      setRows(result.value);
      setFailed(false);
    } catch {
      setFailed(true);
    } finally {
      scan.current = false;
      setChecking(false);
    }
  }, [api]);

  useEffect(() => {
    void refresh();
  }, [refresh]);
  const loginRunning = rows?.some(row => row.loginRunning);
  useEffect(() => {
    if (!loginRunning) return;
    const timer = setInterval(() => void refresh(), 4000);
    return () => clearInterval(timer);
  }, [loginRunning, refresh]);

  async function login(provider: LocalCliStatus['provider']) {
    setStarting(provider);
    setLoginNote(undefined);
    try {
      const result = await api.cliLogin(provider);
      if (!result.ok) throw new Error();
      const text = {
        started: '请在 CLI 打开的终端或浏览器中完成授权。',
        'already-running': '此 CLI 已有登录窗口，请在该窗口继续。',
        'terminal-required': '请在本机终端运行 ' + commands[provider] + '，完成后重新检测。',
        missing: '没有找到可执行文件，请检查安装后重新检测。',
      }[result.value];
      setLoginNote({ provider, text });
    } catch {
      setLoginNote({ provider, text: '无法打开登录窗口。可在本机终端运行 ' + commands[provider] + '。' });
    } finally {
      setStarting(undefined);
      void refresh();
    }
  }

  return <section className="st-cli" aria-labelledby="st-cli-title" aria-busy={checking}>
    <div className="st-cli-head">
      <h3 id="st-cli-title">本机 CLI</h3>
      <button type="button" onClick={() => void refresh(true)} disabled={checking}>{checking ? '检测中…' : '重新检测'}</button>
    </div>
    {failed && <p role="alert">本机检测失败，请重新检测。</p>}
    {rows && <ul className="st-cli-list" aria-live="polite">{rows.map(row => {
      const label = !row.installed ? '未安装' : row.loginRunning ? '等待授权' :
        row.auth === 'signed-in' ? row.authUnverified ? '上次检测已登录' : '已登录' :
          row.auth === 'signed-out' ? '未登录' : '登录状态待确认';
      return <li key={row.provider}>
        <div className="st-cli-row">
          <div>
            <strong>{names[row.provider]}</strong>
            {row.installed && <small>{[row.version, row.dispatchConfigured ? '已接入派发' : '尚未配置派发'].filter(Boolean).join(' · ')}</small>}
          </div>
          <span className="st-cli-state" data-ready={row.auth === 'signed-in'}>{label}</span>
          {row.installed && row.auth === 'signed-out' && <button type="button"
            aria-label={names[row.provider] + ' 授权登录'}
            disabled={!!starting || row.loginRunning} onClick={() => void login(row.provider)}>
            {starting === row.provider ? '正在打开…' : '授权登录'}
          </button>}
        </div>
        {row.auth !== 'signed-in' && (row.launchFailed || loginNote?.provider === row.provider) &&
          <p className="st-cli-note">{row.launchFailed ? '登录窗口已退出。可以重新授权或重新检测。' : loginNote?.text}</p>}
      </li>;
    })}</ul>}
  </section>;
}
