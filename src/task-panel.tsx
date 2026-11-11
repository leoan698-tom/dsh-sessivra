import React, { useEffect, useRef, useState } from 'react';
import { css } from './task-panel-styles.js';
import { Icon, Pill, when } from './task-panel-visual.js';
import { fileName, taskFiles } from './task-files.js';
import { resultOverview } from './task-result-overview.js';
import type { RemoteResult } from '@deepseek-ai/dsh-typert-protocol';
import type { SessivraPanel } from './task-panel-service.js';
import type { PanelCommand, PanelQuery } from './panel-contract.js';
import type { MessageOrigin, ResolvedMessage } from './message-history.js';

type RemoteApi = {
  [K in 'participants' | 'detail' | 'list' | 'command' | 'operation' | 'preview']: (
    ...args: Parameters<SessivraPanel[K]>
  ) => Promise<RemoteResult<Awaited<ReturnType<SessivraPanel[K]>>>>;
};
export type TaskPanelApi = RemoteApi;
export type TaskHistoryApi = {
  [K in 'searchHistory' | 'locateMessage' | 'bookmarkedTurns' | 'bookmarkReference' | 'locateLegacyBookmark']: (
    ...args: Parameters<SessivraPanel[K]>
  ) => Promise<RemoteResult<Awaited<ReturnType<SessivraPanel[K]>>>>;
};
export const taskPanelTitle = '任务中心';
type Detail = Awaited<ReturnType<SessivraPanel['detail']>>;
type Person = Awaited<ReturnType<SessivraPanel['participants']>>[number];
type Page = ReturnType<SessivraPanel['list']>;
const actions: Record<string, string> = {
  update: '修改要求',
  answer: '回答问题',
  review: '验收结果',
  resume: '继续任务',
  pause: '暂停',
  cancel: '取消任务',
  reconcile: '检查投递',
  archive: '归档',
};
const statusNames: Record<string, string> = {
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
const problem = (e: unknown) => {
  const msg = e instanceof Error ? e.message : String(e);
  if (/CONFLICT|READ_LATEST/.test(msg)) return '记录已更新。请核对最新内容后重新提交。';
  if (/SUPERAGENT_OWNS_SESSION/.test(msg)) return '该会话由 Superagent 管理，请选择其他会话。';
  if (/PERMISSION|ACCESS_DENIED|POLICY_BLOCKED/.test(msg)) return '会话许可或工作目录已变化，请打开原会话检查。';
  return msg;
};
const readableReason = (reason: string) =>
  ({
    TURN_ENDED_WITHOUT_TASK_RESULT: '本轮结束，执行会话尚未提交结果',
    RECOVERED_TASK_REQUIRES_RESUME: '宿主已重开，请核查检查点后继续',
    DIRECT_USER_INPUT_REQUIRES_TASK_RECONCILIATION: '用户在执行会话补充了要求，等待核对',
    WAITING_FOR_REQUIRED_DECISION: '等待前置问题的回答',
    TASK_PERMISSION_REVOKED: '会话许可已改变',
    TASK_DISPATCH_UNCERTAIN: '等待回查投递',
    DECISION_CHANGED_AFTER_ACCEPTANCE: '验收后决定已改变，请复核影响',
  })[reason] ?? reason;
async function read<T>(p: Promise<RemoteResult<T>>) {
  const r = await p;
  if (!r.ok) throw new Error(r.error.message);
  return r.value;
}
const lines = (form: FormData, key: string) =>
  String(form.get(key) ?? '')
    .split(/\r?\n/)
    .map((s) => s.trim())
    .filter(Boolean);
const str = (form: FormData, key: string) => String(form.get(key) ?? '').trim();
function Notes({
  label,
  name,
  value = '',
  required = false,
}: {
  label: string;
  name: string;
  value?: string;
  required?: boolean;
}) {
  return (
    <label>
      {label}
      <textarea name={name} defaultValue={value} required={required} rows={2} />
    </label>
  );
}
function RecordList({ title, items }: { title: string; items: string[] }) {
  return items.length ? (
    <section>
      <h4>{title}</h4>
      <ul>
        {items.map((item, i) => (
          <li key={i}>{item}</li>
        ))}
      </ul>
    </section>
  ) : null;
}
function ResultHeader({ task, name }: { task: Detail; name: (id: string) => string }) {
  const result = task.result && resultOverview(task.result);
  const review = task.review;
  let status = '尚未提交验收';
  let at: number | undefined;
  if (task.status === 'review') {
    status = '待验收';
    at = task.result?.at;
  } else if (task.status === 'completed' && review?.accepted) {
    status = task.reason === 'DECISION_CHANGED_AFTER_ACCEPTANCE' ? '决定已更新，需复核'
      : review.by === 'operator:owner' ? '用户已验收' : name(review.by) + ' 已验收';
    at = review.at;
  } else if (task.status === 'cancelled' || task.status === 'failed') {
    status = '未验收';
  } else if (review && !review.accepted) {
    status = '已退回补做';
    at = review.at;
  }
  return <section className="st-outcome" aria-label="结果与验收">
    {result && <div>
      <h4>任务结果</h4>
      {result.highlights.length > 0 && <p className="st-figures">{result.highlights.join(' · ')}</p>}
      <p>{result.text}</p>
    </div>}
    <div className="st-review-state"><span>当前验收状态</span><strong>{status}</strong>{at !== undefined && <small>{when(at)}</small>}</div>
  </section>;
}

function FilePreview({ file, renderMarkdown }: {
  file: { name: string; text: string; truncated: boolean };
  renderMarkdown: (text: string) => React.ReactNode;
}) {
  const [source, setSource] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const markdown = /\.(md|markdown)$/i.test(file.name);
  return <div className="st-preview">
    <div className="st-readtools">
      {markdown && <button onClick={() => setSource(!source)} aria-pressed={source}>{source ? '返回预览' : '查看原文'}</button>}
      <button onClick={() => setExpanded(!expanded)} aria-expanded={expanded}>{expanded ? '收起全文' : '展开阅读'}</button>
    </div>
    <div className="st-readbody" data-expanded={expanded}>
      {markdown && !source ? renderMarkdown(file.text) : <pre>{file.text}</pre>}
    </div>
    {file.truncated && <p>预览显示前 32 KiB，完整文件请在执行目录查看。</p>}
  </div>;
}

export function TaskPanel({
  api,
  open,
  renderMarkdown,
  initialSession,
  initialTask,
  source: initialSource,
  openOrigin,
}: {
  api: RemoteApi;
  open: (id: string) => void;
  renderMarkdown: (text: string) => React.ReactNode;
  initialSession?: string;
  initialTask?: string;
  source?: ResolvedMessage;
  openOrigin?: (origin: MessageOrigin) => void;
}) {
  const [query, setQuery] = useState<PanelQuery>({ view: 'attention' }),
    [page, setPage] = useState<Page>(),
    [sessions, setSessions] = useState<Person[]>([]);
  const [source, setSource] = useState(initialSource);
  const [id, select] = useState(initialTask ?? ''),
    [item, detail] = useState<Detail>(),
    [mode, setMode] = useState(source ? 'create' : ''),
    [question, setQuestion] = useState('');
  const [owner, setOwner] = useState(initialSession ?? ''),
    [executor, setExecutor] = useState(''),
    [tick, reload] = useState(0);
  const [filtersOpen, showFilters] = useState(false);
  const panel = useRef<HTMLElement>(null);
  const autoPick = useRef(false);
  const pendingKey = 'sessivra-task-panel/pending-operation';
  const [pending, setPending] = useState(() => {
    try {
      return sessionStorage.getItem(pendingKey) ?? '';
    } catch {
      return '';
    }
  });
  function rememberPending(value: string) {
    setPending(value);
    try {
      if (value) sessionStorage.setItem(pendingKey, value);
      else sessionStorage.removeItem(pendingKey);
    } catch {
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
      } else fail('尚未查到成功记录。检查原任务后，可使用同一请求重试。');
    } catch (e) {
      fail(problem(e));
    }
  }
  const [error, fail] = useState(''),
    [busy, setBusy] = useState(false),
    [checkedToken, setChecked] = useState('');
  const base = useRef<Detail>(),
    operation = useRef<{ body: string; id: string }>(),
    inFlight = useRef(false);
  const selected = item?.id === id ? item : undefined;
  const [preview, setPreview] = useState<{ task: string; name: string; text: string; truncated: boolean }>();
  const previewRequest = useRef(0);
  const name = (key: string) => sessions.find((s) => s.id === key)?.label ?? key;
  useEffect(() => {
    let active = true;
    read(api.participants())
      .then((rows) => {
        if (active) {
          setSessions(rows);
          setOwner((current) =>
            rows.some((s) => s.id === current && !s.child) ? current : (rows.find((s) => !s.child && (!source || s.workspace === source.cwd))?.id ?? 'new'),
          );
        }
      })
      .catch((e) => active && fail(problem(e)));
    return () => {
      active = false;
    };
  }, [api, initialSession, source]);
  useEffect(() => {
    let active = true;
    let timer: ReturnType<typeof setTimeout>;
    const refresh = async () => {
      try {
        const [p, d] = await Promise.all([
          read(api.list(JSON.parse(JSON.stringify(query)))),
          id ? read(api.detail(id)) : undefined,
        ]);
        if (active) {
          setPage(p);
          detail(d);
          if (autoPick.current && !id && !mode && p.items.length && (panel.current?.clientWidth ?? 0) > 730) select(p.items[0].id);
          autoPick.current = false;
        }
      } catch (e) {
        if (active) fail(problem(e));
      } finally {
        if (active) timer = setTimeout(() => void refresh(), 5000);
      }
    };
    void refresh();
    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [query, id, tick, api]);
  function choose(next: string) {
    previewRequest.current++;
    setPreview(undefined);
    select(next);
    setMode('');
    fail('');
  }
  function edit(action: string, qid = '') {
    base.current = selected;
    operation.current = undefined;
    setChecked('');
    setMode(action);
    setQuestion(qid);
    fail('');
  }
  function filter<K extends keyof PanelQuery>(key: K, value: PanelQuery[K]) {
    setQuery((q) => ({ ...q, [key]: value || undefined, cursor: undefined }));
    choose('');
    autoPick.current = key === 'view' && value === 'history';
  }
  const stale = !!(mode && mode !== 'create' && selected && base.current?.token !== selected.token);
  const checkedVersion = !!selected && checkedToken === selected.token;
  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (inFlight.current) return;
    const f = new FormData(e.currentTarget),
      original = base.current;
    let body: Omit<PanelCommand, 'operationId'> | Record<string, unknown>;
    if (mode === 'create') {
      const prerequisite = str(f, 'prerequisite'),
        group = str(f, 'group');
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
    } else {
      if (!original || !selected) return;
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
        const accepted = str(f, 'outcome') === 'accepted',
          evidence = lines(f, 'evidence'),
          remaining = lines(f, 'remaining');
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
      } else if (mode === 'archive' || mode === 'reconcile') body = { ...stamp, action: mode };
      else body = { ...stamp, action: mode, reason: str(f, 'reason') };
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
      } catch {
        /* optional browser store */
      }
      if (operation.current?.body !== key)
        operation.current = { body: key, id: stored === digest && pending ? pending : crypto.randomUUID() };
      rememberPending(operation.current.id);
      try {
        sessionStorage.setItem(pendingKey + '/digest', digest);
      } catch {
        /* runtime identity remains available */
      }
      const result = await read(api.command({ ...JSON.parse(key), operationId: operation.current.id }));
      rememberPending('');
      setSource(undefined);
      setMode('');
      select(result.id);
      if (mode === 'create') setSessions(await read(api.participants()));
      if (mode === 'archive') setQuery({ view: 'history' });
      reload((n) => n + 1);
    } catch (e) {
      fail(problem(e));
      reload((n) => n + 1);
    } finally {
      inFlight.current = false;
      setBusy(false);
    }
  }
  const coordinator = sessions.find((s) => s.id === owner && !s.child);
  const assignee = sessions.find((s) => s.id === executor);
  const assigneeHasTasks = assignee && page?.items.some(
    (t) => t.assignee === assignee.id && !['completed', 'cancelled', 'failed'].includes(t.status),
  );
  const files = selected ? taskFiles(selected) : [];
  const qs = selected?.questions.filter(q => !q.mergedInto) ?? [];
  const chips = (['workspace','status','coordinator','assignee','scope'] as const).filter(k=>query[k]);
  const clearFilters=()=>{ setQuery({view:query.view}); choose(''); };
  const labelFor = (k: typeof chips[number]) => { const v=query[k] ?? ''; return k==='workspace'?fileName(v):k==='status'?(statusNames[v]??v):k==='scope'?(page?.groups.find(g=>g.id===v)?.label??'协作组'):name(v); };
  const actionForm = (
    <form onSubmit={submit} key={mode + question} aria-label={actions[mode] ?? '新建任务'}>
      <h3>{actions[mode] ?? '新建任务'}</h3>
      {mode === 'create' && source && <p className="st-question">来源 · {source.title}</p>}
      {(mode === 'create' || mode === 'update') && (
        <>
          <label>
            标题
            <input
              required
              name="title"
              maxLength={160}
              defaultValue={mode === 'update' ? base.current?.title : source?.excerpt.trim().split(/\r?\n/, 1)[0]?.slice(0, 120)}
            />
          </label>
          <Notes label="目标" name="goal" required value={mode === 'update' ? base.current?.goal : source?.excerpt} />
          <Notes
            label="验收条件（每行一项）"
            name="acceptance"
            required
            value={mode === 'update' ? base.current?.acceptance.join('\n') : ''}
          />
        </>
      )}
      {mode === 'create' && (
        <>
          <label>
            协调会话
            <select
              required
              value={owner}
              onChange={(e) => {
                setOwner(e.target.value);
                setExecutor('');
              }}
            >
              <option value="">选择会话</option>
              <option value="new">新建协调会话</option>
              {sessions
                .filter((s) => !s.child)
                .map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.label} · {s.workspace}
                  </option>
                ))}
            </select>
          </label>
          {owner === 'new' && (
            <label>
              协调会话工作目录
              <input name="coordinatorDirectory" required defaultValue={source?.cwd ?? query.workspace ?? sessions.find(s=>s.id===initialSession)?.workspace ?? ''} />
            </label>
          )}
          <label>
            执行会话
            <select value={executor} onChange={(e) => setExecutor(e.target.value)}>
              <option value="">新建普通子会话</option>
              {sessions
                .filter((s) => s.id !== owner && (!s.child || s.parent === owner))
                .map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.label} · {s.workspace}
                  </option>
                ))}
            </select>
          </label>
        </>
      )}
      {mode === 'create' && (
        <details>
          <summary>协作组、资源与前置问题</summary>
          <label>
            协作组
            <select name="group">
              <option value="">新建独立组</option>
              {page?.groups
                .filter((g) => g.coordinator === owner)
                .map((g) => (
                  <option key={g.id} value={g.id}>
                    {g.label}
                  </option>
                ))}
            </select>
          </label>
          <label>
            新组名称
            <input name="groupLabel" />
          </label>
          <Notes label="声明资源（每行一个路径）" name="resources" />
          {!executor && (
            <>
              <label>
                子会话目录
                <input name="cwd" placeholder={sessions.find((s) => s.id === owner)?.workspace ?? ''} />
              </label>
              <label>
                推理级别
                <input name="effort" />
              </label>
            </>
          )}
          <Notes label="开始前需要回答的问题" name="prerequisite" />
          <label>
            问题主题
            <input name="topic" />
          </label>
          <label>
            适用条件
            <input name="context" />
          </label>
          <Notes label="可选答案（每行一项）" name="options" />
        </details>
      )}
      {mode === 'answer' && (
        <>
          <p>{selected?.questions.find((q) => q.id === question)?.question}</p>
          <label>
            答复
            <input name="answer" required list="sessivra-answer-options" />
          </label>
          <datalist id="sessivra-answer-options">
            {selected?.questions
              .find((q) => q.id === question)
              ?.options.map((o) => (
                <option key={o} value={o} />
              ))}
          </datalist>
        </>
      )}
      {mode === 'review' && (
        <>
          <fieldset key={selected?.token}>
            <legend>逐项核验</legend>
            {selected?.acceptance.map((rule, i) => (
              <label key={i} style={{ display: 'flex', alignItems: 'center' }}>
                <input type="checkbox" name={'criterion-' + i} />
                {rule}
              </label>
            ))}
          </fieldset>
          <label>
            验收结论
            <select name="outcome">
              <option value="accepted">通过</option>
              <option value="rework">退回补做</option>
            </select>
          </label>
          <Notes name="evidence" label="核验的产物与证据（每行一项）" required />
          <Notes name="remaining" label="退回后需完成的事项" />
        </>
      )}
      {['update', 'review', 'pause', 'resume', 'cancel'].includes(mode) && (
        <Notes label="说明" name="reason" required />
      )}
      {mode === 'cancel' && <p>当前工具结束后取消。后续排队任务可能开始，已产生的外部操作会保留。</p>}
      {mode === 'archive' && <p>归档后在历史中查看任务、决定和证据。</p>}
      {mode === 'reconcile' && <p>检查原会话的收件箱和历史。如果会话尚未打开，请先打开执行会话。</p>}
      {stale && (
        <label>
          <input
            type="checkbox"
            checked={checkedVersion}
            onChange={(e) => setChecked(e.target.checked ? selected!.token : '')}
          />
          我已核对下方最新要求与结果，使用当前版本
        </label>
      )}
      {mode === 'create' && (
        <p>
          {coordinator || owner === 'new' ? (
            <>
              {coordinator ? <>「{coordinator.label}」负责协调。</> : '将新建会话负责协调。'}
              {assignee ? <>「{assignee.label}」负责执行。</> : '将新建子会话执行任务。'}
              {assigneeHasTasks && '执行会话有其他待处理任务，本任务可能需要排队。'}
              如有前置问题，请先答复。执行会话和所需资源可用后，系统会安排任务。
            </>
          ) : '请选择负责协调的会话。'}
        </p>
      )}
      <div className="st-actions">
        <button type="submit" disabled={busy || (stale && !checkedVersion)}>
          {busy ? '提交中…' : mode === 'create' ? '创建并安排' : '确认' + actions[mode]}
        </button>
        <button type="button" disabled={busy} onClick={() => { setSource(undefined); setMode(''); }}>
          返回
        </button>
      </div>
    </form>
  );
  const showDetail = !!selected && mode !== 'create';
  const feedback = <>
    {error && <p role="alert">{error}</p>}
    {pending && !busy && <button onClick={() => void checkPending()}>回查上次提交</button>}
  </>;
  return (
    <main className="sessivra-tasks" ref={panel} data-detail={showDetail || undefined}>
      <style>{css}</style>
      <div className="st-master"><div className="st-shell">
      <header className="st-head">
        <h2>{taskPanelTitle}</h2>
        {mode !== 'create' && <button className="st-primary" onClick={() => edit('create')}><Icon name="plus" size={14}/>新建任务</button>}
      </header>
      {!showDetail && feedback}
      {mode === 'create' ? <div className="st-formpage">{actionForm}</div> : <>
      <nav aria-label="任务视图">{(['attention','all','history'] as const).map((v,i)=>
        <button key={v} aria-pressed={query.view===v} onClick={()=>filter('view',v)}>{['待处理','全部任务','历史'][i]}</button>)}</nav>
      <div className="st-bar"><label className="st-search"><Icon name="search"/><input type="search" aria-label="搜索任务" placeholder="搜索任务" value={query.search??''} onChange={e=>filter('search',e.target.value)}/></label><button aria-expanded={filtersOpen} onClick={()=>showFilters(!filtersOpen)}><Icon name="filter"/>筛选{chips.length>0 && <span className="st-count">{chips.length}</span>}</button></div>
      {filtersOpen && <div className="st-filters">
        <label>工作目录<select
          aria-label="工作目录"
          value={query.workspace ?? ''}
          onChange={(e) => filter('workspace', e.target.value)}
        >
          <option value="">全部工作目录</option>
          {Array.from(new Set([...(page?.workspaces ?? []), ...(query.workspace ? [query.workspace] : [])])).map(
            (s) => (
              <option key={s}>{s}</option>
            ),
          )}
        </select></label>
        <label>状态<select aria-label="状态" value={query.status ?? ''} onChange={(e) => filter('status', e.target.value)}>
          <option value="">所有状态</option>
          {Object.entries(statusNames).map(([k, v]) => (
            <option key={k} value={k}>
              {v}
            </option>
          ))}
        </select></label>
        {query.view === 'all' && (
          <label>排序<select
            aria-label="排序"
            value={query.sort ?? 'attention'}
            onChange={(e) => filter('sort', e.target.value as PanelQuery['sort'])}
          >
            <option value="attention">需处理优先</option>
            <option value="recent">最近更新优先</option>
          </select></label>
        )}
        {(['coordinator', 'assignee'] as const).map((k) => (
          <label key={k}>{k === 'coordinator' ? '协调会话' : '执行会话'}<select
            aria-label={k === 'coordinator' ? '协调会话筛选' : '执行会话筛选'}
            value={query[k] ?? ''}
            onChange={(e) => filter(k, e.target.value)}
          >
            <option value="">{k === 'coordinator' ? '所有协调会话' : '所有执行会话'}</option>
            {sessions.map((s) => (
              <option key={s.id} value={s.id}>
                {s.label}
              </option>
            ))}
          </select></label>
        ))}
        <label>协作组<select
          aria-label="协作组筛选"
          value={query.scope ?? ''}
          onChange={(e) => filter('scope', e.target.value)}
        >
          <option value="">全部协作组</option>
          {page?.groups.map((g) => (
            <option key={g.id} value={g.id}>
              {g.label}
            </option>
          ))}
        </select></label>

      </div>}
      {chips.length>0 && <div className="st-chipbar">{chips.map(k=><button key={k} title={'移除筛选：'+query[k]} onClick={()=>filter(k,undefined)}>{labelFor(k)}<Icon name="close" size={13}/></button>)}</div>}
      <aside className="st-items">
        <div className="st-listhead"><span>{query.view==='history'?'归档任务':query.view==='all'?'任务列表':'需要你处理'}</span><span className="st-count">{page?(query.view==='attention'?page.attention.length:page.total):'…'}</span></div>
        {!page ? <p className="st-empty" role="status">读取中…</p> : <>
        {query.view==='attention' ? ['待回答','待验收','受阻','投递不确定','待同步'].map(kind=>{
           const group=page.attention.filter(a=>a.kind===kind);
           return group.length>0 && <section key={kind}><div className="st-groupname">{kind} · {group.length}</div>{group.map(a=><button className="st-row" key={a.key} aria-pressed={id===a.taskId} onClick={()=>choose(a.taskId)}><strong>{a.title}</strong><small>{a.affected.length>1?'影响 '+a.affected.length+' 项任务':kind}<Icon name="chevron" size={14}/></small></button>)}</section>;
        }):page.items.map(t=><button className="st-row" key={t.id} aria-pressed={id===t.id} onClick={()=>choose(t.id)}><strong>{t.title}</strong><small><Pill label={t.label} status={t.status}/><time title={when(t.updatedAt)}>{when(t.updatedAt,true)}</time></small>{typeof t.wait==='string'&&<small>{readableReason(t.wait)}</small>}</button>)}
        {(query.view==='attention'?!page.attention.length:!page.items.length) && <div className="st-empty"><span className="st-emptyicon"><Icon name={query.view==='attention'?'inbox':query.view==='history'?'archive':'list'} size={24}/></span><h4>{chips.length||query.search?'没有符合条件的任务。':query.view==='attention'?'当前没有需要处理的事项。':query.view==='history'?'还没有归档任务':'还没有任务'}</h4><p>{chips.length||query.search?'换个关键词，或清除筛选再查看。':query.view==='attention'?'共同问题、待验收结果和受阻任务会出现在这里。':query.view==='history'?'任务归档后，可以在这里回看决定和交付文件。':'创建任务后，可以在这里跟进执行和验收。'}</p>{chips.length||query.search?<button onClick={clearFilters}>清除筛选</button>:query.view==='attention'?<button onClick={()=>filter('view','all')}>查看全部任务</button>:query.view==='all'?<button onClick={()=>edit('create')}>创建第一项任务</button>:null}</div>}
        {(query.cursor||page.next)&&<div className="st-listfoot">{query.cursor && <button onClick={()=>setQuery(q=>({...q,cursor:undefined}))}>首页</button>}{page.next && <button onClick={()=>setQuery(q=>({...q,cursor:page.next!}))}>下一页</button>}</div>}
        </>}
      </aside></>}
      </div></div>

      {showDetail && selected && <article className="st-detail" key={selected.id}>
        <header>
          <div className="st-detailtop">
            <h3>{selected.title}</h3>
            <button aria-label="返回列表" title="返回列表" onClick={() => choose('')}><Icon name="close" size={16}/></button>
          </div>
          <div className="st-meta">
            <Pill status={selected.status} label={statusNames[selected.status]}/>
            <span>{'archivedAt' in selected ? '归档于 ' + when(selected.archivedAt) : '更新于 ' + when(selected.updatedAt)}</span>
          </div>
          {selected.scopeLabel && <div className="st-meta"><Icon name="group" size={14}/>{selected.scopeLabel}</div>}
        </header>
        <ResultHeader task={selected} name={name}/>
        {feedback}
        {!!(selected.queueReason||selected.reason) && selected.runtime!=='历史' && <p>{readableReason(selected.queueReason||selected.reason||'')}</p>}
        {mode && <div>{actionForm}</div>}
        {!mode && selected.actions.some(a=>a!=='answer') && <div className="st-actions">{['review','resume','reconcile','archive','update','pause','cancel'].filter(a=>selected.actions.includes(a)).map(a=><button className={['review','resume','reconcile','archive'].includes(a)?'st-primary':undefined} key={a} onClick={()=>edit(a)}>{actions[a]}</button>)}</div>}
        {qs.some(q=>!q.decision) && <section><div className="st-blocktitle"><Icon name="chat"/><h4>需要回答</h4></div>{qs.filter(q=>!q.decision).map(q=><div className="st-question" key={q.id}><strong>{q.question}</strong>{q.context && <p>{q.context}</p>}<p>{q.options.join(' / ')}{q.taskIds.length>1 && ' · 影响 '+q.taskIds.length+' 项任务'}</p>{!mode && selected.actions.includes('answer') && <button className="st-primary" onClick={()=>edit('answer',q.id)}>回答问题</button>}</div>)}</section>}
        {files.length > 0 && <section>
          <div className="st-blocktitle"><h4>交付文件</h4><span className="st-count">{files.length}</span></div>
          {files.map((file, index) => {
            const visible = preview?.task === selected.id && preview.name === file ? preview : undefined;
            const toggle = async () => {
              const request = ++previewRequest.current;
              if (visible) { setPreview(undefined); return; }
              try {
                const content = await read(api.preview(selected.id, index));
                if (request === previewRequest.current) setPreview({ task: selected.id, ...content });
              } catch (e) { if (request === previewRequest.current) fail(problem(e)); }
            };
            return <div className="st-file" key={index}>
              <button className="st-file-toggle" onClick={toggle} aria-expanded={!!visible}
                aria-label={visible ? '关闭预览' : '预览产物'} title={file}>
                <Icon name="file" size={16}/><span>{fileName(file)}</span>
                <small>{visible ? '收起' : '预览'}</small><Icon name="chevron" size={14}/>
              </button>
              {visible && <FilePreview file={visible} renderMarkdown={renderMarkdown}/>}
            </div>;
          })}
        </section>}
        {selected.origin && openOrigin && <section><button type="button" onClick={() => openOrigin(selected.origin!)}>查看原消息</button></section>}
        {!selected.review && !selected.result && <section><div className="st-blocktitle"><h4>任务目标</h4></div><p>{selected.goal}</p>{selected.checkpoint.remaining.length>0 && <RecordList title="剩余工作" items={selected.checkpoint.remaining}/>}</section>}
        {qs.some(q=>q.decision) && <section><div className="st-blocktitle"><Icon name="chat"/><h4>已答问题</h4></div>{qs.filter(q=>q.decision).map(q=><div className="st-question" key={q.id}><strong>{q.question}</strong><p><span className="st-answer">{q.decision!.answer}</span>{q.decision!.authority==='user'?'用户回答':'协调会话回答'}</p>{!mode && selected.actions.includes('answer') && <button onClick={()=>edit('answer',q.id)}>更新决定</button>}</div>)}</section>}
        <div className="st-folds">
        <details><summary>任务要求与会话</summary><div className="st-foldbody"><p>{selected.goal}</p><RecordList title="验收条件" items={selected.acceptance}/><RecordList title="声明资源" items={selected.resources}/><div><h4>工作目录</h4><p>{selected.assignee.cwd}</p></div>
        <div className="st-actions">{[selected.coordinator,selected.assignee].map((p,i)=><button key={i} onClick={()=>{try{open(p.id);}catch(e){fail(problem(e));}}}>{i?'执行':'协调'} · {name(p.id).replace(/^协调\s*[·・]\s*/,'')}<Icon name="external" size={13}/></button>)}</div></div></details>
        <details><summary>执行与验收记录</summary><div className="st-foldbody">
        {selected.checkpoint.summary && <div><h4>执行进展</h4><p>{selected.checkpoint.summary}</p></div>}
        <RecordList title="已完成" items={selected.checkpoint.done}/><RecordList title="剩余工作" items={selected.checkpoint.remaining}/>
        {selected.result && <><div><h4>提交结果 · {when(selected.result.at)}</h4><p>{selected.result.summary}</p></div><RecordList title="结果证据" items={selected.result.evidence}/></>}
        {selected.review && <><div><h4>{selected.review.accepted ? '验收通过' : '退回补做'} · {when(selected.review.at)}</h4><p>{selected.review.explanation}</p>
        {selected.review.checked?.map((yes,i)=><p key={i}>{yes?'已核对':'待补做'}：{selected.acceptance[i]}</p>)}</div><RecordList title="核验证据" items={selected.review.evidence}/></>}
        {qs.filter(q=>q.decision).map(q=><div key={q.id}><h4>{q.question}</h4><p>{[q.context,q.options.join(' / '),'影响 '+q.taskIds.length+' 项任务','决定 v'+q.version].filter(Boolean).join(' · ')}</p></div>)}</div></details>
        <details><summary>版本与投递</summary><div className="st-foldbody"><p>当前 v{selected.revision} · 已采用 v{selected.appliedRevision} · 裁决 v{selected.decisionRevision} / 已采用 v{selected.appliedDecisionRevision}</p>{selected.deliveries.map(e=><p key={e.id}>{e.kind} · {e.status} {e.reason}</p>)}</div></details>
        <details><summary>最近活动</summary><ol>{selected.history.map((h,i)=><li key={i}>{when(h.at)} · {h.actor==='operator:owner'?'用户':name(h.actor)} · {h.action} · {h.detail}</li>)}</ol></details></div>
      </article>}
    </main>
  );
}
