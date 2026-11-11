import React from 'react';
import {
  Button, Checkbox, IconChevronRightOutlineRegular, IconDownloadOutlineRegular, IconFolderCloseRegular,
  IconRefreshOutlineRegular, IconSearchOutlineRegular, Input, SegmentedTabs, Switch,
} from '@deepseek-ai/dsh-client-ui-primitives';
import type { RemoteResult } from '@deepseek-ai/dsh-typert-protocol';
import type { ImportApi, ImportBatch, ImportCandidate, ImportedFile, ImportJob, ImportPreview, ImportSource, ImportUnavailable } from './import-contract.js';
import { importPanelStyles } from './import-panel-styles.js';

const maxSelection = 20;
const globalMemoryLabel = '同时导入全局记忆';
const sourceTabs = [
  { value: 'codex', label: 'Codex', id: 'sessivra-import-codex', panelId: 'sessivra-import-codex-panel' },
  { value: 'claude', label: 'Claude Code', id: 'sessivra-import-claude', panelId: 'sessivra-import-claude-panel' },
] as const;

export function createImportCatalogState() {
  return {
    source: 'codex' as ImportSource,
    folders: {} as Partial<Record<ImportSource, string>>,
    pages: new Map<string, { page?: ImportPreview; updated: number; pending?: Promise<ImportPreview> }>(),
    jobs: new Map<string, { id: string; selected: string[] }>(),
  };
}

interface CatalogNode {
  row: ImportCandidate | ImportUnavailable;
  children: CatalogNode[];
  placeholder?: boolean;
}

function groupSessions(rows: ImportCandidate[], unavailable: ImportUnavailable[], search: string) {
  const projects = new Map<string, { name: string; rows: CatalogNode[] }>();
  const standalone: CatalogNode[] = [];
  const nodes = new Map<string, CatalogNode>();
  for (const row of [...unavailable, ...rows]) nodes.set(row.sourceId, { row, children: [] });
  for (const node of nodes.values()) {
    const { parent, project } = node.row;
    if (parent && !nodes.has(parent.sourceId)) nodes.set(parent.sourceId, {
      row: { ...parent, updated: 0, ...(project ? { project } : {}) }, children: [], placeholder: true,
    });
  }
  const filter = search.trim().toLocaleLowerCase();
  const roots: CatalogNode[] = [];
  for (const node of nodes.values()) {
    const parent = node.row.parent && nodes.get(node.row.parent.sourceId);
    const visited = new Set([node.row.sourceId]);
    let cursor = parent;
    while (cursor && !visited.has(cursor.row.sourceId)) {
      visited.add(cursor.row.sourceId);
      cursor = cursor.row.parent && nodes.get(cursor.row.parent.sourceId);
    }
    if (parent && !cursor) parent.children.push(node);
    else roots.push(node);
  }
  const matches = (node: CatalogNode, inherited = false): CatalogNode | undefined => {
    const { row } = node;
    const title = 'displayTitle' in row ? row.displayTitle ?? row.title : row.title;
    const own = inherited || !filter || `${row.project?.name ?? ''} ${title} ${row.title}`.toLocaleLowerCase().includes(filter);
    const children = node.children.map(child => matches(child, own)).filter(child => child !== undefined);
    return own || children.length ? { ...node, children } : undefined;
  };
  for (const root of roots) {
    const node = matches(root);
    if (!node) continue;
    const { row } = node;
    if (!row.project) {
      standalone.push(node);
      continue;
    }
    const { key, name } = row.project;
    let group = projects.get(key);
    if (!group) projects.set(key, group = { name, rows: [] });
    group.rows.push(node);
  }
  return { projects, standalone };
}

function result<T>(response: RemoteResult<T>) {
  if (!response.ok) throw new Error(response.error.message);
  return response.value;
}

async function download(api: ImportApi, id: string, file: ImportedFile) {
  const chunks: Uint8Array<ArrayBuffer>[] = [];
  for (let index = 0; index < file.chunks; index++) {
    const base64 = result(await api.chunk(id, file.offset + index));
    chunks.push(Uint8Array.from(atob(base64), char => char.charCodeAt(0)));
  }
  const blob = new Blob(chunks, { type: 'application/octet-stream' });
  if (blob.size !== file.size) throw new Error('归档文件长度不符，下载已取消。');
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = file.name;
  anchor.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 30_000);
}

