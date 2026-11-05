import test from 'node:test';
import assert from 'node:assert/strict';
import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import { JSDOM } from 'jsdom';
import { createSessionViews, SessionViews, SessionViewContent } from '../dist/session-views.js';
import { MAIN_PANE, mainLayout, dockPane, removePane, promotePane, resizeSplit, splitGeometry, paneIds, nearestEdge } from '../dist/split-layout.js';
import { createSessionTreeStore } from '../dist/session-tree.js';
import { createSessionReferenceDrop } from '../dist/session-reference-drop.js';
import { createHeaderViews } from '../dist/header-views.js';
import { mirrorNativePaneHeader } from '../dist/native-pane-header.js';
import { SlotCore } from '@deepseek-ai/dsh-client-ui-slots';

test('full native view rosters stay scoped and old occurrences cannot clear a promoted header', () => {
  const registry = createHeaderViews(), calls = [];
  const disposeOld = registry.register('same', { views: [{ id: 'chat', label: '对话' }], selectView: id => calls.push(['old', id]) });
  const disposeNew = registry.register('same', { views: [{ id: 'chat', label: '对话' }, { id: 'trajectory', label: '轨迹' }], selectView: id => calls.push(['new', id]) });
  disposeOld(); assert.equal(registry.getSnapshot().get('same').views.length, 2);
  registry.getSnapshot().get('same').selectView('trajectory'); assert.deepEqual(calls, [['new', 'trajectory']]);
  disposeNew(); assert.equal(registry.getSnapshot().size, 0);
});

test('native pane headers mirror Host components without redeclaring or mutating Host slots', async () => {
  const slots = new SlotCore();
  slots.register({ name: 'root', children: {
    'conversation.header': { kind: 'single', scope: 'session-maybe' },
    'sessivra.conversation.header': { kind: 'single', scope: 'session' },
  } }, () => null);
  const NativeHeader = props => props.renderSlot('native.actions', {});
  slots.register({ name: 'conversation.header', children: { 'native.actions': { kind: 'list', scope: 'session' } } }, NativeHeader);
  const unmountAction = slots.register({ name: 'native.actions', id: 'native-action' }, () => null);
  const source = slots.entriesOfSlot('conversation.header')[0];
  const dispose = mirrorNativePaneHeader(slots);
  assert.equal(slots.entriesOfSlot('conversation.header')[0], source);
  assert.equal(source.children['sessivra.pane-header.native.actions'], undefined);
  const mirror = slots.entriesOfSlot('sessivra.conversation.header')[0];
  assert.equal(slots.entriesOfSlot('sessivra.pane-header.native.actions').length, 1);
  const rendered = mirror.component({ renderSlot: name => name });
  assert.equal(rendered.type, NativeHeader);
  assert.equal(rendered.type(rendered.props), 'sessivra.pane-header.native.actions');
  unmountAction(); await new Promise(resolve => setImmediate(resolve));
  assert.equal(slots.entriesOfSlot('sessivra.pane-header.native.actions').length, 0);
  assert.equal(slots.entriesOfSlot('conversation.header')[0], source);
  dispose(); assert.equal(slots.entriesOfSlot('sessivra.conversation.header').length, 0);
  assert.equal(slots.entriesOfSlot('conversation.header')[0], source);
});

test('drag references use the native codec, exact Unicode identity and guarded insertion without deleting draft selection', () => {
  const drop = createSessionReferenceDrop(), calls = [];
  let allowed = true, persisted = 0, focused = 0;
  const dispose = drop.register('target', { captureInsertion: () => ({ start: 2, end: 7, draftRev: 9 }), persistDraft: () => persisted++ }, {
    insertReference: (reference, span) => { calls.push({ reference, span }); return allowed; }, focus: () => focused++,
  });
  assert.equal(drop.insert('missing', 'source', 'Title'), false);
  assert.equal(drop.insert('target', '会话-😀', '同名[会话]\\标题'), true);
  const { reference, span } = calls[0];
  assert.deepEqual(span, { start: 7, end: 7, draftRev: 9 });
  assert.equal(reference.source, 'reference'); assert.equal(reference.appearance, 'session');
  assert.equal(reference.ref, reference.clipboardText);
  const encoded = reference.ref.match(/dsh-session:([^)]*)/)[1];
  assert.equal(JSON.parse(Buffer.from(encoded, 'base64url').toString()), '会话-😀');
  assert.ok(reference.ref.startsWith('@[同名\\[会话\\]\\\\标题]'));
  assert.equal(persisted, 1); assert.equal(focused, 1);
  allowed = false; assert.equal(drop.insert('target', 'source', 'Title'), false);
  assert.equal(persisted, 1); assert.equal(focused, 1);
  dispose(); assert.equal(drop.insert('target', 'source', 'Title'), false);
});

