const storageKey = 'sessivra.turn-bookmarks.v1';
export const turnBookmarksChanged = 'sessivra:turn-bookmarks-changed';
const markSelector = '.SNx2jG_mark';
const previewSelector = '.SNx2jG_preview';
const styles = `
.sessivra-turn-bookmark{display:inline-flex;align-items:center;justify-content:center;flex:none;width:28px;height:26px;padding:0;border:0;border-radius:6px;background:transparent;color:var(--dsw-alias-label-secondary);cursor:pointer}
.sessivra-turn-bookmark:hover{background:var(--dsw-alias-interactive-bg-hover);color:var(--dsw-alias-label-primary)}
.sessivra-turn-bookmark:focus-visible{outline:2px solid var(--dsw-focus-ring-color,var(--dsw-alias-state-business-primary));outline-offset:-2px}
.sessivra-turn-bookmark svg{width:17px;height:15px;overflow:visible;fill:none;stroke:currentColor;stroke-width:1.25;stroke-linejoin:round}
.sessivra-turn-bookmark[aria-pressed=true]{color:var(--dsw-alias-state-business-primary)}
.sessivra-turn-bookmark[aria-pressed=true] svg{fill:currentColor;stroke-width:.6}
.SNx2jG_preview:has(>.sessivra-turn-bookmark){pointer-events:auto;overflow:visible}
.SNx2jG_preview:has(>.sessivra-turn-bookmark)::before{content:'';position:absolute;inset:0 100% 0 auto;width:6px}
.SNx2jG_preview:has(>.sessivra-turn-bookmark)>.SNx2jG_previewPrompt{padding-inline-end:26px}
.SNx2jG_preview>.sessivra-turn-bookmark{position:absolute;top:3px;right:4px}
[data-conversation-scroll] .SNx2jG_mark[data-sessivra-bookmarked]::before{background:var(--dsw-alias-state-business-primary);opacity:1}
[data-conversation-scroll] .SNx2jG_mark[data-sessivra-bookmarked]:not(:focus-visible)::after{content:'';position:absolute;top:calc(50% - 2px);left:10px;width:4px;height:4px;border-radius:50%;background:var(--dsw-alias-state-business-primary)}
`;
function markTurn(mark) {
    // The native virtual rail index is relative to its loaded outline, not the turn ID.
    return mark.getAttribute('aria-label')?.match(/\d+/)?.[0];
}
function loadBookmarks(win) {
    try {
        const value = JSON.parse(win.localStorage.getItem(storageKey) ?? '[]');
        return new Set(Array.isArray(value) ? value.filter((key) => typeof key === 'string') : []);
    }
    catch {
        return new Set();
    }
}
export function listTurnBookmarks(win) {
    return [...loadBookmarks(win)].reverse().flatMap(key => {
        try {
            const value = JSON.parse(key);
            if (!Array.isArray(value) || value.length !== 2 || typeof value[0] !== 'string' || !value[0] || value[0].length > 256 ||
                typeof value[1] !== 'string' || !/^\d+$/.test(value[1]))
                return [];
            const turn = Number(value[1]);
            return Number.isSafeInteger(turn) ? [{ sessionId: value[0], turn }] : [];
        }
        catch {
            return [];
        }
    });
}
/** Decorate the native rc.1 turn rail and completed-turn actions in each conversation occurrence. */
export function mountTurnBookmarks(host, fish) {
    const doc = host.ownerDocument, win = doc.defaultView;
    if (!win)
        return;
    const style = doc.createElement('style');
    style.textContent = styles;
    doc.head.append(style);
    const controls = new Map();
    let marked = new Set();
    let bookmarks = loadBookmarks(win), frame = 0;
    function toggle(key) {
        const next = loadBookmarks(win);
        if (!next.delete(key))
            next.add(key);
        try {
            win.localStorage.setItem(storageKey, JSON.stringify([...next]));
        }
        catch {
            return false;
        }
        bookmarks = next;
        scan();
        win.dispatchEvent(new Event(turnBookmarksChanged));
        return true;
    }
    function put(target, key, preview) {
        let control = controls.get(target);
        if (!control || control.key !== key || control.button.parentElement !== target) {
            control?.button.remove();
            const button = doc.createElement('button');
            button.type = 'button';
            button.className = 'sessivra-turn-bookmark';
            const svg = doc.createElementNS('http://www.w3.org/2000/svg', 'svg');
            svg.setAttribute('viewBox', `0 0 ${fish.width} ${fish.height}`);
            svg.setAttribute('aria-hidden', 'true');
            const path = doc.createElementNS(svg.namespaceURI, 'path');
            path.setAttribute('d', fish.path);
            path.setAttribute('fill-rule', 'evenodd');
            svg.append(path);
            button.append(svg);
            if (preview) {
                // Moving keyboard focus off the native mark closes its tooltip. The same
                // toggle is available on the focused mark with B and on the footer button.
                button.tabIndex = -1;
                button.addEventListener('mousedown', event => event.preventDefault());
            }
            button.addEventListener('click', event => {
                event.stopPropagation();
                if (!toggle(key))
                    button.title = '无法保存轮次收藏';
            });
            target.insertBefore(button, preview ? null : target.lastElementChild);
            control = { key, button };
            controls.set(target, control);
        }
        const pressed = bookmarks.has(key);
        control.button.setAttribute('aria-pressed', String(pressed));
        control.button.setAttribute('aria-label', pressed ? '取消收藏此轮' : '收藏此轮');
        control.button.title = pressed ? '取消收藏此轮' : '收藏此轮';
    }
    function scan() {
        const seen = new Set(), nextMarks = new Set();
        for (const chat of host.querySelectorAll('[data-conversation-content][data-conversation-session]')) {
            const session = chat.dataset.conversationSession;
            if (!session || chat.closest('[hidden], [inert]'))
                continue;
            const keyFor = (turn) => JSON.stringify([session, turn]);
            for (const mark of chat.querySelectorAll(markSelector)) {
                const turn = markTurn(mark);
                if (!turn)
                    continue;
                const key = keyFor(turn);
                nextMarks.add(mark);
                mark.toggleAttribute('data-sessivra-bookmarked', bookmarks.has(key));
                mark.setAttribute('aria-keyshortcuts', 'B');
                const previewId = mark.getAttribute('aria-describedby');
                const preview = previewId && doc.getElementById(previewId);
                if (preview && preview.matches(previewSelector) && chat.contains(preview)) {
                    seen.add(preview);
                    put(preview, key, true);
                }
            }
            for (const tail of chat.querySelectorAll('[data-turn-tail][data-actions-reveal]')) {
                const actions = tail.querySelector(':scope > [data-clock=end]');
                const turn = tail.dataset.turnTail;
                if (!actions || !turn)
                    continue;
                seen.add(actions);
                put(actions, keyFor(turn), false);
            }
        }
        for (const [target, control] of controls)
            if (!seen.has(target)) {
                control.button.remove();
                controls.delete(target);
            }
        for (const mark of marked)
            if (!nextMarks.has(mark))
                clearMark(mark);
        marked = nextMarks;
    }
    const clearMark = (mark) => {
        mark.removeAttribute('data-sessivra-bookmarked');
        mark.removeAttribute('aria-keyshortcuts');
    };
    const schedule = () => {
        if (!frame)
            frame = win.requestAnimationFrame(() => { frame = 0; scan(); });
    };
    const observer = new MutationObserver(schedule);
    observer.observe(host, { subtree: true, childList: true, attributes: true, attributeFilter: ['aria-describedby', 'data-conversation-session', 'data-turn-tail', 'data-actions-reveal', 'hidden', 'inert'] });
    const onStorage = (event) => {
        if (event.key === storageKey || event.key === null) {
            bookmarks = loadBookmarks(win);
            schedule();
        }
    };
    const onKey = (event) => {
        if (event.key.toLowerCase() !== 'b' || event.repeat || event.ctrlKey || event.altKey || event.metaKey)
            return;
        const mark = event.target instanceof Element && event.target.closest(markSelector);
        const session = mark && mark.closest('[data-conversation-content]')?.dataset.conversationSession;
        const turn = mark && markTurn(mark);
        if (session && turn && toggle(JSON.stringify([session, turn]))) {
            event.preventDefault();
            event.stopPropagation();
        }
    };
    win.addEventListener('storage', onStorage);
    host.addEventListener('keydown', onKey);
    scan();
    return () => {
        observer.disconnect();
        win.cancelAnimationFrame(frame);
        win.removeEventListener('storage', onStorage);
        host.removeEventListener('keydown', onKey);
        for (const { button } of controls.values())
            button.remove();
        marked.forEach(clearMark);
        style.remove();
    };
}
