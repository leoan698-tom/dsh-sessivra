import type { MentionQuery } from './mention-menu.js';

export const cliChatNames = { codex: 'Codex', grok: 'Grok Build', deepseek: 'DeepSeek', auto: '自动选择' } as const;
export type CliChatTarget = keyof typeof cliChatNames;
export type CliChatProvider = 'codex' | 'grok';
const markerPattern = () => /@\[(?:Codex|Grok Build|DeepSeek|自动选择)\]\(sessivra-cli:(codex|grok|deepseek|auto)\)/gu;

export function cliMarker(target: CliChatTarget) {
  return `@[${cliChatNames[target]}](sessivra-cli:${target})`;
}

export function cliPrompt(text: string) {
  const targets = new Set<CliChatTarget>();
  const prompt = text.replace(markerPattern(), (_match, target: CliChatTarget) => {
    targets.add(target);
    return '';
  }).trim();
  return { prompt, targets: [...targets] };
}

export const cliUserText = {
  id: 'sessivra-cli',
  order: -10,
  match(text: string, from: number) {
    const pattern = markerPattern();
    pattern.lastIndex = from;
    const match = pattern.exec(text);
    if (!match) return undefined;
    return { id: 'sessivra-cli', start: match.index, end: match.index + match[0].length,
      data: { label: '@' + cliChatNames[match[1] as CliChatTarget] } };
  },
};

export function createCliMentionSource(load: () => Promise<readonly CliChatProvider[]>) {
  const source = 'sessivra-cli';
  return {
    name: source, trigger: '@', order: -25, showGroupTitle: false,
    async candidates(_session: unknown, { query, quoted, signal }: MentionQuery) {
      if (quoted || signal.aborted) return [];
      const providers = await load().catch(() => []);
      if (!providers.length || signal.aborted) return [];
      const targets: CliChatTarget[] = ['auto', ...providers, 'deepseek'];
      const search = query.trim().toLowerCase();
      return targets.filter(target => cliChatNames[target].toLowerCase().includes(search))
        .map(target => ({ name: cliChatNames[target], value: target, section: '聊天对象',
          description: target === 'auto' ? '按任务推荐，确认后切换' : target === 'deepseek' ? '切回 DSH 模型' : '在当前会话中聊天' }));
    },
    onPick({ candidate }: { candidate: { value: CliChatTarget } }) {
      const target = candidate.value;
      return { insert: { source, ref: target, label: cliChatNames[target], appearance: 'session', clipboardText: cliMarker(target) } };
    },
    codec: {
      clipboardText(ref: CliChatTarget) { return cliMarker(ref); },
      serialize(ref: CliChatTarget, signal: AbortSignal) { signal.throwIfAborted(); return cliMarker(ref); },
    },
  };
}