test('view ownership deduplicates exact addresses, handles late failures and releases references', async () => {
  const calls = [], releases = [], pending = [];
  const views = createSessionViews({ retain(target, options) {
    const id = typeof target === 'string' ? target : target.childSessionId;
    calls.push({ target, options });
    return { sessionId: id, release: () => releases.push(id), ready: new Promise((resolve, reject) => pending.push({ resolve, reject })) };
  } });
  const child = { parentSessionId: 'parent', childSessionId: 'child', mode: 'continuable' };
  views.open(child, 'Worker'); views.open(child, 'Worker again');
  assert.equal(calls.length, 1); assert.deepEqual(calls[0], { target: child, options: { source: 'sessivraView' } });
  views.open('two', 'Two'); views.open('three', 'Three');
  views.open('four', 'Four'); assert.equal(calls.length, 4);
  views.close('four');
  pending[0].resolve(); await Promise.resolve(); assert.equal(views.getSnapshot()[0].ready, true);
  pending[1].reject(new Error('offline')); await Promise.resolve(); assert.match(views.getSnapshot()[1].error, /打开失败/);
  views.close('child'); views.close('child'); assert.deepEqual(releases, ['four', 'child']);
  views.dispose(); pending[2].resolve(); await Promise.resolve();
  assert.deepEqual(views.getSnapshot(), []); assert.deepEqual(releases, ['four', 'child', 'two', 'three']);
});

