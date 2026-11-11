import React from 'react';
import { Button, Input, Modal } from '@deepseek-ai/dsh-client-ui-primitives';
import type { ImportApi, ImportBrowse, ImportListing } from './import-contract.js';

export function ImportPathPicker({ api, query, close, select }: {
  api: ImportApi; query: ImportBrowse; close(): void; select(path: string): void;
}) {
  const [listing, setListing] = React.useState<ImportListing>();
  const [address, setAddress] = React.useState(query.path ?? '');
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState('');
  const version = React.useRef(0);
  const go = async (path?: string) => {
    const request = ++version.current;
    setBusy(true);
    setError('');
    try {
      const result = await api.browse({ ...query, path });
      if (version.current !== request) return;
      if (!result.ok) throw new Error(result.error.message);
      setListing(result.value);
      setAddress(result.value.path);
    } catch (failure) {
      if (version.current === request) setError(failure instanceof Error ? failure.message : String(failure));
    } finally {
      if (version.current === request) setBusy(false);
    }
  };
  React.useEffect(() => {
    void go(query.path);
    return () => { version.current++; };
  }, []);
  const title = query.kind === 'directory' ? '选择文件夹' : query.kind === 'session' ? '选择会话原档' : '选择记忆文件或目录';
  const current = listing?.path;
  return <Modal open title={title} closeLabel="关闭" onClose={close} footer={<>
    <Button type="button" onClick={close}>取消</Button>
    {query.kind !== 'session' && <Button type="button" variant="primary" disabled={!current || busy || !!error}
      onClick={() => select(current!)}>选择当前文件夹</Button>}
  </>}>
    <div className="sessivra-import-picker">
      <form onSubmit={event => { event.preventDefault(); void go(address.trim() || undefined); }}>
        <Input aria-label="浏览位置" value={address} maxLength={4096} onChange={event => setAddress(event.target.value)}/>
        <Button type="submit" variant="outline" disabled={busy}>前往</Button>
      </form>
      <div className="picker-toolbar">
        <Button type="button" size="sm" disabled={busy || !listing?.parent} onClick={() => void go(listing!.parent!)}>上一级</Button>
        <Button type="button" size="sm" disabled={busy} onClick={() => void go()}>用户目录</Button>
      </div>
      {error && <p role="alert">{error}</p>}
      {busy && <p role="status">读取文件夹…</p>}
      {!busy && !error && listing && <ul aria-label="文件和文件夹">
        {listing.entries.map(entry => <li key={entry.path}>
          <Button type="button" onClick={() => entry.kind === 'directory' ? void go(entry.path) : select(entry.path)}
            aria-label={entry.kind === 'directory' ? `打开文件夹 ${entry.name}` : `选择文件 ${entry.name}`}>
            <span className="picker-kind">{entry.kind === 'directory' ? '文件夹' : '文件'}</span>{entry.name}
          </Button>
        </li>)}
        {!listing.entries.length && <li>没有可选文件或子目录</li>}
        {listing.truncated && <li>仅显示前 500 项，可输入更具体的路径。</li>}
      </ul>}
    </div>
  </Modal>;
}