export function ImportPanel({ api, open, archiveId, back, catalog, pickDirectory }: {
  api: ImportApi; open(id: string): Promise<void>; archiveId?: string; back(): void;
  catalog: ReturnType<typeof createImportCatalogState>; pickDirectory?(): Promise<string | null>;
}) {
  const [source, setSource] = React.useState(catalog.source);
  const [folder, setFolder] = React.useState(catalog.folders[source]);
  const cacheKey = JSON.stringify([source, folder]);
  const [search, setSearch] = React.useState('');
  const [preview, setPreview] = React.useState(() => archiveId ? undefined : catalog.pages.get(cacheKey)?.page);
  const [selected, setSelected] = React.useState<string[]>([]);
  const [expanded, setExpanded] = React.useState<Record<string, boolean>>({});
  const [globalMemory, setGlobalMemory] = React.useState(false);
  const [report, setReport] = React.useState<ImportBatch>();
  const [job, setJob] = React.useState<ImportJob>();
  const [loadNotice, setLoadNotice] = React.useState('');
  const [archive, setArchive] = React.useState<ImportedFile[]>();
  const [loading, setLoading] = React.useState(!preview);
  const [busy, setBusy] = React.useState('');
  const [error, setError] = React.useState('');
  const [revision, refresh] = React.useReducer(value => value + 1, 0);
  const scroll = React.useRef<HTMLDivElement>(null);
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
          if (current) setArchive(files);
        } else {
          let cached = catalog.pages.get(cacheKey);
          if (!cached) {
            if (catalog.pages.size >= 4) catalog.pages.delete(catalog.pages.keys().next().value!);
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
          if (current) setPreview(page);
        }
      } catch (failure) {
        if (current) setError(failure instanceof Error ? failure.message : String(failure));
      } finally {
        if (current) setLoading(false);
      }
    };
    void load();
    return () => { current = false; };
  }, [api, archiveId, cacheKey, catalog, folder, source, revision]);

  const perform = async (label: string, action: () => Promise<void>) => {
    setBusy(label);
    setError('');
    try { await action(); }
    catch (failure) { setError(failure instanceof Error ? failure.message : String(failure)); }
    finally { setBusy(''); }
  };
  const resetList = (page?: ImportPreview) => {
    setPreview(page);
    setSelected([]);
    setExpanded({});
    setReport(undefined);
    setLoadNotice('');
    setLoading(!page);
    setError('');
  };
  const changeFolder = (path: string | undefined) => {
    if (path === folder) return;
    catalog.folders[source] = path;
    setFolder(path);
    setSearch('');
    resetList(catalog.pages.get(JSON.stringify([source, path]))?.page);
  };
  const loadMore = () => {
    if (preview?.nextOffset === undefined) return;
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
  const fileList = (id: string, files: ImportedFile[]) => <ul className="import-files">
    {files.map((file, index) => <li key={index}>
      <Button size="sm" variant="ghost" disabled={!!busy}
        onClick={() => void perform('正在下载…', () => download(api, id, file))}>{file.name}</Button>
      <small className="muted">{file.size.toLocaleString()} 字节</small>
    </li>)}
  </ul>;

  const { projects, standalone } = groupSessions(preview?.rows ?? [], preview?.unavailable ?? [], search);
  const sourceTab = sourceTabs.find(item => item.value === source)!;
  const date = (updated: number) => updated > 0 ? new Date(updated).toLocaleDateString() : '';
  const sessionRow = ({ row, children, placeholder }: CatalogNode): React.ReactElement => {
    const available = 'key' in row;
    const child = !!row.parent;
    const title = available ? row.displayTitle ?? row.title : row.title;
    const open = expanded[row.sourceId] ?? !!search.trim();
    const checked = available && selected.includes(row.key);
    return <li key={row.sourceId}>
      <div className="import-session" data-selected={checked}>
        <div className="import-session-label">
          {available && !child ? <Checkbox label={title} checked={checked}
            disabled={!!busy || (!checked && selected.length >= maxSelection)}
            onChange={value => setSelected(current => value ? [...current, row.key] : current.filter(key => key !== row.key))}/>
            : <span>{title}</span>}
          {!!children.length && <Button size="sm" variant="ghost" className="import-branch-toggle"
            aria-label={`${open ? '收起' : '展开'} ${title} 的子会话`} aria-expanded={open}
            onClick={() => setExpanded(current => ({ ...current, [row.sourceId]: !open }))}
            icon={<IconChevronRightOutlineRegular size={14}/>}/>}
        </div>
        <small className="muted">{child ? '子会话' : placeholder ? '主会话未加载' : available ? date(row.updated) : '缺少本机原档'}</small>
      </div>
      {open && !!children.length && <ul className="import-branches">{children.map(sessionRow)}</ul>}
    </li>;
  };

  const watchImport = async (id: string, roots: string[]) => {
    while (mounted.current) {
      const status = result(await api.catalogImportStatus(id));
      if (!mounted.current) return;
      setJob(status);
      if (status.phase === 'failed') {
        catalog.jobs.delete(cacheKey);
        throw new Error(status.error ?? '导入失败。');
      }
      if (status.phase !== 'done') {
        await new Promise(resolve => window.setTimeout(resolve, 600));
        continue;
      }
      const next = status.result!;
      catalog.jobs.delete(cacheKey);
      setReport(current => {
        const retried = new Set(roots);
        return {
          sessions: [...(current?.sessions.filter(row => !retried.has(row.rootKey ?? row.key)) ?? []), ...next.sessions],
          failures: [...(current?.failures.filter(row => !retried.has(row.key)) ?? []), ...next.failures],
        };
      });
      setSelected([...new Set(next.failures.map(row => row.key))]);
      if (scroll.current) scroll.current.scrollTop = 0;
      return;
    }
  };
  React.useEffect(() => {
    const pending = !archiveId && catalog.jobs.get(cacheKey);
    if (pending) void perform('正在导入会话…', () => watchImport(pending.id, pending.selected));
  }, [archiveId, cacheKey, catalog]);

  const submit = () => {
    if (!preview) return;
    void perform('正在导入会话…', async () => {
      const pending = catalog.jobs.get(cacheKey);
      if (pending) return watchImport(pending.id, pending.selected);
      setJob({ phase: 'discovering', completed: 0, total: 0 });
      const id = result(await api.startCatalogImport(preview.token, selected, globalMemory));
      catalog.jobs.set(cacheKey, { id, selected });
      await watchImport(id, selected);
    });
  };

  return <main className="sessivra-import"><style>{importPanelStyles}</style>
    <div className="import-frame">
      <header className="import-header">
        <div>
          <h1>{archiveId ? '会话原始归档' : '导入会话'}</h1>
          <p className="muted">{archiveId ? '查看并下载原始会话与记忆。' : '从 Codex 或 Claude Code 导入会话，在 DSH 继续对话。'}</p>
        </div>
        <div className="import-actions">
          {archiveId ? <Button variant="outline" onClick={back}>返回导入会话</Button> : <>
            {pickDirectory && <Button variant="outline" icon={<IconFolderCloseRegular size={16}/>} disabled={!!busy}
              onClick={() => void perform('正在选择文件夹…', async () => {
                const path = await pickDirectory();
                if (path) changeFolder(path);
              })}>选择文件夹</Button>}
            <Button variant="outline" icon={<IconRefreshOutlineRegular size={16}/>} disabled={loading || !!busy}
              onClick={() => { catalog.pages.delete(cacheKey); resetList(preview); refresh(); }}>刷新</Button>
            <Button variant="primary" icon={<IconDownloadOutlineRegular size={16}/>}
              disabled={!preview || loading || !selected.length || !!busy} onClick={submit}>导入所选会话</Button>
          </>}
        </div>
      </header>
      {!archiveId && <div className="import-toolbar">
        <div className="import-controls">
          <SegmentedTabs items={sourceTabs} value={source} label="来源" onChange={value => {
            if (busy || value === source) return;
            catalog.source = value;
            const nextFolder = catalog.folders[value];
            resetList(catalog.pages.get(JSON.stringify([value, nextFolder]))?.page);
            setSearch('');
            setGlobalMemory(false);
            setSource(value);
            setFolder(nextFolder);
          }}/>
          <div className="import-memory">
            <span aria-hidden="true">{globalMemoryLabel}</span>
            <Switch label={globalMemoryLabel} checked={globalMemory} onChange={setGlobalMemory} disabled={!!busy}/>
          </div>
        </div>
        {folder && <div className="import-folder muted">
          <span title={folder}>{folder}</span>
          <Button size="sm" variant="ghost" disabled={!!busy} onClick={() => changeFolder(undefined)}>使用默认目录</Button>
        </div>}
        <Input icon={<IconSearchOutlineRegular size={16}/>} aria-label="搜索项目或会话" placeholder="搜索项目或会话"
          value={search} onChange={event => { setSearch(event.target.value); setExpanded({}); }}/>
      </div>}
    </div>
    {archiveId ? <div className="import-scroll"><div className="import-frame import-content">
      {loading && <p className="muted" role="status">正在读取归档…</p>}
      {error && <p role="alert">{error}</p>}
      {busy && <p className="muted" role="status">{busy}</p>}
      {archive && fileList(archiveId, archive)}
    </div></div> : <>
      <div className="import-scroll" ref={scroll} id={sourceTab.panelId} role="tabpanel" aria-labelledby={sourceTab.id} aria-busy={loading}>
        <div className="import-frame import-content">
          {!!selected.length && <small className="muted" aria-live="polite">已选 {selected.length} 项</small>}
          {loading && <p className="muted" role="status">正在加载 {sourceTab.label} 会话…</p>}
          {busy && <p className="muted" role="status">{busy === '正在导入会话…' && job?.phase === 'importing'
            ? `正在导入 ${Math.min(job.completed + 1, job.total)} / ${job.total} 条会话${job.title ? ` · ${job.title}` : ''}`
            : busy === '正在导入会话…' ? '正在查找所选主会话及子会话…' : busy}</p>}
          {loadNotice && <p className="muted" role="status">{loadNotice}</p>}
          {error && <p role="alert">{error}</p>}
          {report && <section aria-label="导入结果">
            <h2>{report.failures.length ? '导入完成，部分会话失败' : '导入完成'} · {report.sessions.length} 条可继续</h2>
            {report.failures.map((row, index) => <p role="alert" key={row.key + ':' + index}>{row.title ?? preview?.rows.find(candidate => candidate.key === row.key)?.title}：{row.message}</p>)}
            <ul className="import-results">{report.sessions.map(row => <li className={row.parentId ? 'import-result-child' : undefined} key={row.id}>
              <div className="import-result-row"><strong>{row.title}</strong>
                <Button size="sm" variant="outline" disabled={!!busy}
                  onClick={() => void perform('正在打开会话…', () => open(row.id))}>打开并继续</Button>
              </div>
              <small className="muted">{row.status === 'existing' ? '已导入 · ' : ''}{row.projectedMessages} 条正文</small>
              <details><summary>下载原始会话与记忆</summary>{fileList(row.id, row.files)}</details>
            </li>)}</ul>
          </section>}
          {!!projects.size && <section aria-label="项目">
            <h2>项目</h2>
            {[...projects].map(([key, group]) => <details className="import-project" key={search.trim() + ':' + key} open={!!search.trim()}>
              <summary>
                <IconChevronRightOutlineRegular className="import-chevron" size={14}/>
                <IconFolderCloseRegular size={16}/><span>{group.name}</span>
                <small className="muted">{group.rows.length} 个会话</small>
              </summary>
              <ul>{group.rows.map(sessionRow)}</ul>
            </details>)}
          </section>}
          {!!standalone.length && <section aria-label="独立会话">
            <h2>独立会话</h2>
            <ul>{standalone.map(sessionRow)}</ul>
          </section>}
          {preview && !projects.size && !standalone.length && <p className="muted">
            {search.trim() ? preview.nextOffset === undefined ? '没有匹配的项目或会话。' : '已加载的会话中没有匹配项。' : '没有找到本机可读取的会话。'}
          </p>}
          {preview?.nextOffset !== undefined && <div className="import-more">
            <Button size="sm" variant="outline" disabled={loading || !!busy} onClick={loadMore}>
              {busy === '正在加载更多会话…' ? '加载中…' : '加载更多会话'}
            </Button>
          </div>}
          {!!preview?.warnings.length && <details className="muted"><summary>部分记录未能加载</summary>
            {preview.warnings.map(warning => <p key={warning}>{warning}</p>)}
          </details>}
        </div>
      </div>
    </>}
  </main>;
}