test('free docking, resizing, collapse and reparenting preserve scoped drafts and native content', async () => {
  const dom = new JSDOM('<div data-native-root data-phase="active"><div data-slot="conversation.header" style="display:contents"><header><nav aria-label="会话层级">Native header</nav><div data-conversation-header-corner></div><div><div data-conversation-tabs><button role="tab" aria-selected="true">对话</button><button role="tab">轨迹</button></div></div></header></div><div data-conversation-content data-conversation-session="main"><textarea>Unsent main draft</textarea></div></div><div data-row-key="session:other" draggable="true">Other</div><div data-session-id="child" draggable="true">Worker</div><div id="app"></div>');
  const previous = Object.fromEntries(['window', 'document', 'MutationObserver', 'Element', 'Node', 'IS_REACT_ACT_ENVIRONMENT'].map(key => [key, globalThis[key]]));
  Object.assign(globalThis, { window: dom.window, document: dom.window.document, MutationObserver: dom.window.MutationObserver, Element: dom.window.Element, Node: dom.window.Node, IS_REACT_ACT_ENVIRONMENT: true });
  dom.window.HTMLElement.prototype.getBoundingClientRect = function () { return this.classList.contains('sessivra-canvas') ? { left: 0, top: 130, width: 1000, height: 570 } : { left: 0, top: 0, width: 1000, height: 700 }; };
  const retained = [], released = [];
  const views = createSessionViews({ retain(target) {
    retained.push(target); const id = typeof target === 'string' ? target : target.childSessionId;
    return { sessionId: id, ready: Promise.resolve(), release: () => released.push(id) };
  } });
  const store = createSessionTreeStore({ tree: async () => ({ ok: true, value: [
    { id: 'main', label: 'Main', subagent: false }, { id: 'other', label: 'Other', subagent: false },
    { id: 'child', parentId: 'main', label: 'Worker', subagent: true, subagentKind: 'teammate', subagentMode: 'continuable', openable: true },
  ] }) });
  let current = 'main', activePanelId = null;
  const root = createRoot(document.getElementById('app'));
  const native = document.querySelector('[data-native-root]'), header = native.querySelector('header'), content = native.lastElementChild;
  const Context = React.createContext('');
  const nativeSelects = []; let starts = 0;
  function Header() { const id = React.useContext(Context); return React.createElement('header', { 'data-native-pane-header': '' }, React.createElement('nav', { 'aria-label': '会话层级' }, id), React.createElement('div', { 'data-conversation-header-corner': '' }), React.createElement('div', {}, React.createElement('div', { 'data-conversation-tabs': '' }, ['对话', '轨迹'].map(view => React.createElement('button', { key: view, role: 'tab', 'aria-selected': view === '对话', onClick: () => nativeSelects.push([id, view]) }, view))))); }
  function Menu({ anchor, open, items, onSelect }) { return React.createElement(React.Fragment, {}, anchor, open && React.createElement('div', { role: 'menu' }, items.map(item => React.createElement('button', { key: item.id, onClick: () => onSelect(item.id) }, item.label)))); }
  function ScopedContent() { const id = React.useContext(Context); return React.createElement('textarea', { 'aria-label': `Draft ${id}`, defaultValue: id }); }
  const references = [];
  const props = { views, store, headerViews: createHeaderViews(), Menu, selectSession: target => {
    const id = typeof target === 'string' ? target : target.childSessionId;
    assert.equal(document.querySelector(`[aria-label="Draft ${id}"]`), null, 'old editor occurrence must unmount before main navigation');
    assert.equal(released.includes(id), false, 'session and editor draft remain retained during promotion');
    current = id;
  }, startSession: () => starts++, referenceDrop: { insert: (...args) => { references.push(args); return true; } }, useSessions: selector => selector({ byId: { [current]: { id: current, retainedBy: {} } } }),
    usePanelInfo: selector => selector({ activePanelId }),
    SessionProvider: ({ session, children }) => React.createElement(Context.Provider, { value: session.sessionId }, children), renderSlot: name => name === 'sessivra.conversation.header' ? React.createElement(Header) : React.createElement(ScopedContent),
  };
  const render = () => act(async () => { content.dataset.conversationSession = current; root.render(React.createElement(SessionViews, props)); await new Promise(resolve => setImmediate(resolve)); });
  const event = (type, target, x = 0, y = 0, pointerId = 1) => {
    const event = new dom.window.MouseEvent(type, { clientX: x, clientY: y, button: 0, buttons: type === 'pointermove' ? 1 : 0, bubbles: true, cancelable: true });
    Object.defineProperties(event, { dataTransfer: { value: { dropEffect: '', files: [], setData() {} } }, pointerId: { value: pointerId } });
    target.dispatchEvent(event); return event;
  };
  const drag = async (source, x, y) => act(async () => { event('dragstart', document.querySelector(source)); assert.equal(event('dragover', native, x, y).defaultPrevented, true); event('drop', native, x, y); event('dragend', document.querySelector(source)); });
  try {
    await render();
    assert.equal(native.dataset.sessivraViews, 'true');
    assert.equal(document.querySelector('[aria-label="分屏布局"]'), null, 'preset layouts are removed');
    const mainInput = content.querySelector('textarea'); mainInput.setAttribute('data-composer-input', '');
    await act(async () => {
      const source = document.querySelector('[data-row-key]');
      event('dragstart', source); event('dragover', mainInput, 500, 650);
    });
    assert.equal(document.querySelector('.sessivra-drop-preview'), null, 'composer gets no split preview');
    await act(async () => { event('drop', mainInput, 500, 650); event('dragend', document.querySelector('[data-row-key]'), 500, 650); });
    assert.deepEqual(references, [['main', 'other', 'Other']]);
    assert.equal(retained.length, 0, 'reference drop never opens a split');
    await act(async () => { assert.equal(event('drop', native, 100, 200).defaultPrevented, false, 'file and text drops remain native'); });
    await act(async () => { event('dragstart', document.querySelector('[data-row-key]')); document.dispatchEvent(new dom.window.KeyboardEvent('keydown', { key: 'Escape', bubbles: true })); event('dragend', document.querySelector('[data-row-key]'), 990, 400); });
    assert.equal(retained.length, 0, 'Escape must not dock on native dragend');
    await act(async () => { event('dragstart', document.querySelector('[data-row-key]')); event('dragend', document.querySelector('[data-row-key]'), 1100, 400); });
    assert.equal(retained.length, 0, 'release outside the canvas must not dock');
    await act(async () => { const source = document.querySelector('[data-row-key]'); event('pointerdown', source, 10, 20); event('pointermove', native, 990, 400); event('pointercancel', source); event('pointerup', native, 990, 400); });
    assert.equal(retained.length, 0, 'cancelled pointer docking must not open a view');
    assert.equal(document.querySelector('.sessivra-drop-preview'), null);
    // Native Windows can finish a drag without delivering dragover/drop.
    await act(async () => { event('dragstart', document.querySelector('[data-row-key]')); event('dragend', document.querySelector('[data-row-key]'), 990, 400); });
    assert.deepEqual(retained, ['other']);
    assert.equal(native.dataset.sessivraSplit, 'true');
    assert.equal(header.dataset.sessivraMainHeader, '');
    assert.equal(header.dataset.viewSource, MAIN_PANE);
    assert.equal(document.querySelector('[data-row-key]').dataset.sessivraVisible, 'true');
    assert.equal(document.querySelectorAll('[data-native-pane-header]').length, 1);
    assert.equal(document.querySelectorAll('[data-sessivra-compact]').length, 2);
    await act(async () => props.headerViews.register('other', { views: [{ id: 'chat', label: '对话' }, { id: 'trajectory', label: '轨迹' }], current: 'chat', selectView: id => nativeSelects.push(['other', id === 'trajectory' ? '轨迹' : '对话']) }));
    await act(async () => document.querySelector('[aria-label="视图菜单：Other"]').click());
    await act(async () => [...document.querySelectorAll('[role=menu] button')].find(button => button.textContent === '轨迹').click());
    assert.deepEqual(nativeSelects, [['other', '轨迹']], 'view menu calls only its own native tab handler');
    const draft = document.querySelector('[aria-label="Draft other"]'); draft.value = 'Keep this draft';
    draft.setAttribute('data-composer-input', '');
    await act(async () => { const source = document.querySelector('[data-session-id]'); event('pointerdown', source, 10, 20); event('pointermove', draft, 750, 650); event('pointerup', draft, 750, 650); });
    assert.deepEqual(references[1], ['other', 'child', 'Worker']);
    assert.equal(retained.length, 1, 'auxiliary composer drop cannot split');
    assert.equal(draft.value, 'Keep this draft');
    const other = document.querySelector('[data-sessivra-pane="other"]');
    assert.equal(parseFloat(other.style.left), 503);
    assert.equal(other.querySelector('[aria-label="关闭视图：Other"]').textContent, '', 'close is an icon, not a text button');
    await act(async () => {
      const source = document.querySelector('[data-session-id]');
      event('pointerdown', source, 10, 20); event('pointermove', native, 750, 695);
      assert.equal(event('dragstart', source).defaultPrevented, true, 'fast entry into canvas stays in pointer mode');
      event('pointerup', native, 750, 695);
      assert.equal(event('click', native).defaultPrevented, true, 'release click cannot navigate away from split');
    }); // bottom of other
    assert.deepEqual(retained[1], { parentSessionId: 'main', childSessionId: 'child', mode: 'continuable' });
    assert.equal(document.querySelector('[data-session-id]').dataset.sessivraVisible, 'true');
    assert.equal(document.querySelectorAll('[role="separator"]').length, 2);
    assert.equal(parseFloat(other.style.height), 282);
    assert.equal(native.firstElementChild.contains(header), true); assert.equal(content.querySelector('textarea').value, 'Unsent main draft');
    // Move an existing occurrence to the left of main without remount or retain.
    await drag('[data-view-source="other"]', 1, 400);
    assert.equal(retained.length, 2);
    assert.equal(document.querySelector('[aria-label="Draft other"]'), draft);
    assert.equal(draft.value, 'Keep this draft');
    assert.equal(parseFloat(other.style.left), 0);
    const separator = document.querySelector('[role="separator"]');
    await act(async () => separator.dispatchEvent(new dom.window.KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true })));
    assert.equal(separator.getAttribute('aria-valuenow'), '52');
    await act(async () => { event('pointerdown', separator, 520, 300); event('pointermove', separator, 700, 300); event('pointerup', separator, 700, 300); });
    assert.ok(Number(separator.getAttribute('aria-valuenow')) > 65);
    const beforeCancel = separator.getAttribute('aria-valuenow');
    await act(async () => { event('pointerdown', separator, 700, 300); event('pointermove', separator, 100, 300); event('pointercancel', separator); });
    assert.equal(separator.getAttribute('aria-valuenow'), beforeCancel);
    assert.equal(document.querySelector('[aria-label="Draft other"]'), draft);
    await act(async () => document.querySelector('[aria-label="关闭视图：Main"]').click());
    await render(); assert.equal(current, 'other'); assert.deepEqual(released, ['other']);
    assert.equal(document.querySelectorAll('[role="separator"]').length, 1, 'close collapses only the removed branch');
    await act(async () => document.querySelector('[aria-label="关闭视图：Worker"]').click());
    assert.deepEqual(released, ['other', 'child']);
    assert.equal(document.querySelectorAll('[role="separator"]').length, 0);
    await act(async () => document.querySelector('[aria-label="关闭视图：Other"]').click()); assert.equal(starts, 1, 'closing the last view opens native new-session navigation');
    assert.equal(document.querySelector('[data-session-id]').dataset.sessivraVisible, undefined, 'closing a view removes its row highlight');
    assert.equal(document.querySelector('.sessivra-views-toolbar'), null, 'no control bar');
    await act(async () => { const source = document.querySelector('[data-row-key]'); source.dataset.rowKey = 'session:main'; event('dragstart', source); event('drop', native, 990, 400); event('dragend', source); });
    assert.equal(retained.at(-1), 'main');
    activePanelId = 'settings'; await render(); assert.equal(document.querySelector('.sessivra-views-toolbar'), null);
    assert.equal(native.dataset.sessivraViews, undefined);
    assert.equal(document.querySelector('[data-row-key]').dataset.sessivraVisible, undefined, 'other panels clear split highlights');
    activePanelId = null; await render(); assert.equal(native.dataset.sessivraViews, 'true');
    assert.equal(document.querySelectorAll('.sessivra-pane').length, 1);
    await act(async () => root.unmount());
    assert.equal(native.dataset.sessivraViews, undefined); assert.equal(native.style.getPropertyValue('--sessivra-main-width'), '');
    assert.equal(content.isConnected, true); assert.equal(header.isConnected, true);
  } finally { await act(async () => root.unmount()); views.dispose(); store.dispose(); dom.window.close(); Object.assign(globalThis, previous); }
});

