import React, { useRef, useState } from 'react';
import { HoverCard, ReferenceChip } from '@deepseek-ai/dsh-client-ui-primitives';
import type { SentBookmark } from './bookmark-user-text.js';
import type { LegacyBookmarkQuote, MessageOrigin } from './message-history.js';

export function SentBookmarkChip({ quote, locateLegacy, jump }: {
  quote: SentBookmark;
  locateLegacy(quote: LegacyBookmarkQuote): Promise<MessageOrigin | null>;
  jump(origin: MessageOrigin): void;
}) {
  const resolving = useRef(false);
  const [status, setStatus] = useState('');
  const open = async () => {
    if (quote.origin) { jump(quote.origin); return; }
    if (resolving.current) return;
    resolving.current = true;
    setStatus('正在定位原问答…');
    try {
      const { title, turn, prompt, response } = quote;
      const origin = await locateLegacy({ title, turn, prompt, response });
      setStatus(origin ? '' : '无法唯一定位原问答');
      if (origin) jump(origin);
    } catch {
      setStatus('暂时无法定位原问答，请重试');
    } finally {
      resolving.current = false;
    }
  };
  return <HoverCard inline openDelayMs={230}
    anchor={<ReferenceChip appearance="session" label={quote.label} title="" onActivate={() => void open()}/>}
    content={<div style={{ minWidth: 0, width: 'min(272px, 65vw)', maxWidth: '100%', textAlign: 'start', fontSize: 13, lineHeight: '1.45' }}>
      <div style={{ marginBottom: 8, fontWeight: 500, overflowWrap: 'anywhere' }}>{quote.title} · 第 {quote.turn} 轮</div>
      <PreviewText title="提问" text={quote.prompt} />
      <PreviewText title="回复" text={quote.response} />
      {status && <div role="status" style={{ marginTop: 6 }}>{status}</div>}
    </div>} />;
}

function PreviewText({ title, text }: { title: string; text: string }) {
  return <div style={{ marginBottom: 6 }}>
    <div style={{ fontSize: 12, opacity: .72 }}>{title}</div>
    <div style={{ display: '-webkit-box', WebkitBoxOrient: 'vertical', WebkitLineClamp: 5, overflow: 'hidden', whiteSpace: 'pre-line', overflowWrap: 'anywhere' }}>{text || '—'}</div>
  </div>;
}
