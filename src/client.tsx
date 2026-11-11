import React from 'react';
import type { Context } from '@deepseek-ai/cordis';
import type {} from '@deepseek-ai/dsh-api-remotes/client';
import type {} from '@deepseek-ai/dsh-client-ui-renderer/client';
import type { RemoteResult } from '@deepseek-ai/dsh-typert-protocol';
import { TaskPanel, taskPanelTitle, type TaskHistoryApi, type TaskPanelApi } from './task-panel.js';
import { createMessageNavigator, MessageJumpNotice } from './message-navigation.js';
import { BookmarkLibrary } from './bookmark-library.js';
import { createBookmarkMentionSource } from './bookmark-mention.js';
import { compactNativeReferences, createSidebarMentionSource, type MentionRegistry } from './mention-menu.js';
import { bookmarkUserText, type SentBookmark } from './bookmark-user-text.js';
import { SentBookmarkChip } from './sent-bookmark.js';
import type { HistoryResults, MessageLocation, MessageOrigin, ResolvedMessage } from './message-history.js';
import type { MainPanelId } from '@deepseek-ai/dsh-client-ui-layout/client';
import { remoteContribution } from './contract.js';
import { createLegacyRecipientSource } from './recipient-source.js';
import type {} from '@deepseek-ai/dsh-client-ui-workspace/client';
import type { ISessions } from '@deepseek-ai/dsh-api-session-controller/client';
import { Button, FISH_LOGO_PATH, FISH_LOGO_VIEWBOX, MarkdownText, Menu, MenuItemButton, Modal } from '@deepseek-ai/dsh-client-ui-primitives';
import { createImportCatalogState, ImportPanel } from './import-panel.js';
import type { ImportApi } from './import-contract.js';
import { createSessionTreeStore, type TreeApi } from './session-tree.js';
import { NativeSessionTreeHost } from './session-tree-host.js';
import type { SessionActions } from './session-actions.js';
import { createSessionDialogStore, SessionDialogOutlet } from './session-dialog.js';
import { createWorkspaceArchiveSource, NativeTeamSearch, ParentUnavailableComposer, selectParentUnavailable, type WorkspaceViewSlots } from './session-navigation.js';
import { createSessionViews, SessionViews, SessionViewContent } from './session-views.js';
import { mirrorNativePaneHeader } from './native-pane-header.js';
import { createHeaderViews, wireHeaderViews } from './header-views.js';
import { createSessionReferenceDrop, SessionReferenceDropInput } from './session-reference-drop.js';
import { turnBookmarksChanged } from './turn-bookmarks.js';

interface Api {
  selectRecipient(sourceId: string, targetId: string, label: string): Promise<RemoteResult<unknown>>;
}
const reportLabels = { code: { copyLabel: '复制代码', copiedLabel: '已复制' }, footnotes: '脚注' };
const renderReport = (text: string) => <MarkdownText text={text} labels={reportLabels}/>;
const bookmarkFish = { path: FISH_LOGO_PATH, ...FISH_LOGO_VIEWBOX };

