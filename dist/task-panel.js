import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import { useEffect, useRef, useState } from 'react';
import { css } from './task-panel-styles.js';
import { Icon, Pill, when } from './task-panel-visual.js';
import { fileName, taskFiles } from './task-files.js';
import { resultOverview } from './task-result-overview.js';
export const taskPanelTitle = '任务中心';
const actions = {
    update: '修改要求',
    answer: '回答问题',
    review: '验收结果',
    resume: '继续任务',
    pause: '暂停',
    cancel: '取消任务',
    reconcile: '检查投递',
    archive: '归档',
};
const statusNames = {
    queued: '排队',
    dispatched: '待接手',
    running: '执行中',
    'waiting-decision': '待裁决',
    blocked: '受阻',
    pausing: '暂停中',
    paused: '已暂停',
    cancelling: '取消中',
    review: '待验收',
    completed: '已完成',
    cancelled: '已取消',
    failed: '失败',
};
const problem = (e) => {
    const msg = e instanceof Error ? e.message : String(e);
    if (/CONFLICT|READ_LATEST/.test(msg))
        return '记录已更新。请核对最新内容后重新提交。';
    if (/SUPERAGENT_OWNS_SESSION/.test(msg))
        return '该会话由 Superagent 管理，请选择其他会话。';
    if (/PERMISSION|ACCESS_DENIED|POLICY_BLOCKED/.test(msg))
        return '会话许可或工作目录已变化，请打开原会话检查。';
    return msg;
};
const readableReason = (reason) => ({
    TURN_ENDED_WITHOUT_TASK_RESULT: '本轮结束，执行会话尚未提交结果',
    RECOVERED_TASK_REQUIRES_RESUME: '宿主已重开，请核查检查点后继续',
    DIRECT_USER_INPUT_REQUIRES_TASK_RECONCILIATION: '用户在执行会话补充了要求，等待核对',
    WAITING_FOR_REQUIRED_DECISION: '等待前置问题的回答',
    TASK_PERMISSION_REVOKED: '会话许可已改变',
    TASK_DISPATCH_UNCERTAIN: '等待回查投递',
    DECISION_CHANGED_AFTER_ACCEPTANCE: '验收后决定已改变，请复核影响',
})[reason] ?? reason;
async function read(p) {
    const r = await p;
    if (!r.ok)
        throw new Error(r.error.message);
    return r.value;
}
const lines = (form, key) => String(form.get(key) ?? '')
    .split(/\r?\n/)
    .map((s) => s.trim())
    .filter(Boolean);
