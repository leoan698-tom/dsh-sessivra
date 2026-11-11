import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import React from 'react';
import { Button, Input, Modal } from '@deepseek-ai/dsh-client-ui-primitives';
export function ImportPathPicker({ api, query, close, select }) {
    const [listing, setListing] = React.useState();
    const [address, setAddress] = React.useState(query.path ?? '');
    const [busy, setBusy] = React.useState(false);
    const [error, setError] = React.useState('');
    const version = React.useRef(0);
    const go = async (path) => {
        const request = ++version.current;
        setBusy(true);
        setError('');
        try {
            const result = await api.browse({ ...query, path });
            if (version.current !== request)
                return;
            if (!result.ok)
                throw new Error(result.error.message);
            setListing(result.value);
            setAddress(result.value.path);
        }
        catch (failure) {
            if (version.current === request)
                setError(failure instanceof Error ? failure.message : String(failure));
        }
        finally {
            if (version.current === request)
                setBusy(false);
        }
    };
    React.useEffect(() => {
        void go(query.path);
        return () => { version.current++; };
    }, []);
    const title = query.kind === 'directory' ? '选择文件夹' : query.kind === 'session' ? '选择会话原档' : '选择记忆文件或目录';
    const current = listing?.path;
    return _jsx(Modal, { open: true, title: title, closeLabel: "\u5173\u95ED", onClose: close, footer: _jsxs(_Fragment, { children: [_jsx(Button, { type: "button", onClick: close, children: "\u53D6\u6D88" }), query.kind !== 'session' && _jsx(Button, { type: "button", variant: "primary", disabled: !current || busy || !!error, onClick: () => select(current), children: "\u9009\u62E9\u5F53\u524D\u6587\u4EF6\u5939" })] }), children: _jsxs("div", { className: "sessivra-import-picker", children: [_jsxs("form", { onSubmit: event => { event.preventDefault(); void go(address.trim() || undefined); }, children: [_jsx(Input, { "aria-label": "\u6D4F\u89C8\u4F4D\u7F6E", value: address, maxLength: 4096, onChange: event => setAddress(event.target.value) }), _jsx(Button, { type: "submit", variant: "outline", disabled: busy, children: "\u524D\u5F80" })] }), _jsxs("div", { className: "picker-toolbar", children: [_jsx(Button, { type: "button", size: "sm", disabled: busy || !listing?.parent, onClick: () => void go(listing.parent), children: "\u4E0A\u4E00\u7EA7" }), _jsx(Button, { type: "button", size: "sm", disabled: busy, onClick: () => void go(), children: "\u7528\u6237\u76EE\u5F55" })] }), error && _jsx("p", { role: "alert", children: error }), busy && _jsx("p", { role: "status", children: "\u8BFB\u53D6\u6587\u4EF6\u5939\u2026" }), !busy && !error && listing && _jsxs("ul", { "aria-label": "\u6587\u4EF6\u548C\u6587\u4EF6\u5939", children: [listing.entries.map(entry => _jsx("li", { children: _jsxs(Button, { type: "button", onClick: () => entry.kind === 'directory' ? void go(entry.path) : select(entry.path), "aria-label": entry.kind === 'directory' ? `打开文件夹 ${entry.name}` : `选择文件 ${entry.name}`, children: [_jsx("span", { className: "picker-kind", children: entry.kind === 'directory' ? '文件夹' : '文件' }), entry.name] }) }, entry.path)), !listing.entries.length && _jsx("li", { children: "\u6CA1\u6709\u53EF\u9009\u6587\u4EF6\u6216\u5B50\u76EE\u5F55" }), listing.truncated && _jsx("li", { children: "\u4EC5\u663E\u793A\u524D 500 \u9879\uFF0C\u53EF\u8F93\u5165\u66F4\u5177\u4F53\u7684\u8DEF\u5F84\u3002" })] })] }) });
}
