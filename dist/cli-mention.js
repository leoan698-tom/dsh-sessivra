export const cliChatNames = { codex: 'Codex', grok: 'Grok Build', deepseek: 'DeepSeek', auto: '自动选择' };
const markerPattern = () => /@\[(?:Codex|Grok Build|DeepSeek|自动选择)\]\(sessivra-cli:(codex|grok|deepseek|auto)\)/gu;
export function cliMarker(target) {
    return `@[${cliChatNames[target]}](sessivra-cli:${target})`;
}
export function cliPrompt(text) {
    const targets = new Set();
    const prompt = text.replace(markerPattern(), (_match, target) => {
        targets.add(target);
        return '';
    }).trim();
    return { prompt, targets: [...targets] };
}
export const cliUserText = {
    id: 'sessivra-cli',
    order: -10,
    match(text, from) {
        const pattern = markerPattern();
        pattern.lastIndex = from;
        const match = pattern.exec(text);
        if (!match)
            return undefined;
        return { id: 'sessivra-cli', start: match.index, end: match.index + match[0].length,
            data: { label: '@' + cliChatNames[match[1]] } };
    },
};
export function createCliMentionSource(load) {
    const source = 'sessivra-cli';
    return {
        name: source, trigger: '@', order: -25, showGroupTitle: false,
        async candidates(_session, { query, quoted, signal }) {
            if (quoted || signal.aborted)
                return [];
            const providers = await load().catch(() => []);
            if (!providers.length || signal.aborted)
                return [];
            const targets = ['auto', ...providers, 'deepseek'];
            const search = query.trim().toLowerCase();
            return targets.filter(target => cliChatNames[target].toLowerCase().includes(search))
                .map(target => ({ name: cliChatNames[target], value: target, section: '聊天对象',
                description: target === 'auto' ? '按任务推荐，确认后切换' : target === 'deepseek' ? '切回 DSH 模型' : '在当前会话中聊天' }));
        },
        onPick({ candidate }) {
            const target = candidate.value;
            return { insert: { source, ref: target, label: cliChatNames[target], appearance: 'session', clipboardText: cliMarker(target) } };
        },
        codec: {
            clipboardText(ref) { return cliMarker(ref); },
            serialize(ref, signal) { signal.throwIfAborted(); return cliMarker(ref); },
        },
    };
}
