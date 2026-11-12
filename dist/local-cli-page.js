import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useCallback, useEffect, useRef, useState } from 'react';
const names = { claude: 'Claude Code', codex: 'Codex', grok: 'Grok Build' };
const commands = { claude: 'claude auth login', codex: 'codex login', grok: 'grok login' };
export function LocalCliPage({ api }) {
    const [rows, setRows] = useState();
    const [checking, setChecking] = useState(false);
    const [failed, setFailed] = useState(false);
    const [starting, setStarting] = useState();
    const [loginNote, setLoginNote] = useState();
    const scan = useRef(false);
    const refresh = useCallback(async (force = false) => {
        if (scan.current)
            return;
        scan.current = true;
        if (force)
            setChecking(true);
        try {
            const result = await (force ? api.refreshCliStatus() : api.cliStatus());
            if (!result.ok)
                throw new Error();
            setRows(result.value);
            setFailed(false);
        }
        catch {
            setFailed(true);
        }
        finally {
            scan.current = false;
            setChecking(false);
        }
    }, [api]);
    useEffect(() => {
        void refresh();
    }, [refresh]);
    const loginRunning = rows?.some(row => row.loginRunning);
    useEffect(() => {
        if (!loginRunning)
            return;
        const timer = setInterval(() => void refresh(), 4000);
        return () => clearInterval(timer);
    }, [loginRunning, refresh]);
    async function login(provider) {
        setStarting(provider);
        setLoginNote(undefined);
        try {
            const result = await api.cliLogin(provider);
            if (!result.ok)
                throw new Error();
            const text = {
                started: '请在 CLI 打开的终端或浏览器中完成授权。',
                'already-running': '此 CLI 已有登录窗口，请在该窗口继续。',
                'terminal-required': '请在本机终端运行 ' + commands[provider] + '，完成后重新检测。',
                missing: '没有找到可执行文件，请检查安装后重新检测。',
            }[result.value];
            setLoginNote({ provider, text });
        }
        catch {
            setLoginNote({ provider, text: '无法打开登录窗口。可在本机终端运行 ' + commands[provider] + '。' });
        }
        finally {
            setStarting(undefined);
            void refresh();
        }
    }
    return _jsxs("section", { className: "st-cli", "aria-labelledby": "st-cli-title", "aria-busy": checking, children: [_jsxs("div", { className: "st-cli-head", children: [_jsx("h3", { id: "st-cli-title", children: "\u672C\u673A CLI" }), _jsx("button", { type: "button", onClick: () => void refresh(true), disabled: checking, children: checking ? '检测中…' : '重新检测' })] }), failed && _jsx("p", { role: "alert", children: "\u672C\u673A\u68C0\u6D4B\u5931\u8D25\uFF0C\u8BF7\u91CD\u65B0\u68C0\u6D4B\u3002" }), rows && _jsx("ul", { className: "st-cli-list", "aria-live": "polite", children: rows.map(row => {
                    const label = !row.installed ? '未安装' : row.loginRunning ? '等待授权' :
                        row.auth === 'signed-in' ? row.authUnverified ? '上次检测已登录' : '已登录' :
                            row.auth === 'signed-out' ? '未登录' : '登录状态待确认';
                    return _jsxs("li", { children: [_jsxs("div", { className: "st-cli-row", children: [_jsxs("div", { children: [_jsx("strong", { children: names[row.provider] }), row.installed && _jsx("small", { children: [row.version, row.dispatchConfigured ? '已接入派发' : '尚未配置派发'].filter(Boolean).join(' · ') })] }), _jsx("span", { className: "st-cli-state", "data-ready": row.auth === 'signed-in', children: label }), row.installed && row.auth === 'signed-out' && _jsx("button", { type: "button", "aria-label": names[row.provider] + ' 授权登录', disabled: !!starting || row.loginRunning, onClick: () => void login(row.provider), children: starting === row.provider ? '正在打开…' : '授权登录' })] }), row.auth !== 'signed-in' && (row.launchFailed || loginNote?.provider === row.provider) &&
                                _jsx("p", { className: "st-cli-note", children: row.launchFailed ? '登录窗口已退出。可以重新授权或重新检测。' : loginNote?.text })] }, row.provider);
                }) })] });
}