const str = (form, key) => String(form.get(key) ?? '').trim();
function Notes({ label, name, value = '', required = false, }) {
    return (_jsxs("label", { children: [label, _jsx("textarea", { name: name, defaultValue: value, required: required, rows: 2 })] }));
}
function RecordList({ title, items }) {
    return items.length ? (_jsxs("section", { children: [_jsx("h4", { children: title }), _jsx("ul", { children: items.map((item, i) => (_jsx("li", { children: item }, i))) })] })) : null;
}
function ResultHeader({ task, name }) {
    const result = task.result && resultOverview(task.result);
    const review = task.review;
    let status = '尚未提交验收';
    let at;
    if (task.status === 'review') {
        status = '待验收';
        at = task.result?.at;
    }
    else if (task.status === 'completed' && review?.accepted) {
        status = task.reason === 'DECISION_CHANGED_AFTER_ACCEPTANCE' ? '决定已更新，需复核'
            : review.by === 'operator:owner' ? '用户已验收' : name(review.by) + ' 已验收';
        at = review.at;
    }
    else if (task.status === 'cancelled' || task.status === 'failed') {
        status = '未验收';
    }
    else if (review && !review.accepted) {
        status = '已退回补做';
        at = review.at;
    }
    return _jsxs("section", { className: "st-outcome", "aria-label": "\u7ED3\u679C\u4E0E\u9A8C\u6536", children: [result && _jsxs("div", { children: [_jsx("h4", { children: "\u4EFB\u52A1\u7ED3\u679C" }), result.highlights.length > 0 && _jsx("p", { className: "st-figures", children: result.highlights.join(' · ') }), _jsx("p", { children: result.text })] }), _jsxs("div", { className: "st-review-state", children: [_jsx("span", { children: "\u5F53\u524D\u9A8C\u6536\u72B6\u6001" }), _jsx("strong", { children: status }), at !== undefined && _jsx("small", { children: when(at) })] })] });
}
function FilePreview({ file, renderMarkdown }) {
    const [source, setSource] = useState(false);
    const [expanded, setExpanded] = useState(false);
    const markdown = /\.(md|markdown)$/i.test(file.name);
    return _jsxs("div", { className: "st-preview", children: [_jsxs("div", { className: "st-readtools", children: [markdown && _jsx("button", { onClick: () => setSource(!source), "aria-pressed": source, children: source ? '返回预览' : '查看原文' }), _jsx("button", { onClick: () => setExpanded(!expanded), "aria-expanded": expanded, children: expanded ? '收起全文' : '展开阅读' })] }), _jsx("div", { className: "st-readbody", "data-expanded": expanded, children: markdown && !source ? renderMarkdown(file.text) : _jsx("pre", { children: file.text }) }), file.truncated && _jsx("p", { children: "\u9884\u89C8\u663E\u793A\u524D 32 KiB\uFF0C\u5B8C\u6574\u6587\u4EF6\u8BF7\u5728\u6267\u884C\u76EE\u5F55\u67E5\u770B\u3002" })] });
}
export function TaskPanel({ api, open, renderMarkdown, initialSession, initialTask, source: initialSource, openOrigin, }) {
    const [query, setQuery] = useState({ view: 'attention' }), [page, setPage] = useState(), [sessions, setSessions] = useState([]);
    const [source, setSource] = useState(initialSource);
    const [id, select] = useState(initialTask ?? ''), [item, detail] = useState(), [mode, setMode] = useState(source ? 'create' : ''), [question, setQuestion] = useState('');
    const [owner, setOwner] = useState(initialSession ?? ''), [executor, setExecutor] = useState(''), [tick, reload] = useState(0);
    const [filtersOpen, showFilters] = useState(false);
    const panel = useRef(null);
    const autoPick = useRef(false);
    const pendingKey = 'sessivra-task-panel/pending-operation';
    const [pending, setPending] = useState(() => {
        try {
            return sessionStorage.getItem(pendingKey) ?? '';
        }
        catch {
            return '';
        }
    });
    function rememberPending(value) {
        setPending(value);
        try {
            if (value)
                sessionStorage.setItem(pendingKey, value);
            else
                sessionStorage.removeItem(pendingKey);
        }
        catch {
            /* Runtime-only recovery when storage is unavailable. */
        }
    }
    async function checkPending() {
        try {
            const receipt = await read(api.operation(pending));
            if (receipt) {
                setSource(undefined);
                setMode('');
                select(receipt.id);
                reload((n) => n + 1);
                fail('');
                rememberPending('');
            }
            else
                fail('尚未查到成功记录。检查原任务后，可使用同一请求重试。');
        }
        catch (e) {
            fail(problem(e));
        }
    }
    const [error, fail] = useState(''), [busy, setBusy] = useState(false), [checkedToken, setChecked] = useState('');
    const base = useRef(), operation = useRef(), inFlight = useRef(false);
    const selected = item?.id === id ? item : undefined;
    const [preview, setPreview] = useState();
    const previewRequest = useRef(0);
    const name = (key) => sessions.find((s) => s.id === key)?.label ?? key;
    useEffect(() => {
        let active = true;
        read(api.participants())
            .then((rows) => {
            if (active) {
                setSessions(rows);
                setOwner((current) => rows.some((s) => s.id === current && !s.child) ? current : (rows.find((s) => !s.child && (!source || s.workspace === source.cwd))?.id ?? 'new'));
            }
        })
            .catch((e) => active && fail(problem(e)));
        return () => {
            active = false;
        };
    }, [api, initialSession, source]);
    useEffect(() => {
        let active = true;
        let timer;
        const refresh = async () => {
            try {
                const [p, d] = await Promise.all([
                    read(api.list(JSON.parse(JSON.stringify(query)))),
                    id ? read(api.detail(id)) : undefined,
                ]);
                if (active) {
                    setPage(p);
                    detail(d);
                    if (autoPick.current && !id && !mode && p.items.length && (panel.current?.clientWidth ?? 0) > 730)
                        select(p.items[0].id);
                    autoPick.current = false;
                }
            }
            catch (e) {
                if (active)
                    fail(problem(e));
            }
            finally {
                if (active)
                    timer = setTimeout(() => void refresh(), 5000);
            }
        };
        void refresh();
        return () => {
            active = false;
            clearTimeout(timer);
        };
    }, [query, id, tick, api]);
    function choose(next) {
        previewRequest.current++;
        setPreview(undefined);
        select(next);
        setMode('');
        fail('');
    }
    function edit(action, qid = '') {
        base.current = selected;
        operation.current = undefined;
        setChecked('');
        setMode(action);
        setQuestion(qid);
        fail('');
    }
    function filter(key, value) {
        setQuery((q) => ({ ...q, [key]: value || undefined, cursor: undefined }));
        choose('');
        autoPick.current = key === 'view' && value === 'history';
    }
    const stale = !!(mode && mode !== 'create' && selected && base.current?.token !== selected.token);
    const checkedVersion = !!selected && checkedToken === selected.token;
    async function submit(e) {
        e.preventDefault();
        if (inFlight.current)
            return;
        const f = new FormData(e.currentTarget), original = base.current;
        let body;
        if (mode === 'create') {
            const prerequisite = str(f, 'prerequisite'), group = str(f, 'group');
            body = {
                action: 'create',
                coordinator: owner === 'new' ? undefined : owner,
                coordinatorDirectory: owner === 'new' ? str(f, 'coordinatorDirectory') : undefined,
                assignee: executor || undefined,
                title: str(f, 'title'),
                goal: str(f, 'goal'),
                acceptance: lines(f, 'acceptance'),
                resources: lines(f, 'resources'),
                scope: group || undefined,
                scopeLabel: group ? page?.groups.find((g) => g.id === group)?.label : str(f, 'groupLabel') || undefined,
                cwd: !executor ? str(f, 'cwd') || undefined : undefined,
                reasoningEffort: !executor ? str(f, 'effort') || undefined : undefined,
                ...(source ? { origin: source.origin } : {}),
                requiredQuestions: prerequisite
                    ? [
                        {
                            topic: str(f, 'topic') || prerequisite,
                            context: str(f, 'context'),
                            question: prerequisite,
                            options: lines(f, 'options'),
                        },
                    ]
                    : undefined,
            };
        }
        else {
            if (!original || !selected)
                return;
            if (stale && !checkedVersion) {
                fail('任务已更新，请核对最新版本。');
                return;
            }
            const stamp = { taskId: id, expected: selected.token };
            if (mode === 'update')
                body = {
                    ...stamp,
                    action: mode,
                    title: str(f, 'title'),
                    goal: str(f, 'goal'),
                    acceptance: lines(f, 'acceptance'),
                    explanation: str(f, 'reason'),
                };
            else if (mode === 'answer')
                body = {
                    ...stamp,
                    action: mode,
                    questionId: question,
                    version: selected.questions.find((q) => q.id === question)?.version,
                    answer: str(f, 'answer'),
                };
            else if (mode === 'review') {
                const accepted = str(f, 'outcome') === 'accepted', evidence = lines(f, 'evidence'), remaining = lines(f, 'remaining');
                if (accepted && selected.acceptance.some((_, i) => !f.has('criterion-' + i))) {
                    fail('请逐项核对验收条件并勾选通过项。');
                    return;
                }
                if (!accepted && !remaining.length) {
                    fail('请填写退回后需要完成的事项。');
                    return;
                }
                body = {
                    ...stamp,
                    action: mode,
                    accepted,
                    evidence,
                    remaining,
                    checked: selected.acceptance.map((_, i) => f.has('criterion-' + i)),
                    explanation: str(f, 'reason'),
                };
            }
            else if (mode === 'archive' || mode === 'reconcile')
                body = { ...stamp, action: mode };
            else
                body = { ...stamp, action: mode, reason: str(f, 'reason') };
        }
        const key = JSON.stringify(body);
        inFlight.current = true;
        setBusy(true);
        fail('');
        try {
            const bytes = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(key));
            const digest = Array.from(new Uint8Array(bytes), (x) => x.toString(16).padStart(2, '0')).join('');
            let stored = '';
            try {
                stored = sessionStorage.getItem(pendingKey + '/digest') ?? '';
            }
            catch {
                /* optional browser store */
            }
            if (operation.current?.body !== key)
                operation.current = { body: key, id: stored === digest && pending ? pending : crypto.randomUUID() };
            rememberPending(operation.current.id);
            try {
                sessionStorage.setItem(pendingKey + '/digest', digest);
            }
            catch {
                /* runtime identity remains available */
            }
            const result = await read(api.command({ ...JSON.parse(key), operationId: operation.current.id }));
            rememberPending('');
            setSource(undefined);
            setMode('');
            select(result.id);
            if (mode === 'create')
                setSessions(await read(api.participants()));
            if (mode === 'archive')
                setQuery({ view: 'history' });
            reload((n) => n + 1);
        }
        catch (e) {
            fail(problem(e));
            reload((n) => n + 1);
        }
        finally {
            inFlight.current = false;
            setBusy(false);
        }
    }
    const coordinator = sessions.find((s) => s.id === owner && !s.child);
    const assignee = sessions.find((s) => s.id === executor);
    const assigneeHasTasks = assignee && page?.items.some((t) => t.assignee === assignee.id && !['completed', 'cancelled', 'failed'].includes(t.status));
    const files = selected ? taskFiles(selected) : [];
    const qs = selected?.questions.filter(q => !q.mergedInto) ?? [];
    const chips = ['workspace', 'status', 'coordinator', 'assignee', 'scope'].filter(k => query[k]);
    const clearFilters = () => { setQuery({ view: query.view }); choose(''); };
    const labelFor = (k) => { const v = query[k] ?? ''; return k === 'workspace' ? fileName(v) : k === 'status' ? (statusNames[v] ?? v) : k === 'scope' ? (page?.groups.find(g => g.id === v)?.label ?? '协作组') : name(v); };
    const actionForm = (_jsxs("form", { onSubmit: submit, "aria-label": actions[mode] ?? '新建任务', children: [_jsx("h3", { children: actions[mode] ?? '新建任务' }), mode === 'create' && source && _jsxs("p", { className: "st-question", children: ["\u6765\u6E90 \u00B7 ", source.title] }), (mode === 'create' || mode === 'update') && (_jsxs(_Fragment, { children: [_jsxs("label", { children: ["\u6807\u9898", _jsx("input", { required: true, name: "title", maxLength: 160, defaultValue: mode === 'update' ? base.current?.title : source?.excerpt.trim().split(/\r?\n/, 1)[0]?.slice(0, 120) })] }), _jsx(Notes, { label: "\u76EE\u6807", name: "goal", required: true, value: mode === 'update' ? base.current?.goal : source?.excerpt }), _jsx(Notes, { label: "\u9A8C\u6536\u6761\u4EF6\uFF08\u6BCF\u884C\u4E00\u9879\uFF09", name: "acceptance", required: true, value: mode === 'update' ? base.current?.acceptance.join('\n') : '' })] })), mode === 'create' && (_jsxs(_Fragment, { children: [_jsxs("label", { children: ["\u534F\u8C03\u4F1A\u8BDD", _jsxs("select", { required: true, value: owner, onChange: (e) => {
                                    setOwner(e.target.value);
                                    setExecutor('');
                                }, children: [_jsx("option", { value: "", children: "\u9009\u62E9\u4F1A\u8BDD" }), _jsx("option", { value: "new", children: "\u65B0\u5EFA\u534F\u8C03\u4F1A\u8BDD" }), sessions
                                        .filter((s) => !s.child)
                                        .map((s) => (_jsxs("option", { value: s.id, children: [s.label, " \u00B7 ", s.workspace] }, s.id)))] })] }), owner === 'new' && (_jsxs("label", { children: ["\u534F\u8C03\u4F1A\u8BDD\u5DE5\u4F5C\u76EE\u5F55", _jsx("input", { name: "coordinatorDirectory", required: true, defaultValue: source?.cwd ?? query.workspace ?? sessions.find(s => s.id === initialSession)?.workspace ?? '' })] })), _jsxs("label", { children: ["\u6267\u884C\u4F1A\u8BDD", _jsxs("select", { value: executor, onChange: (e) => setExecutor(e.target.value), children: [_jsx("option", { value: "", children: "\u65B0\u5EFA\u666E\u901A\u5B50\u4F1A\u8BDD" }), sessions
                                        .filter((s) => s.id !== owner && (!s.child || s.parent === owner))
                                        .map((s) => (_jsxs("option", { value: s.id, children: [s.label, " \u00B7 ", s.workspace] }, s.id)))] })] })] })), mode === 'create' && (_jsxs("details", { children: [_jsx("summary", { children: "\u534F\u4F5C\u7EC4\u3001\u8D44\u6E90\u4E0E\u524D\u7F6E\u95EE\u9898" }), _jsxs("label", { children: ["\u534F\u4F5C\u7EC4", _jsxs("select", { name: "group", children: [_jsx("option", { value: "", children: "\u65B0\u5EFA\u72EC\u7ACB\u7EC4" }), page?.groups
                                        .filter((g) => g.coordinator === owner)
                                        .map((g) => (_jsx("option", { value: g.id, children: g.label }, g.id)))] })] }), _jsxs("label", { children: ["\u65B0\u7EC4\u540D\u79F0", _jsx("input", { name: "groupLabel" })] }), _jsx(Notes, { label: "\u58F0\u660E\u8D44\u6E90\uFF08\u6BCF\u884C\u4E00\u4E2A\u8DEF\u5F84\uFF09", name: "resources" }), !executor && (_jsxs(_Fragment, { children: [_jsxs("label", { children: ["\u5B50\u4F1A\u8BDD\u76EE\u5F55", _jsx("input", { name: "cwd", placeholder: sessions.find((s) => s.id === owner)?.workspace ?? '' })] }), _jsxs("label", { children: ["\u63A8\u7406\u7EA7\u522B", _jsx("input", { name: "effort" })] })] })), _jsx(Notes, { label: "\u5F00\u59CB\u524D\u9700\u8981\u56DE\u7B54\u7684\u95EE\u9898", name: "prerequisite" }), _jsxs("label", { children: ["\u95EE\u9898\u4E3B\u9898", _jsx("input", { name: "topic" })] }), _jsxs("label", { children: ["\u9002\u7528\u6761\u4EF6", _jsx("input", { name: "context" })] }), _jsx(Notes, { label: "\u53EF\u9009\u7B54\u6848\uFF08\u6BCF\u884C\u4E00\u9879\uFF09", name: "options" })] })), mode === 'answer' && (_jsxs(_Fragment, { children: [_jsx("p", { children: selected?.questions.find((q) => q.id === question)?.question }), _jsxs("label", { children: ["\u7B54\u590D", _jsx("input", { name: "answer", required: true, list: "sessivra-answer-options" })] }), _jsx("datalist", { id: "sessivra-answer-options", children: selected?.questions
                            .find((q) => q.id === question)
                            ?.options.map((o) => (_jsx("option", { value: o }, o))) })] })), mode === 'review' && (_jsxs(_Fragment, { children: [_jsxs("fieldset", { children: [_jsx("legend", { children: "\u9010\u9879\u6838\u9A8C" }), selected?.acceptance.map((rule, i) => (_jsxs("label", { style: { display: 'flex', alignItems: 'center' }, children: [_jsx("input", { type: "checkbox", name: 'criterion-' + i }), rule] }, i)))] }, selected?.token), _jsxs("label", { children: ["\u9A8C\u6536\u7ED3\u8BBA", _jsxs("select", { name: "outcome", children: [_jsx("option", { value: "accepted", children: "\u901A\u8FC7" }), _jsx("option", { value: "rework", children: "\u9000\u56DE\u8865\u505A" })] })] }), _jsx(Notes, { name: "evidence", label: "\u6838\u9A8C\u7684\u4EA7\u7269\u4E0E\u8BC1\u636E\uFF08\u6BCF\u884C\u4E00\u9879\uFF09", required: true }), _jsx(Notes, { name: "remaining", label: "\u9000\u56DE\u540E\u9700\u5B8C\u6210\u7684\u4E8B\u9879" })] })), ['update', 'review', 'pause', 'resume', 'cancel'].includes(mode) && (_jsx(Notes, { label: "\u8BF4\u660E", name: "reason", required: true })), mode === 'cancel' && _jsx("p", { children: "\u5F53\u524D\u5DE5\u5177\u7ED3\u675F\u540E\u53D6\u6D88\u3002\u540E\u7EED\u6392\u961F\u4EFB\u52A1\u53EF\u80FD\u5F00\u59CB\uFF0C\u5DF2\u4EA7\u751F\u7684\u5916\u90E8\u64CD\u4F5C\u4F1A\u4FDD\u7559\u3002" }), mode === 'archive' && _jsx("p", { children: "\u5F52\u6863\u540E\u5728\u5386\u53F2\u4E2D\u67E5\u770B\u4EFB\u52A1\u3001\u51B3\u5B9A\u548C\u8BC1\u636E\u3002" }), mode === 'reconcile' && _jsx("p", { children: "\u68C0\u67E5\u539F\u4F1A\u8BDD\u7684\u6536\u4EF6\u7BB1\u548C\u5386\u53F2\u3002\u5982\u679C\u4F1A\u8BDD\u5C1A\u672A\u6253\u5F00\uFF0C\u8BF7\u5148\u6253\u5F00\u6267\u884C\u4F1A\u8BDD\u3002" }), stale && (_jsxs("label", { children: [_jsx("input", { type: "checkbox", checked: checkedVersion, onChange: (e) => setChecked(e.target.checked ? selected.token : '') }), "\u6211\u5DF2\u6838\u5BF9\u4E0B\u65B9\u6700\u65B0\u8981\u6C42\u4E0E\u7ED3\u679C\uFF0C\u4F7F\u7528\u5F53\u524D\u7248\u672C"] })), mode === 'create' && (_jsx("p", { children: coordinator || owner === 'new' ? (_jsxs(_Fragment, { children: [coordinator ? _jsxs(_Fragment, { children: ["\u300C", coordinator.label, "\u300D\u8D1F\u8D23\u534F\u8C03\u3002"] }) : '将新建会话负责协调。', assignee ? _jsxs(_Fragment, { children: ["\u300C", assignee.label, "\u300D\u8D1F\u8D23\u6267\u884C\u3002"] }) : '将新建子会话执行任务。', assigneeHasTasks && '执行会话有其他待处理任务，本任务可能需要排队。', "\u5982\u6709\u524D\u7F6E\u95EE\u9898\uFF0C\u8BF7\u5148\u7B54\u590D\u3002\u6267\u884C\u4F1A\u8BDD\u548C\u6240\u9700\u8D44\u6E90\u53EF\u7528\u540E\uFF0C\u7CFB\u7EDF\u4F1A\u5B89\u6392\u4EFB\u52A1\u3002"] })) : '请选择负责协调的会话。' })), _jsxs("div", { className: "st-actions", children: [_jsx("button", { type: "submit", disabled: busy || (stale && !checkedVersion), children: busy ? '提交中…' : mode === 'create' ? '创建并安排' : '确认' + actions[mode] }), _jsx("button", { type: "button", disabled: busy, onClick: () => { setSource(undefined); setMode(''); }, children: "\u8FD4\u56DE" })] })] }, mode + question));
    const showDetail = !!selected && mode !== 'create';
    const feedback = _jsxs(_Fragment, { children: [error && _jsx("p", { role: "alert", children: error }), pending && !busy && _jsx("button", { onClick: () => void checkPending(), children: "\u56DE\u67E5\u4E0A\u6B21\u63D0\u4EA4" })] });
    return (_jsxs("main", { className: "sessivra-tasks", ref: panel, "data-detail": showDetail || undefined, children: [_jsx("style", { children: css }), _jsx("div", { className: "st-master", children: _jsxs("div", { className: "st-shell", children: [_jsxs("header", { className: "st-head", children: [_jsx("h2", { children: taskPanelTitle }), mode !== 'create' && _jsxs("button", { className: "st-primary", onClick: () => edit('create'), children: [_jsx(Icon, { name: "plus", size: 14 }), "\u65B0\u5EFA\u4EFB\u52A1"] })] }), !showDetail && feedback, mode === 'create' ? _jsx("div", { className: "st-formpage", children: actionForm }) : _jsxs(_Fragment, { children: [_jsx("nav", { "aria-label": "\u4EFB\u52A1\u89C6\u56FE", children: ['attention', 'all', 'history'].map((v, i) => _jsx("button", { "aria-pressed": query.view === v, onClick: () => filter('view', v), children: ['待处理', '全部任务', '历史'][i] }, v)) }), _jsxs("div", { className: "st-bar", children: [_jsxs("label", { className: "st-search", children: [_jsx(Icon, { name: "search" }), _jsx("input", { type: "search", "aria-label": "\u641C\u7D22\u4EFB\u52A1", placeholder: "\u641C\u7D22\u4EFB\u52A1", value: query.search ?? '', onChange: e => filter('search', e.target.value) })] }), _jsxs("button", { "aria-expanded": filtersOpen, onClick: () => showFilters(!filtersOpen), children: [_jsx(Icon, { name: "filter" }), "\u7B5B\u9009", chips.length > 0 && _jsx("span", { className: "st-count", children: chips.length })] })] }), filtersOpen && _jsxs("div", { className: "st-filters", children: [_jsxs("label", { children: ["\u5DE5\u4F5C\u76EE\u5F55", _jsxs("select", { "aria-label": "\u5DE5\u4F5C\u76EE\u5F55", value: query.workspace ?? '', onChange: (e) => filter('workspace', e.target.value), children: [_jsx("option", { value: "", children: "\u5168\u90E8\u5DE5\u4F5C\u76EE\u5F55" }), Array.from(new Set([...(page?.workspaces ?? []), ...(query.workspace ? [query.workspace] : [])])).map((s) => (_jsx("option", { children: s }, s)))] })] }), _jsxs("label", { children: ["\u72B6\u6001", _jsxs("select", { "aria-label": "\u72B6\u6001", value: query.status ?? '', onChange: (e) => filter('status', e.target.value), children: [_jsx("option", { value: "", children: "\u6240\u6709\u72B6\u6001" }), Object.entries(statusNames).map(([k, v]) => (_jsx("option", { value: k, children: v }, k)))] })] }), query.view === 'all' && (_jsxs("label", { children: ["\u6392\u5E8F", _jsxs("select", { "aria-label": "\u6392\u5E8F", value: query.sort ?? 'attention', onChange: (e) => filter('sort', e.target.value), children: [_jsx("option", { value: "attention", children: "\u9700\u5904\u7406\u4F18\u5148" }), _jsx("option", { value: "recent", children: "\u6700\u8FD1\u66F4\u65B0\u4F18\u5148" })] })] })), ['coordinator', 'assignee'].map((k) => (_jsxs("label", { children: [k === 'coordinator' ? '协调会话' : '执行会话', _jsxs("select", { "aria-label": k === 'coordinator' ? '协调会话筛选' : '执行会话筛选', value: query[k] ?? '', onChange: (e) => filter(k, e.target.value), children: [_jsx("option", { value: "", children: k === 'coordinator' ? '所有协调会话' : '所有执行会话' }), sessions.map((s) => (_jsx("option", { value: s.id, children: s.label }, s.id)))] })] }, k))), _jsxs("label", { children: ["\u534F\u4F5C\u7EC4", _jsxs("select", { "aria-label": "\u534F\u4F5C\u7EC4\u7B5B\u9009", value: query.scope ?? '', onChange: (e) => filter('scope', e.target.value), children: [_jsx("option", { value: "", children: "\u5168\u90E8\u534F\u4F5C\u7EC4" }), page?.groups.map((g) => (_jsx("option", { value: g.id, children: g.label }, g.id)))] })] })] }), chips.length > 0 && _jsx("div", { className: "st-chipbar", children: chips.map(k => _jsxs("button", { title: '移除筛选：' + query[k], onClick: () => filter(k, undefined), children: [labelFor(k), _jsx(Icon, { name: "close", size: 13 })] }, k)) }), _jsxs("aside", { className: "st-items", children: [_jsxs("div", { className: "st-listhead", children: [_jsx("span", { children: query.view === 'history' ? '归档任务' : query.view === 'all' ? '任务列表' : '需要你处理' }), _jsx("span", { className: "st-count", children: page ? (query.view === 'attention' ? page.attention.length : page.total) : '…' })] }), !page ? _jsx("p", { className: "st-empty", role: "status", children: "\u8BFB\u53D6\u4E2D\u2026" }) : _jsxs(_Fragment, { children: [query.view === 'attention' ? ['待回答', '待验收', '受阻', '投递不确定', '待同步'].map(kind => {
                                                    const group = page.attention.filter(a => a.kind === kind);
                                                    return group.length > 0 && _jsxs("section", { children: [_jsxs("div", { className: "st-groupname", children: [kind, " \u00B7 ", group.length] }), group.map(a => _jsxs("button", { className: "st-row", "aria-pressed": id === a.taskId, onClick: () => choose(a.taskId), children: [_jsx("strong", { children: a.title }), _jsxs("small", { children: [a.affected.length > 1 ? '影响 ' + a.affected.length + ' 项任务' : kind, _jsx(Icon, { name: "chevron", size: 14 })] })] }, a.key))] }, kind);
                                                }) : page.items.map(t => _jsxs("button", { className: "st-row", "aria-pressed": id === t.id, onClick: () => choose(t.id), children: [_jsx("strong", { children: t.title }), _jsxs("small", { children: [_jsx(Pill, { label: t.label, status: t.status }), _jsx("time", { title: when(t.updatedAt), children: when(t.updatedAt, true) })] }), typeof t.wait === 'string' && _jsx("small", { children: readableReason(t.wait) })] }, t.id)), (query.view === 'attention' ? !page.attention.length : !page.items.length) && _jsxs("div", { className: "st-empty", children: [_jsx("span", { className: "st-emptyicon", children: _jsx(Icon, { name: query.view === 'attention' ? 'inbox' : query.view === 'history' ? 'archive' : 'list', size: 24 }) }), _jsx("h4", { children: chips.length || query.search ? '没有符合条件的任务。' : query.view === 'attention' ? '当前没有需要处理的事项。' : query.view === 'history' ? '还没有归档任务' : '还没有任务' }), _jsx("p", { children: chips.length || query.search ? '换个关键词，或清除筛选再查看。' : query.view === 'attention' ? '共同问题、待验收结果和受阻任务会出现在这里。' : query.view === 'history' ? '任务归档后，可以在这里回看决定和交付文件。' : '创建任务后，可以在这里跟进执行和验收。' }), chips.length || query.search ? _jsx("button", { onClick: clearFilters, children: "\u6E05\u9664\u7B5B\u9009" }) : query.view === 'attention' ? _jsx("button", { onClick: () => filter('view', 'all'), children: "\u67E5\u770B\u5168\u90E8\u4EFB\u52A1" }) : query.view === 'all' ? _jsx("button", { onClick: () => edit('create'), children: "\u521B\u5EFA\u7B2C\u4E00\u9879\u4EFB\u52A1" }) : null] }), (query.cursor || page.next) && _jsxs("div", { className: "st-listfoot", children: [query.cursor && _jsx("button", { onClick: () => setQuery(q => ({ ...q, cursor: undefined })), children: "\u9996\u9875" }), page.next && _jsx("button", { onClick: () => setQuery(q => ({ ...q, cursor: page.next })), children: "\u4E0B\u4E00\u9875" })] })] })] })] })] }) }), showDetail && selected && _jsxs("article", { className: "st-detail", children: [_jsxs("header", { children: [_jsxs("div", { className: "st-detailtop", children: [_jsx("h3", { children: selected.title }), _jsx("button", { "aria-label": "\u8FD4\u56DE\u5217\u8868", title: "\u8FD4\u56DE\u5217\u8868", onClick: () => choose(''), children: _jsx(Icon, { name: "close", size: 16 }) })] }), _jsxs("div", { className: "st-meta", children: [_jsx(Pill, { status: selected.status, label: statusNames[selected.status] }), _jsx("span", { children: 'archivedAt' in selected ? '归档于 ' + when(selected.archivedAt) : '更新于 ' + when(selected.updatedAt) })] }), selected.scopeLabel && _jsxs("div", { className: "st-meta", children: [_jsx(Icon, { name: "group", size: 14 }), selected.scopeLabel] })] }), _jsx(ResultHeader, { task: selected, name: name }), feedback, !!(selected.queueReason || selected.reason) && selected.runtime !== '历史' && _jsx("p", { children: readableReason(selected.queueReason || selected.reason || '') }), mode && _jsx("div", { children: actionForm }), !mode && selected.actions.some(a => a !== 'answer') && _jsx("div", { className: "st-actions", children: ['review', 'resume', 'reconcile', 'archive', 'update', 'pause', 'cancel'].filter(a => selected.actions.includes(a)).map(a => _jsx("button", { className: ['review', 'resume', 'reconcile', 'archive'].includes(a) ? 'st-primary' : undefined, onClick: () => edit(a), children: actions[a] }, a)) }), qs.some(q => !q.decision) && _jsxs("section", { children: [_jsxs("div", { className: "st-blocktitle", children: [_jsx(Icon, { name: "chat" }), _jsx("h4", { children: "\u9700\u8981\u56DE\u7B54" })] }), qs.filter(q => !q.decision).map(q => _jsxs("div", { className: "st-question", children: [_jsx("strong", { children: q.question }), q.context && _jsx("p", { children: q.context }), _jsxs("p", { children: [q.options.join(' / '), q.taskIds.length > 1 && ' · 影响 ' + q.taskIds.length + ' 项任务'] }), !mode && selected.actions.includes('answer') && _jsx("button", { className: "st-primary", onClick: () => edit('answer', q.id), children: "\u56DE\u7B54\u95EE\u9898" })] }, q.id))] }), files.length > 0 && _jsxs("section", { children: [_jsxs("div", { className: "st-blocktitle", children: [_jsx("h4", { children: "\u4EA4\u4ED8\u6587\u4EF6" }), _jsx("span", { className: "st-count", children: files.length })] }), files.map((file, index) => {
                                const visible = preview?.task === selected.id && preview.name === file ? preview : undefined;
                                const toggle = async () => {
                                    const request = ++previewRequest.current;
                                    if (visible) {
                                        setPreview(undefined);
                                        return;
                                    }
                                    try {
                                        const content = await read(api.preview(selected.id, index));
                                        if (request === previewRequest.current)
                                            setPreview({ task: selected.id, ...content });
                                    }
                                    catch (e) {
                                        if (request === previewRequest.current)
                                            fail(problem(e));
                                    }
                                };
                                return _jsxs("div", { className: "st-file", children: [_jsxs("button", { className: "st-file-toggle", onClick: toggle, "aria-expanded": !!visible, "aria-label": visible ? '关闭预览' : '预览产物', title: file, children: [_jsx(Icon, { name: "file", size: 16 }), _jsx("span", { children: fileName(file) }), _jsx("small", { children: visible ? '收起' : '预览' }), _jsx(Icon, { name: "chevron", size: 14 })] }), visible && _jsx(FilePreview, { file: visible, renderMarkdown: renderMarkdown })] }, index);
                            })] }), selected.origin && openOrigin && _jsx("section", { children: _jsx("button", { type: "button", onClick: () => openOrigin(selected.origin), children: "\u67E5\u770B\u539F\u6D88\u606F" }) }), !selected.review && !selected.result && _jsxs("section", { children: [_jsx("div", { className: "st-blocktitle", children: _jsx("h4", { children: "\u4EFB\u52A1\u76EE\u6807" }) }), _jsx("p", { children: selected.goal }), selected.checkpoint.remaining.length > 0 && _jsx(RecordList, { title: "\u5269\u4F59\u5DE5\u4F5C", items: selected.checkpoint.remaining })] }), qs.some(q => q.decision) && _jsxs("section", { children: [_jsxs("div", { className: "st-blocktitle", children: [_jsx(Icon, { name: "chat" }), _jsx("h4", { children: "\u5DF2\u7B54\u95EE\u9898" })] }), qs.filter(q => q.decision).map(q => _jsxs("div", { className: "st-question", children: [_jsx("strong", { children: q.question }), _jsxs("p", { children: [_jsx("span", { className: "st-answer", children: q.decision.answer }), q.decision.authority === 'user' ? '用户回答' : '协调会话回答'] }), !mode && selected.actions.includes('answer') && _jsx("button", { onClick: () => edit('answer', q.id), children: "\u66F4\u65B0\u51B3\u5B9A" })] }, q.id))] }), _jsxs("div", { className: "st-folds", children: [_jsxs("details", { children: [_jsx("summary", { children: "\u4EFB\u52A1\u8981\u6C42\u4E0E\u4F1A\u8BDD" }), _jsxs("div", { className: "st-foldbody", children: [_jsx("p", { children: selected.goal }), _jsx(RecordList, { title: "\u9A8C\u6536\u6761\u4EF6", items: selected.acceptance }), _jsx(RecordList, { title: "\u58F0\u660E\u8D44\u6E90", items: selected.resources }), _jsxs("div", { children: [_jsx("h4", { children: "\u5DE5\u4F5C\u76EE\u5F55" }), _jsx("p", { children: selected.assignee.cwd })] }), _jsx("div", { className: "st-actions", children: [selected.coordinator, selected.assignee].map((p, i) => _jsxs("button", { onClick: () => { try {
                                                        open(p.id);
                                                    }
                                                    catch (e) {
                                                        fail(problem(e));
                                                    } }, children: [i ? '执行' : '协调', " \u00B7 ", name(p.id).replace(/^协调\s*[·・]\s*/, ''), _jsx(Icon, { name: "external", size: 13 })] }, i)) })] })] }), _jsxs("details", { children: [_jsx("summary", { children: "\u6267\u884C\u4E0E\u9A8C\u6536\u8BB0\u5F55" }), _jsxs("div", { className: "st-foldbody", children: [selected.checkpoint.summary && _jsxs("div", { children: [_jsx("h4", { children: "\u6267\u884C\u8FDB\u5C55" }), _jsx("p", { children: selected.checkpoint.summary })] }), _jsx(RecordList, { title: "\u5DF2\u5B8C\u6210", items: selected.checkpoint.done }), _jsx(RecordList, { title: "\u5269\u4F59\u5DE5\u4F5C", items: selected.checkpoint.remaining }), selected.result && _jsxs(_Fragment, { children: [_jsxs("div", { children: [_jsxs("h4", { children: ["\u63D0\u4EA4\u7ED3\u679C \u00B7 ", when(selected.result.at)] }), _jsx("p", { children: selected.result.summary })] }), _jsx(RecordList, { title: "\u7ED3\u679C\u8BC1\u636E", items: selected.result.evidence })] }), selected.review && _jsxs(_Fragment, { children: [_jsxs("div", { children: [_jsxs("h4", { children: [selected.review.accepted ? '验收通过' : '退回补做', " \u00B7 ", when(selected.review.at)] }), _jsx("p", { children: selected.review.explanation }), selected.review.checked?.map((yes, i) => _jsxs("p", { children: [yes ? '已核对' : '待补做', "\uFF1A", selected.acceptance[i]] }, i))] }), _jsx(RecordList, { title: "\u6838\u9A8C\u8BC1\u636E", items: selected.review.evidence })] }), qs.filter(q => q.decision).map(q => _jsxs("div", { children: [_jsx("h4", { children: q.question }), _jsx("p", { children: [q.context, q.options.join(' / '), '影响 ' + q.taskIds.length + ' 项任务', '决定 v' + q.version].filter(Boolean).join(' · ') })] }, q.id))] })] }), _jsxs("details", { children: [_jsx("summary", { children: "\u7248\u672C\u4E0E\u6295\u9012" }), _jsxs("div", { className: "st-foldbody", children: [_jsxs("p", { children: ["\u5F53\u524D v", selected.revision, " \u00B7 \u5DF2\u91C7\u7528 v", selected.appliedRevision, " \u00B7 \u88C1\u51B3 v", selected.decisionRevision, " / \u5DF2\u91C7\u7528 v", selected.appliedDecisionRevision] }), selected.deliveries.map(e => _jsxs("p", { children: [e.kind, " \u00B7 ", e.status, " ", e.reason] }, e.id))] })] }), _jsxs("details", { children: [_jsx("summary", { children: "\u6700\u8FD1\u6D3B\u52A8" }), _jsx("ol", { children: selected.history.map((h, i) => _jsxs("li", { children: [when(h.at), " \u00B7 ", h.actor === 'operator:owner' ? '用户' : name(h.actor), " \u00B7 ", h.action, " \u00B7 ", h.detail] }, i)) })] })] })] }, selected.id)] }));
}