test('split tree supports every edge, nested ratios, moves and branch collapse without losing leaves', () => {
  for (const edge of ['left', 'right', 'top', 'bottom']) {
    const tree = dockPane(mainLayout(), 'added', MAIN_PANE, edge, 'split');
    const boxes = splitGeometry(tree, 1000, 800), main = boxes.panes.get(MAIN_PANE), added = boxes.panes.get('added');
    assert.equal(boxes.dividers.length, 1);
    assert.ok(edge === 'left' ? added.x < main.x : edge === 'right' ? added.x > main.x : edge === 'top' ? added.y < main.y : added.y > main.y);
    assert.deepEqual(removePane(tree, 'added'), mainLayout());
    assert.deepEqual(promotePane(tree, 'added'), mainLayout());
  }
  let tree = dockPane(mainLayout(), 'a', MAIN_PANE, 'right', 'outer');
  tree = resizeSplit(tree, 'outer', .7);
  tree = dockPane(tree, 'b', 'a', 'bottom', 'inner');
  tree = resizeSplit(tree, 'inner', .3);
  const a = splitGeometry(tree, 1000, 800).panes.get('a');
  assert.equal(a.x, 701.8); assert.ok(a.height < 250);
  tree = dockPane(tree, MAIN_PANE, 'b', 'top', 'move-main');
  assert.deepEqual(paneIds(tree).sort(), [MAIN_PANE, 'a', 'b'].sort());
  assert.equal(tree.ratio, .3, 'unaffected surviving split ratio is preserved');
  const same = dockPane(tree, 'a', 'a', 'left', 'invalid'); assert.equal(same, tree);
  tree = resizeSplit(tree, 'inner', 100); assert.equal(tree.ratio, .9);
  for (const width of [0, 120, 1400]) for (const height of [0, 160, 900]) {
    const boxes = splitGeometry(tree, width, height);
    for (const rect of boxes.panes.values()) assert.ok(rect.x >= 0 && rect.y >= 0 && rect.width >= 0 && rect.height >= 0 && rect.x + rect.width <= width + .001 && rect.y + rect.height <= height + .001);
  }
  const rect = { x: 0, y: 0, width: 100, height: 100 };
  assert.deepEqual([[1, 50], [99, 50], [50, 1], [50, 99]].map(([x, y]) => nearestEdge(rect, x, y)), ['left', 'right', 'top', 'bottom']);
});

test('embedded content uses host lifecycle phases and preserves each occurrence scope', () => {
  let input;
  const props = { sessionId: 'worker', useSession: selector => selector({ blank: false, awaitingFirstTurn: false, openState: 'open', running: false }),
    useConversation: selector => selector({ activeTargets: new Set() }), useSessions: selector => selector({ byId: { worker: { blank: false } } }),
    renderFactorySlot: (name, value) => { input = { name, value }; return null; } };
  SessionViewContent(props);
  assert.deepEqual(input, { name: 'conversation.content', value: { variant: 'embedded', phase: 'active', hero: false } });
});