declare module '@deepseek-ai/dsh-typert-protocol' { interface TypertRemoteNamespaceMap { sessionMessenger: Api; sessivraTaskPanel: TaskPanelApi & TaskHistoryApi; sessionCollaboration: TreeApi; sessivraImport: ImportApi } }
export const inject = ['slots', 'remote'];
export async function apply(ctx: Context) {
  await ctx.remote.$mount(remoteContribution);
  await ctx.inject(['remote.sessionMessenger'], remoteCtx => {
    remoteCtx.inject(['uiWorkspace', 'sessions', 'conversation', 'remote.sessionCollaboration'], treeCtx => {
      // Extend native session rows; never occupy sidebar.workspaces, whose owner
      // also supplies the native header, search, view options and directory flow.
      const treeSlots = treeCtx.slots as unknown as WorkspaceViewSlots & { inject(name: string, register: () => unknown): void; register(entry: object, component: React.ComponentType<never>): () => void };
      const store = createSessionTreeStore(treeCtx.remote.sessionCollaboration);
      const dialogs = createSessionDialogStore();
      const sessions = treeCtx.sessions as unknown as ISessions;
      const archiveView = createWorkspaceArchiveSource(treeSlots);
      treeCtx.inject(['inputTriggers', 'workspaces'], mentionCtx => {
        const host = mentionCtx as unknown as { inputTriggers: MentionRegistry; workspaces: { list: { getSnapshot(): ReturnType<Parameters<typeof createSidebarMentionSource>[2]> } } };
        const registry = host.inputTriggers;
        const source = createSidebarMentionSource(sessions, store, () => host.workspaces.list.getSnapshot(), archiveView.getSnapshot);
        mentionCtx.effect(() => compactNativeReferences(registry), 'sessivra: compact native file candidates');
        mentionCtx.effect(() => registry.registerSource(source), 'sessivra: sidebar mention candidates');
      });
      const views = createSessionViews(sessions);
      const referenceDrop = createSessionReferenceDrop();
      const headerViews = createHeaderViews();
      let requested: { key: number; task?: string; source?: ResolvedMessage } = { key: 0 };
      let showTask: ((id:string) => void) | undefined;
      let searchHistory: ((query: string) => Promise<HistoryResults>) | undefined;
      let openMessage: ((location: MessageLocation) => void) | undefined;
      let taskAction: { Button: typeof Button; open(location: MessageLocation, signal: AbortSignal): Promise<void> } | undefined;
      treeCtx.inject(['remote.sessivraImport', 'layout'], importCtx => {
        const panelId = 'sessivra-import' as MainPanelId;
        const catalog = createImportCatalogState();
        const api = importCtx.remote.sessivraImport;
        const listeners = new Set<() => void>();
        let selection: { key: number; id?: string } = { key: 0 };
        const show = (id?: string) => {
          selection = { key: selection.key + 1, id };
          importCtx.layout.selectPanel(panelId);
          for (const notify of listeners) notify();
        };
        treeSlots.inject('sidebar.panellist', () => treeSlots.register({
          name: 'sidebar.panellist', id: panelId, order: 22, label: () => '导入会话',
        }, ({ size }: { size: number }) => <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" aria-hidden="true"><path d="M12 3v12m-4-4 4 4 4-4M4 16v4h16v-4"/></svg>));
        treeSlots.inject('main', () => treeSlots.register({ name: 'main', key: panelId }, function MountedImport() {
          const current = React.useSyncExternalStore(listener => { listeners.add(listener); return () => { listeners.delete(listener); }; }, () => selection);
          return <ImportPanel key={current.key} api={api} archiveId={current.id} catalog={catalog}
            pickDirectory={() => treeCtx.uiWorkspace.pickDirectory()}
            back={() => show()}
            open={async id => {
              await sessions.refresh();
              treeCtx.uiWorkspace.openSession(id as Parameters<typeof treeCtx.uiWorkspace.openSession>[0]);
            }}/>;
        }));
        treeSlots.inject('sidebar.workspaces.session.menu.item', () => treeSlots.register({
          name: 'sidebar.workspaces.session.menu.item', id: 'sessivra-import-archive', order: 500,
        }, ({ sessionId, useMenuOpenState }: { sessionId: string; useMenuOpenState: () => readonly [boolean, (open: boolean) => void] }) => {
          const [, setOpen] = useMenuOpenState();
          if (!/^sessivra-import-[a-f0-9]{32}$/.test(sessionId)) return null;
          return <MenuItemButton onSelect={() => { setOpen(false); show(sessionId); }}>查看导入原档</MenuItemButton>;
        }));
      });
      treeCtx.inject(['remote.sessivraTaskPanel','layout'], panelCtx => {
        const panelId = 'sessivra-tasks' as MainPanelId;
        const listeners = new Set<()=>void>();
        const api = panelCtx.remote.sessivraTaskPanel;
        const show = (selection: Omit<typeof requested, 'key'>) => {
          requested = { key: requested.key + 1, ...selection };
          panelCtx.layout.selectPanel(panelId);
          for (const notify of listeners) notify();
        };
        showTask = id => show({ task: id });
        const locateMessage = async (location: MessageLocation, expected = '') => {
          const result = await api.locateMessage(location, expected);
          if (!result.ok) throw new Error(result.error.message);
          return result.value;
        };
        const navigator = createMessageNavigator(sessions, target => panelCtx.uiWorkspace.openSession(target), locateMessage);
        searchHistory = async query => {
          const result = await api.searchHistory(query);
          if (!result.ok) throw new Error(result.error.message);
          return result.value;
        };
        openMessage = location => { void navigator.jump(location); };
        taskAction = { Button, async open(location, signal) {
          const source = await locateMessage(location);
          signal.throwIfAborted();
          navigator.dismiss();
          show({ source });
        } };
        panelCtx.effect(() => () => { showTask=undefined; searchHistory=undefined; openMessage=undefined; taskAction=undefined; navigator.dismiss(); });
        const panelSlots = panelCtx.slots as unknown as typeof treeSlots;
        const bookmarkPanelId = 'sessivra-bookmarks' as MainPanelId;
        const loadBookmarks = async (sessionId: string, turns: number[]) => {
          const result = await api.bookmarkedTurns(sessionId, turns);
          if (!result.ok) throw new Error(result.error.message);
          return result.value;
        };
        panelCtx.inject(['inputTriggers'], mentionCtx => {
          const source = createBookmarkMentionSource(loadBookmarks, async (origin, turn) => {
            const result = await api.bookmarkReference(origin, turn);
            if (!result.ok) throw new Error(result.error.message);
            return result.value;
          });
          const { inputTriggers } = mentionCtx as unknown as { inputTriggers: { registerSource(value: typeof source): () => void } };
          mentionCtx.effect(() => {
            const dispose = inputTriggers.registerSource(source);
            const warm = () => { void source.warm(); };
            const timer = window.setTimeout(warm, 800);
            window.addEventListener(turnBookmarksChanged, warm);
            window.addEventListener('storage', warm);
            return () => { clearTimeout(timer); window.removeEventListener(turnBookmarksChanged, warm); window.removeEventListener('storage', warm); dispose(); };
          }, 'sessivra: bookmark mentions');
        });
        const jumpBookmark = ({ sessionId, seq, messageId }: MessageOrigin) => { void navigator.jump({ sessionId, seq }, messageId, true); };
        panelCtx.inject(['uiConversation'], textCtx => {
          const { uiConversation } = textCtx as unknown as { uiConversation: { userText: { register(rule: typeof bookmarkUserText): () => void } } };
          textCtx.effect(() => uiConversation.userText.register(bookmarkUserText), 'sessivra: display sent bookmark references');
          panelSlots.inject('conversation.user.text.node', () => panelSlots.register({
            name: 'conversation.user.text.node', key: bookmarkUserText.id, priority: 100,
          }, ({ node }: { node: { data: SentBookmark } }) =>
            <SentBookmarkChip quote={node.data} jump={jumpBookmark} locateLegacy={async quote => {
              const result = await api.locateLegacyBookmark(quote);
              if (!result.ok) throw new Error(result.error.message);
              return result.value;
            }}/>));
        });
        panelSlots.inject('sidebar.panellist', () => panelSlots.register({
          name: 'sidebar.panellist', id: bookmarkPanelId, order: 21, label: () => '收藏',
        }, ({ size }: { size: number }) => <svg width={size} height={size} viewBox={`-1 -1 ${bookmarkFish.width + 2} ${bookmarkFish.height + 2}`} fill="none" stroke="currentColor" strokeWidth="1.4" aria-hidden="true"><path d={bookmarkFish.path}/></svg>));
        panelSlots.inject('main', () => panelSlots.register({ name: 'main', key: bookmarkPanelId }, () =>
          <BookmarkLibrary load={loadBookmarks} jump={jumpBookmark} Menu={Menu}/>));
        panelSlots.inject('shell.overlay', () => panelSlots.register({
          name: 'shell.overlay', id: 'sessivra-message-origin',
          inject: () => ({ navigator, Button }),
        }, MessageJumpNotice));
        panelSlots.inject('sidebar.panellist', () => panelSlots.register({
          name:'sidebar.panellist', id:panelId, order:20, label:()=>taskPanelTitle,
        }, ({size}:{size:number}) => <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" aria-hidden="true"><path d="m3 6 2 2 4-5M12 6h9M3 14l2 2 4-5M12 14h9M12 20h9"/></svg>));
        panelSlots.inject('main', () => panelSlots.register({ name:'main', key:panelId }, function Mounted(props: {useSessions:<T>(get:(s:{byId:Record<string,{id:string; retainedBy:{mainView?:number}}>})=>T)=>T}) {
          const current = props.useSessions(s=>Object.values(s.byId).find(row=>row.retainedBy.mainView)?.id);
          const selection = React.useSyncExternalStore(listener=>{listeners.add(listener);return()=>{listeners.delete(listener);};},()=>requested);
          React.useEffect(() => () => {
            if (requested === selection && selection.source) requested = { key: selection.key + 1 };
          }, [selection]);
          const initialSession = selection.source ? selection.source.child?.parentSessionId ?? selection.source.origin.sessionId : current;
          return <TaskPanel key={selection.key} initialSession={initialSession} initialTask={selection.task} source={selection.source}
            openOrigin={origin => { void navigator.jump({ sessionId: origin.sessionId, seq: origin.seq }, origin.messageId); }}
            api={api} renderMarkdown={renderReport} open={id=>{
            const node=store.getSnapshot().nodes.get(id);
            if(node?.subagent && !node.openable) throw new Error('会话当前不可打开');
            panelCtx.uiWorkspace.openSession((node?.subagent ? {parentSessionId:node.parentId,childSessionId:id,mode:node.subagentMode} : id) as Parameters<typeof treeCtx.uiWorkspace.openSession>[0]);
          }}/>;
        }));
      });
      treeSlots.inject('conversation.session.header.actions', () => wireHeaderViews(treeCtx.slots, headerViews));
      treeSlots.inject('conversation.input.overlay', () => treeSlots.register({
        name: 'conversation.input.overlay', id: 'sessivra-reference-drop',
        inject: (sessionId: Parameters<ISessions['binding']>[0]) => {
          const binding = sessions.binding(sessionId);
          if (!binding) throw new Error('会话输入框尚未就绪');
          return { referenceDrop, sessionInput: treeCtx.conversation.input.for(binding.ctx) };
        },
      }, SessionReferenceDropInput));
      treeCtx.effect(() => () => views.dispose(), 'sessivra: session views');
      treeSlots.inject('shell.overlay', () => treeSlots.register({
        name: 'shell.overlay', id: 'sessivra-session-views',
        children: { 'sessivra.conversation.pane': { kind: 'single', scope: 'session' }, 'sessivra.conversation.header': { kind: 'single', scope: 'session' } },
        inject: () => ({ views, store, referenceDrop, headerViews, Menu, fish: bookmarkFish, selectSession: (target: Parameters<typeof treeCtx.uiWorkspace.openSession>[0]) => treeCtx.uiWorkspace.openSession(target), startSession: () => treeCtx.uiWorkspace.startSession() }),
      }, SessionViews));
      treeSlots.inject('sessivra.conversation.pane', () => treeSlots.register({ name: 'sessivra.conversation.pane' }, SessionViewContent));
      treeSlots.inject('sessivra.conversation.header', () => mirrorNativePaneHeader(treeCtx.slots));
      const openSession = (session: import('./collaboration.js').TreeSession) => {
        if (session.subagent && !session.openable) return;
        treeCtx.uiWorkspace.openSession((session.subagent
          ? { parentSessionId: session.parentId, childSessionId: session.id, mode: session.subagentMode }
          : session.id) as Parameters<typeof treeCtx.uiWorkspace.openSession>[0]);
      };
      treeCtx.effect(() => () => store.dispose(), 'session-messenger: native tree');
      treeCtx.effect(() => () => dialogs.dispose(), 'session-messenger: session dialogs');
      treeSlots.inject('shell.overlay', () => treeSlots.register({
        name: 'shell.overlay', id: 'sessivra-session-dialogs', inject: () => ({ dialogs }),
      }, SessionDialogOutlet));
      treeSlots.inject('shell.overlay', () => treeSlots.register({
        name: 'shell.overlay', id: 'sessivra-team-search', inject: () => ({ store, openSession, searchHistory, openMessage, taskAction, hooks: { archiveFilter: archiveView } }),
      }, NativeTeamSearch));
      treeSlots.inject('conversation.composer', () => treeSlots.register({
        // Chain seats use ascending priority; the native read-only entry is -10.
        name: 'conversation.composer', id: 'sessivra-parent-unavailable', priority: -20,
        select: selectParentUnavailable, inject: () => ({ store, openSession, Button }),
      }, ParentUnavailableComposer));
      treeSlots.inject('sidebar.workspaces.session.row.action', () => treeSlots.register({
        name: 'sidebar.workspaces.session.row.action', id: 'messenger-session-children', order: 300,
        inject: () => ({
          store, openTask:(id:string)=>showTask?.(id),
          controls: { Menu, Modal, Button },
          dialogs,
          sessionActions: {
            rename: async (id, title) => {
              const result = await sessions.using(id as Parameters<ISessions['using']>[0], { source: 'workspaceOperation' }, reference => reference.binding.session.rename(title));
              if (!result.ok) throw new Error(result.error.message);
            },
            pin: (id, pinned) => pinned ? treeCtx.uiWorkspace.pinSession(id as Parameters<typeof treeCtx.uiWorkspace.pinSession>[0]) : treeCtx.uiWorkspace.unpinSession(id as Parameters<typeof treeCtx.uiWorkspace.unpinSession>[0]),
            archive: id => treeCtx.uiWorkspace.archiveSession(id as Parameters<typeof treeCtx.uiWorkspace.archiveSession>[0]),
          } satisfies SessionActions,
          openSession,
        }),
      }, NativeSessionTreeHost));
    });
    remoteCtx.inject(['inputTriggers'], triggerCtx => {
      const inputTriggers = (triggerCtx as unknown as { inputTriggers: { registerSource(source: ReturnType<typeof createLegacyRecipientSource>): () => void } }).inputTriggers;
      // This empty source exists solely to migrate pre-upgrade draft chips.
      triggerCtx.effect(() => inputTriggers.registerSource(createLegacyRecipientSource()), 'session-messenger: legacy draft codec');
    });
  });
}
