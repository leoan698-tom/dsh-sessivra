import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import React from 'react';
import { Button, Checkbox, IconChevronRightOutlineRegular, IconDownloadOutlineRegular, IconFolderCloseRegular, IconRefreshOutlineRegular, IconSearchOutlineRegular, Input, SegmentedTabs, Switch, } from '@deepseek-ai/dsh-client-ui-primitives';
import { importPanelStyles } from './import-panel-styles.js';
const maxSelection = 20;
const globalMemoryLabel = '同时导入全局记忆';
const sourceTabs = [
    { value: 'codex', label: 'Codex', id: 'sessivra-import-codex', panelId: 'sessivra-import-codex-panel' },
    { value: 'claude', label: 'Claude Code', id: 'sessivra-import-claude', panelId: 'sessivra-import-claude-panel' },
];
export function createImportCatalogState() {
    return {
        source: 'codex',
        folders: {},
        pages: new Map(),
        jobs: new Map(),
    };
}
function groupSessions(rows, unavailable, search) {
    const projects = new Map();
    const standalone = [];
    const nodes = new Map();
    for (const row of [...unavailable, ...rows])
        nodes.set(row.sourceId, { row, children: [] });
    for (const node of nodes.values()) {
        const { parent, project } = node.row;
        if (parent && !nodes.has(parent.sourceId))
            nodes.set(parent.sourceId, {
                row: { ...parent, updated: 0, ...(project ? { project } : {}) }, children: [], placeholder: true,
            });
    }
    const filter = search.trim().toLocaleLowerCase();
    const roots = [];
    for (const node of nodes.values()) {
        const parent = node.row.parent && nodes.get(node.row.parent.sourceId);
        const visited = new Set([node.row.sourceId]);
        let cursor = parent;
        while (cursor && !visited.has(cursor.row.sourceId)) {
            visited.add(cursor.row.sourceId);
            cursor = cursor.row.parent && nodes.get(cursor.row.parent.sourceId);
        }
        if (parent && !cursor)
            parent.children.push(node);
        else
            roots.push(node);
    }
    const matches = (node, inherited = false) => {
        const { row } = node;
        const title = 'displayTitle' in row ? row.displayTitle ?? row.title : row.title;
        const own = inherited || !filter || `${row.project?.name ?? ''} ${title} ${row.title}`.toLocaleLowerCase().includes(filter);
        const children = node.children.map(child => matches(child, own)).filter(child => child !== undefined);
        return own || children.length ? { ...node, children } : undefined;
    };
    for (const root of roots) {
        const node = matches(root);
        if (!node)
            continue;
        const { row } = node;
        if (!row.project) {
            standalone.push(node);
            continue;
        }
        const { key, name } = row.project;
        let group = projects.get(key);
        if (!group)
            projects.set(key, group = { name, rows: [] });
        group.rows.push(node);
    }
    return { projects, standalone };
}
function result(response) {
    if (!response.ok)
        throw new Error(response.error.message);
    return response.value;
}
async function download(api, id, file) {
    const chunks = [];
    for (let index = 0; index < file.chunks; index++) {
        const base64 = result(await api.chunk(id, file.offset + index));
        chunks.push(Uint8Array.from(atob(base64), char => char.charCodeAt(0)));
    }
    const blob = new Blob(chunks, { type: 'application/octet-stream' });
    if (blob.size !== file.size)
        throw new Error('归档文件长度不符，下载已取消。');
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = file.name;
    anchor.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 30_000);
}
export function ImportPanel({ api, open, archiveId, back, catalog, pickDirectory }) {
    const [source, setSource] = React.useState(catalog.source);
    const [folder, setFolder] = React.useState(catalog.folders[source]);
    const cacheKey = JSON.stringify([source, folder]);
    const [search, setSearch] = React.useState('');
    const [preview, setPreview] = React.useState(() => archiveId ? undefined : catalog.pages.get(cacheKey)?.page);
    const [selected, setSelected] = React.useState([]);
    const [expanded, setExpanded] = React.useState({});
    const [globalMemory, setGlobalMemory] = React.useState(false);
    const [report, setReport] = React.useState();
    const [job, setJob] = React.useState();
    const [loadNotice, setLoadNotice] = React.useState('');
    const [archive, setArchive] = React.useState();
    const [loading, setLoading] = React.useState(!preview);
    const [busy, setBusy] = React.useState('');
    const [error, setError] = React.useState('');
    const [revision, refresh] = React.useReducer(value => value + 1, 0);
    const scroll = React.useRef(null);
    const mounted = React.useRef(false);
    React.useEffect(() => {
        mounted.current = true;
        return () => { mounted.current = false; };
    }, []);
    React.useEffect(() => {
        let current = true;
        setError('');
        const load = async () => {
            try {
                if (archiveId) {
                    setLoading(true);
                    const files = result(await api.archive(archiveId));
                    if (current)
                        setArchive(files);
                }
                else {
                    let cached = catalog.pages.get(cacheKey);
                    if (!cached) {
                        if (catalog.pages.size >= 4)
                            catalog.pages.delete(catalog.pages.keys().next().value);
                        cached = { updated: 0 };
                        catalog.pages.set(cacheKey, cached);
                    }
                    if (cached.page && Date.now() - cached.updated < 10 * 60_000) {
                        setPreview(cached.page);
                        return;
                    }
                    setLoading(true);
                    const entry = cached;
                    entry.pending ??= api.preview({ source, scope: 'catalog', catalogOffset: 0, ...(folder ? { home: folder } : {}) })
                        .then(response => {
                        entry.page = result(response);
                        entry.updated = Date.now();
                        return entry.page;
                    }).finally(() => { entry.pending = undefined; });
                    const page = await entry.pending;
                    if (current)
                        setPreview(page);
                }
            }
            catch (failure) {
                if (current)
                    setError(failure instanceof Error ? failure.message : String(failure));
            }
            finally {
                if (current)
                    setLoading(false);
            }
        };
        void load();
        return () => { current = false; };
    }, [api, archiveId, cacheKey, catalog, folder, source, revision]);
    const perform = async (label, action) => {
        setBusy(label);
        setError('');
        try {
            await action();
        }
        catch (failure) {
            setError(failure instanceof Error ? failure.message : String(failure));
        }
        finally {
            setBusy('');
        }
    };
    const resetList = (page) => {
        setPreview(page);
        setSelected([]);
        setExpanded({});
        setReport(undefined);
        setLoadNotice('');
        setLoading(!page);
        setError('');
    };
    const changeFolder = (path) => {
        if (path === folder)
            return;
        catalog.folders[source] = path;
        setFolder(path);
        setSearch('');
        resetList(catalog.pages.get(JSON.stringify([source, path]))?.page);
    };
    const loadMore = () => {
        if (preview?.nextOffset === undefined)
            return;
        const { token, nextOffset } = preview;
        setLoadNotice('');
        void perform('正在加载更多会话…', async () => {
            const next = result(await api.preview({ source, scope: 'catalog', catalogToken: token, catalogOffset: nextOffset }));
            const page = { ...next, rows: [...preview.rows, ...next.rows], warnings: [...new Set([...preview.warnings, ...next.warnings])] };
            catalog.pages.set(cacheKey, { page, updated: Date.now() });
            setPreview(page);
            setLoadNotice(`本次新增 ${next.rows.length} 条，已加载 ${page.rows.length} 条${next.nextOffset === undefined ? '，列表已全部加载。' : '，可继续加载。'}`);
        });
    };
    const fileList = (id, files) => _jsx("ul", { className: "import-files", children: files.map((file, index) => _jsxs("li", { children: [_jsx(Button, { size: "sm", variant: "ghost", disabled: !!busy, onClick: () => void perform('正在下载…', () => download(api, id, file)), children: file.name }), _jsxs("small", { className: "muted", children: [file.size.toLocaleString(), " \u5B57\u8282"] })] }, index)) });
    const { projects, standalone } = groupSessions(preview?.rows ?? [], preview?.unavailable ?? [], search);
    const sourceTab = sourceTabs.find(item => item.value === source);
    const date = (updated) => updated > 0 ? new Date(updated).toLocaleDateString() : '';
    const sessionRow = ({ row, children, placeholder }) => {
        const available = 'key' in row;
        const child = !!row.parent;
        const title = available ? row.displayTitle ?? row.title : row.title;
        const open = expanded[row.sourceId] ?? !!search.trim();
        const checked = available && selected.includes(row.key);
        return _jsxs("li", { children: [_jsxs("div", { className: "import-session", "data-selected": checked, children: [_jsxs("div", { className: "import-session-label", children: [available && !child ? _jsx(Checkbox, { label: title, checked: checked, disabled: !!busy || (!checked && selected.length >= maxSelection), onChange: value => setSelected(current => value ? [...current, row.key] : current.filter(key => key !== row.key)) })
                                    : _jsx("span", { children: title }), !!children.length && _jsx(Button, { size: "sm", variant: "ghost", className: "import-branch-toggle", "aria-label": `${open ? '收起' : '展开'} ${title} 的子会话`, "aria-expanded": open, onClick: () => setExpanded(current => ({ ...current, [row.sourceId]: !open })), icon: _jsx(IconChevronRightOutlineRegular, { size: 14 }) })] }), _jsx("small", { className: "muted", children: child ? '子会话' : placeholder ? '主会话未加载' : available ? date(row.updated) : '缺少本机原档' })] }), open && !!children.length && _jsx("ul", { className: "import-branches", children: children.map(sessionRow) })] }, row.sourceId);
    };
    const watchImport = async (id, roots) => {
        while (mounted.current) {
            const status = result(await api.catalogImportStatus(id));
            if (!mounted.current)
                return;
            setJob(status);
            if (status.phase === 'failed') {
                catalog.jobs.delete(cacheKey);
                throw new Error(status.error ?? '导入失败。');
            }
            if (status.phase !== 'done') {
                await new Promise(resolve => window.setTimeout(resolve, 600));
                continue;
            }
            const next = status.result;
            catalog.jobs.delete(cacheKey);
            setReport(current => {
                const retried = new Set(roots);
                return {
                    sessions: [...(current?.sessions.filter(row => !retried.has(row.rootKey ?? row.key)) ?? []), ...next.sessions],
                    failures: [...(current?.failures.filter(row => !retried.has(row.key)) ?? []), ...next.failures],
                };
            });
            setSelected([...new Set(next.failures.map(row => row.key))]);
            if (scroll.current)
                scroll.current.scrollTop = 0;
            return;
        }
    };
    React.useEffect(() => {
        const pending = !archiveId && catalog.jobs.get(cacheKey);
        if (pending)
            void perform('正在导入会话…', () => watchImport(pending.id, pending.selected));
    }, [archiveId, cacheKey, catalog]);
    const submit = () => {
        if (!preview)
            return;
        void perform('正在导入会话…', async () => {
            const pending = catalog.jobs.get(cacheKey);
            if (pending)
                return watchImport(pending.id, pending.selected);
            setJob({ phase: 'discovering', completed: 0, total: 0 });
            const id = result(await api.startCatalogImport(preview.token, selected, globalMemory));
            catalog.jobs.set(cacheKey, { id, selected });
            await watchImport(id, selected);
        });
    };
    return _jsxs("main", { className: "sessivra-import", children: [_jsx("style", { children: importPanelStyles }), _jsxs("div", { className: "import-frame", children: [_jsxs("header", { className: "import-header", children: [_jsxs("div", { children: [_jsx("h1", { children: archiveId ? '会话原始归档' : '导入会话' }), _jsx("p", { className: "muted", children: archiveId ? '查看并下载原始会话与记忆。' : '从 Codex 或 Claude Code 导入会话，在 DSH 继续对话。' })] }), _jsx("div", { className: "import-actions", children: archiveId ? _jsx(Button, { variant: "outline", onClick: back, children: "\u8FD4\u56DE\u5BFC\u5165\u4F1A\u8BDD" }) : _jsxs(_Fragment, { children: [pickDirectory && _jsx(Button, { variant: "outline", icon: _jsx(IconFolderCloseRegular, { size: 16 }), disabled: !!busy, onClick: () => void perform('正在选择文件夹…', async () => {
                                                const path = await pickDirectory();
                                                if (path)
                                                    changeFolder(path);
                                            }), children: "\u9009\u62E9\u6587\u4EF6\u5939" }), _jsx(Button, { variant: "outline", icon: _jsx(IconRefreshOutlineRegular, { size: 16 }), disabled: loading || !!busy, onClick: () => { catalog.pages.delete(cacheKey); resetList(preview); refresh(); }, children: "\u5237\u65B0" }), _jsx(Button, { variant: "primary", icon: _jsx(IconDownloadOutlineRegular, { size: 16 }), disabled: !preview || loading || !selected.length || !!busy, onClick: submit, children: "\u5BFC\u5165\u6240\u9009\u4F1A\u8BDD" })] }) })] }), !archiveId && _jsxs("div", { className: "import-toolbar", children: [_jsxs("div", { className: "import-controls", children: [_jsx(SegmentedTabs, { items: sourceTabs, value: source, label: "\u6765\u6E90", onChange: value => {
                                            if (busy || value === source)
                                                return;
                                            catalog.source = value;
                                            const nextFolder = catalog.folders[value];
                                            resetList(catalog.pages.get(JSON.stringify([value, nextFolder]))?.page);
                                            setSearch('');
                                            setGlobalMemory(false);
                                            setSource(value);
                                            setFolder(nextFolder);
                                        } }), _jsxs("div", { className: "import-memory", children: [_jsx("span", { "aria-hidden": "true", children: globalMemoryLabel }), _jsx(Switch, { label: globalMemoryLabel, checked: globalMemory, onChange: setGlobalMemory, disabled: !!busy })] })] }), folder && _jsxs("div", { className: "import-folder muted", children: [_jsx("span", { title: folder, children: folder }), _jsx(Button, { size: "sm", variant: "ghost", disabled: !!busy, onClick: () => changeFolder(undefined), children: "\u4F7F\u7528\u9ED8\u8BA4\u76EE\u5F55" })] }), _jsx(Input, { icon: _jsx(IconSearchOutlineRegular, { size: 16 }), "aria-label": "\u641C\u7D22\u9879\u76EE\u6216\u4F1A\u8BDD", placeholder: "\u641C\u7D22\u9879\u76EE\u6216\u4F1A\u8BDD", value: search, onChange: event => { setSearch(event.target.value); setExpanded({}); } })] })] }), archiveId ? _jsx("div", { className: "import-scroll", children: _jsxs("div", { className: "import-frame import-content", children: [loading && _jsx("p", { className: "muted", role: "status", children: "\u6B63\u5728\u8BFB\u53D6\u5F52\u6863\u2026" }), error && _jsx("p", { role: "alert", children: error }), busy && _jsx("p", { className: "muted", role: "status", children: busy }), archive && fileList(archiveId, archive)] }) }) : _jsx(_Fragment, { children: _jsx("div", { className: "import-scroll", ref: scroll, id: sourceTab.panelId, role: "tabpanel", "aria-labelledby": sourceTab.id, "aria-busy": loading, children: _jsxs("div", { className: "import-frame import-content", children: [!!selected.length && _jsxs("small", { className: "muted", "aria-live": "polite", children: ["\u5DF2\u9009 ", selected.length, " \u9879"] }), loading && _jsxs("p", { className: "muted", role: "status", children: ["\u6B63\u5728\u52A0\u8F7D ", sourceTab.label, " \u4F1A\u8BDD\u2026"] }), busy && _jsx("p", { className: "muted", role: "status", children: busy === '正在导入会话…' && job?.phase === 'importing'
                                    ? `正在导入 ${Math.min(job.completed + 1, job.total)} / ${job.total} 条会话${job.title ? ` · ${job.title}` : ''}`
                                    : busy === '正在导入会话…' ? '正在查找所选主会话及子会话…' : busy }), loadNotice && _jsx("p", { className: "muted", role: "status", children: loadNotice }), error && _jsx("p", { role: "alert", children: error }), report && _jsxs("section", { "aria-label": "\u5BFC\u5165\u7ED3\u679C", children: [_jsxs("h2", { children: [report.failures.length ? '导入完成，部分会话失败' : '导入完成', " \u00B7 ", report.sessions.length, " \u6761\u53EF\u7EE7\u7EED"] }), report.failures.map((row, index) => _jsxs("p", { role: "alert", children: [row.title ?? preview?.rows.find(candidate => candidate.key === row.key)?.title, "\uFF1A", row.message] }, row.key + ':' + index)), _jsx("ul", { className: "import-results", children: report.sessions.map(row => _jsxs("li", { className: row.parentId ? 'import-result-child' : undefined, children: [_jsxs("div", { className: "import-result-row", children: [_jsx("strong", { children: row.title }), _jsx(Button, { size: "sm", variant: "outline", disabled: !!busy, onClick: () => void perform('正在打开会话…', () => open(row.id)), children: "\u6253\u5F00\u5E76\u7EE7\u7EED" })] }), _jsxs("small", { className: "muted", children: [row.status === 'existing' ? '已导入 · ' : '', row.projectedMessages, " \u6761\u6B63\u6587"] }), _jsxs("details", { children: [_jsx("summary", { children: "\u4E0B\u8F7D\u539F\u59CB\u4F1A\u8BDD\u4E0E\u8BB0\u5FC6" }), fileList(row.id, row.files)] })] }, row.id)) })] }), !!projects.size && _jsxs("section", { "aria-label": "\u9879\u76EE", children: [_jsx("h2", { children: "\u9879\u76EE" }), [...projects].map(([key, group]) => _jsxs("details", { className: "import-project", open: !!search.trim(), children: [_jsxs("summary", { children: [_jsx(IconChevronRightOutlineRegular, { className: "import-chevron", size: 14 }), _jsx(IconFolderCloseRegular, { size: 16 }), _jsx("span", { children: group.name }), _jsxs("small", { className: "muted", children: [group.rows.length, " \u4E2A\u4F1A\u8BDD"] })] }), _jsx("ul", { children: group.rows.map(sessionRow) })] }, search.trim() + ':' + key))] }), !!standalone.length && _jsxs("section", { "aria-label": "\u72EC\u7ACB\u4F1A\u8BDD", children: [_jsx("h2", { children: "\u72EC\u7ACB\u4F1A\u8BDD" }), _jsx("ul", { children: standalone.map(sessionRow) })] }), preview && !projects.size && !standalone.length && _jsx("p", { className: "muted", children: search.trim() ? preview.nextOffset === undefined ? '没有匹配的项目或会话。' : '已加载的会话中没有匹配项。' : '没有找到本机可读取的会话。' }), preview?.nextOffset !== undefined && _jsx("div", { className: "import-more", children: _jsx(Button, { size: "sm", variant: "outline", disabled: loading || !!busy, onClick: loadMore, children: busy === '正在加载更多会话…' ? '加载中…' : '加载更多会话' }) }), !!preview?.warnings.length && _jsxs("details", { className: "muted", children: [_jsx("summary", { children: "\u90E8\u5206\u8BB0\u5F55\u672A\u80FD\u52A0\u8F7D" }), preview.warnings.map(warning => _jsx("p", { children: warning }, warning))] })] }) }) })] });
}
