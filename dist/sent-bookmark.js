import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useRef, useState } from 'react';
import { HoverCard, ReferenceChip } from '@deepseek-ai/dsh-client-ui-primitives';
export function SentBookmarkChip({ quote, locateLegacy, jump }) {
    const resolving = useRef(false);
    const [status, setStatus] = useState('');
    const open = async () => {
        if (quote.origin) {
            jump(quote.origin);
            return;
        }
        if (resolving.current)
            return;
        resolving.current = true;
        setStatus('正在定位原问答…');
        try {
            const { title, turn, prompt, response } = quote;
            const origin = await locateLegacy({ title, turn, prompt, response });
            setStatus(origin ? '' : '无法唯一定位原问答');
            if (origin)
                jump(origin);
        }
        catch {
            setStatus('暂时无法定位原问答，请重试');
        }
        finally {
            resolving.current = false;
        }
    };
    return _jsx(HoverCard, { inline: true, openDelayMs: 230, anchor: _jsx(ReferenceChip, { appearance: "session", label: quote.label, title: "", onActivate: () => void open() }), content: _jsxs("div", { style: { minWidth: 0, width: 'min(272px, 65vw)', maxWidth: '100%', textAlign: 'start', fontSize: 13, lineHeight: '1.45' }, children: [_jsxs("div", { style: { marginBottom: 8, fontWeight: 500, overflowWrap: 'anywhere' }, children: [quote.title, " \u00B7 \u7B2C ", quote.turn, " \u8F6E"] }), _jsx(PreviewText, { title: "\u63D0\u95EE", text: quote.prompt }), _jsx(PreviewText, { title: "\u56DE\u590D", text: quote.response }), status && _jsx("div", { role: "status", style: { marginTop: 6 }, children: status })] }) });
}
function PreviewText({ title, text }) {
    return _jsxs("div", { style: { marginBottom: 6 }, children: [_jsx("div", { style: { fontSize: 12, opacity: .72 }, children: title }), _jsx("div", { style: { display: '-webkit-box', WebkitBoxOrient: 'vertical', WebkitLineClamp: 5, overflow: 'hidden', whiteSpace: 'pre-line', overflowWrap: 'anywhere' }, children: text || '—' })] });
}
