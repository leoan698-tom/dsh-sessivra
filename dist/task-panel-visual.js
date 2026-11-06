import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
const paths = {
    mark: 'M4 6h3m4 0h9M4 12l2 2 3-4m3 2h8M4 18h3m4 0h9',
    plus: 'M12 5v14M5 12h14', inbox: 'm3 13 4-8h10l4 8v5a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1zm0 0h5l2 3h4l2-3h5',
    list: 'M8 6h12M8 12h12M8 18h12M4 6h.01M4 12h.01M4 18h.01',
    archive: 'M4 4h16v4H4zM6 8v12h12V8M10 12h4',
    search: 'm16 16 4 4M18 10.5a7.5 7.5 0 1 1-15 0 7.5 7.5 0 0 1 15 0',
    filter: 'M3 7h10m4 0h4M3 17h4m4 0h10M13 4v6M7 14v6',
    check: 'm5 12 4 4L19 6', file: 'M6 3h8l4 4v14H6zM14 3v5h4M9 12h6m-6 4h6',
    chevron: 'm9 6 6 6-6 6', close: 'M6 6l12 12M18 6 6 18', back: 'm10 5-7 7 7 7M4 12h17',
    group: 'M4 7h7m4 0h5M4 17h2m4 0h10M11 4h4v6h-4zM6 14h4v6H6z',
    chat: 'M4 4h16v12H9l-5 4zM8 8h8m-8 4h5', clock: 'M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0m-9-5v5l3 2',
    folder: 'M3 6h6l2 2h10v11H3z', external: 'm8 16 9-9m-6 0h6v6', warn: 'M12 3 2 20h20zm0 6v4m0 3v.3'
};
export function Icon({ name, size = 17 }) {
    return _jsx("svg", { width: size, height: size, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "1.7", strokeLinecap: "round", strokeLinejoin: "round", "aria-hidden": "true", children: _jsx("path", { d: paths[name] }) });
}
export function Pill({ label, status }) {
    const tone = status === 'completed' ? 'green' : ['blocked', 'waiting-decision', 'review', 'failed'].includes(status) ? 'amber' : ['running', 'dispatched'].includes(status) ? 'blue' : 'neutral';
    return _jsxs("span", { className: 'st-pill st-' + tone, children: [_jsx("i", {}), label] });
}
export function when(at, compact = false) {
    const opts = compact ? { month: 'short', day: 'numeric' } : { year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false };
    return new Intl.DateTimeFormat('zh-CN', opts).format(at);
}
