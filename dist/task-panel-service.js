var __runInitializers = (this && this.__runInitializers) || function (thisArg, initializers, value) {
    var useValue = arguments.length > 2;
    for (var i = 0; i < initializers.length; i++) {
        value = useValue ? initializers[i].call(thisArg, value) : initializers[i].call(thisArg);
    }
    return useValue ? value : void 0;
};
var __esDecorate = (this && this.__esDecorate) || function (ctor, descriptorIn, decorators, contextIn, initializers, extraInitializers) {
    function accept(f) { if (f !== void 0 && typeof f !== "function") throw new TypeError("Function expected"); return f; }
    var kind = contextIn.kind, key = kind === "getter" ? "get" : kind === "setter" ? "set" : "value";
    var target = !descriptorIn && ctor ? contextIn["static"] ? ctor : ctor.prototype : null;
    var descriptor = descriptorIn || (target ? Object.getOwnPropertyDescriptor(target, contextIn.name) : {});
    var _, done = false;
    for (var i = decorators.length - 1; i >= 0; i--) {
        var context = {};
        for (var p in contextIn) context[p] = p === "access" ? {} : contextIn[p];
        for (var p in contextIn.access) context.access[p] = contextIn.access[p];
        context.addInitializer = function (f) { if (done) throw new TypeError("Cannot add initializers after decoration has completed"); extraInitializers.push(accept(f || null)); };
        var result = (0, decorators[i])(kind === "accessor" ? { get: descriptor.get, set: descriptor.set } : descriptor[key], context);
        if (kind === "accessor") {
            if (result === void 0) continue;
            if (result === null || typeof result !== "object") throw new TypeError("Object expected");
            if (_ = accept(result.get)) descriptor.get = _;
            if (_ = accept(result.set)) descriptor.set = _;
            if (_ = accept(result.init)) initializers.unshift(_);
        }
        else if (_ = accept(result)) {
            if (kind === "field") initializers.unshift(_);
            else descriptor[key] = _;
        }
    }
    if (target) Object.defineProperty(target, contextIn.name, descriptor);
    done = true;
};
import { taskFiles } from './task-files.js';
import { Remote, TypertRemoteService } from '@deepseek-ai/dsh-typert-protocol';
import { extname, isAbsolute, relative, resolve, sep } from 'node:path';
import { open, realpath, stat } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { MessageHistory, bookmarkedTurn, bookmarkedTurnNumbers, legacyBookmarkQuote, messageLocation, messageOrigin, readBookmarkedTurns, readBookmarkReference, readMessageOrigin } from './message-history.js';
import { workspace } from './core.js';
import { taskIdFor } from './tasks.js';
import { panelCommand, panelQuery } from './panel-contract.js';
import { isRepositoryAgent, managedBySuperagent, requireSessivraSession } from './session-ownership.js';
export const labels = {
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
let SessivraPanel = (() => {
    let _classSuper = TypertRemoteService;
    let _instanceExtraInitializers = [];
    let _searchHistory_decorators;
    let _locateMessage_decorators;
    let _bookmarkedTurns_decorators;
    let _bookmarkReference_decorators;
    let _locateLegacyBookmark_decorators;
    let _participants_decorators;
    let _list_decorators;
    let _operation_decorators;
    let _preview_decorators;
    let _detail_decorators;
    let _command_decorators;
    return class SessivraPanel extends _classSuper {
        static {
            const _metadata = typeof Symbol === "function" && Symbol.metadata ? Object.create(_classSuper[Symbol.metadata] ?? null) : void 0;
            _searchHistory_decorators = [Remote];
            _locateMessage_decorators = [Remote];
            _bookmarkedTurns_decorators = [Remote];
            _bookmarkReference_decorators = [Remote];
            _locateLegacyBookmark_decorators = [Remote];
            _participants_decorators = [Remote];
            _list_decorators = [Remote];
            _operation_decorators = [Remote];
            _preview_decorators = [Remote];
            _detail_decorators = [Remote];
            _command_decorators = [Remote];
            __esDecorate(this, null, _searchHistory_decorators, { kind: "method", name: "searchHistory", static: false, private: false, access: { has: obj => "searchHistory" in obj, get: obj => obj.searchHistory }, metadata: _metadata }, null, _instanceExtraInitializers);
            __esDecorate(this, null, _locateMessage_decorators, { kind: "method", name: "locateMessage", static: false, private: false, access: { has: obj => "locateMessage" in obj, get: obj => obj.locateMessage }, metadata: _metadata }, null, _instanceExtraInitializers);
            __esDecorate(this, null, _bookmarkedTurns_decorators, { kind: "method", name: "bookmarkedTurns", static: false, private: false, access: { has: obj => "bookmarkedTurns" in obj, get: obj => obj.bookmarkedTurns }, metadata: _metadata }, null, _instanceExtraInitializers);
            __esDecorate(this, null, _bookmarkReference_decorators, { kind: "method", name: "bookmarkReference", static: false, private: false, access: { has: obj => "bookmarkReference" in obj, get: obj => obj.bookmarkReference }, metadata: _metadata }, null, _instanceExtraInitializers);
            __esDecorate(this, null, _locateLegacyBookmark_decorators, { kind: "method", name: "locateLegacyBookmark", static: false, private: false, access: { has: obj => "locateLegacyBookmark" in obj, get: obj => obj.locateLegacyBookmark }, metadata: _metadata }, null, _instanceExtraInitializers);
            __esDecorate(this, null, _participants_decorators, { kind: "method", name: "participants", static: false, private: false, access: { has: obj => "participants" in obj, get: obj => obj.participants }, metadata: _metadata }, null, _instanceExtraInitializers);
            __esDecorate(this, null, _list_decorators, { kind: "method", name: "list", static: false, private: false, access: { has: obj => "list" in obj, get: obj => obj.list }, metadata: _metadata }, null, _instanceExtraInitializers);
            __esDecorate(this, null, _operation_decorators, { kind: "method", name: "operation", static: false, private: false, access: { has: obj => "operation" in obj, get: obj => obj.operation }, metadata: _metadata }, null, _instanceExtraInitializers);
            __esDecorate(this, null, _preview_decorators, { kind: "method", name: "preview", static: false, private: false, access: { has: obj => "preview" in obj, get: obj => obj.preview }, metadata: _metadata }, null, _instanceExtraInitializers);
            __esDecorate(this, null, _detail_decorators, { kind: "method", name: "detail", static: false, private: false, access: { has: obj => "detail" in obj, get: obj => obj.detail }, metadata: _metadata }, null, _instanceExtraInitializers);
            __esDecorate(this, null, _command_decorators, { kind: "method", name: "command", static: false, private: false, access: { has: obj => "command" in obj, get: obj => obj.command }, metadata: _metadata }, null, _instanceExtraInitializers);
            if (_metadata) Object.defineProperty(this, Symbol.metadata, { enumerable: true, configurable: true, writable: true, value: _metadata });
        }
        tasks = __runInitializers(this, _instanceExtraInitializers);
        collaboration;
        messenger;
        history;
        constructor(ctx, tasks, collaboration, messenger) {
            super(ctx, 'sessivraTaskPanel');
            this.tasks = tasks;
            this.collaboration = collaboration;
            this.messenger = messenger;
            this.history = new MessageHistory(ctx);
            ctx.effect(() => () => this.history.close());
        }
        owner() {
            if (this.ctx.invocation?.peer.principal.kind !== 'owner')
                throw new Error('PANEL_OWNER_REQUIRED');
        }
        async searchHistory(query) {
            this.owner();
            return this.history.search(query);
        }
        async locateMessage(location, expectedId) {
            this.owner();
            return readMessageOrigin(this.ctx, messageLocation.parse(location), expectedId || undefined);
        }
        async bookmarkedTurns(sessionId, turns) {
            this.owner();
            return readBookmarkedTurns(this.ctx, sessionId, bookmarkedTurnNumbers.parse(turns));
        }
        async bookmarkReference(origin, turn) {
            this.owner();
            return readBookmarkReference(this.ctx, messageOrigin.parse(origin), bookmarkedTurn.parse(turn));
        }
        async locateLegacyBookmark(quote) {
            this.owner();
            return this.history.locateLegacyBookmark(legacyBookmarkQuote.parse(quote));
        }
        async header(id) {
            const live = this.tasks.transport.live(id);
            if (live)
                return live.session.header;
            const storage = this.ctx.get('sessionPersistence');
            if (storage)
                return (await storage.stat(id))?.header;
            return (await this.ctx.get('sessionController')?.inspect?.(id))?.meta;
        }
        async participants() {
            this.owner();
            const sessions = await this.collaboration.tree();
            const byId = new Map(sessions.map((s) => [s.id, s]));
            const excluded = new Set();
            await Promise.all(sessions.map(async (session) => {
                const header = await this.header(session.id).catch(() => null);
                if (!header || managedBySuperagent(header))
                    excluded.add(session.id);
            }));
            return sessions
                .filter((s) => {
                const seen = new Set();
                let parent = s;
                while (parent && !seen.has(parent.id)) {
                    if (excluded.has(parent.id) || isRepositoryAgent(parent.id) || isRepositoryAgent(parent.parentId))
                        return false;
                    seen.add(parent.id);
                    parent = parent.parentId ? byId.get(parent.parentId) : undefined;
                }
                return !s.subagent || s.canMessage;
            })
                .map((s) => ({
                id: s.id,
                label: s.label,
                workspace: workspace(s.workspace),
                child: s.subagent,
                parent: s.parentId ?? null,
            }));
        }
        list(raw) {
            this.owner();
            const q = panelQuery.parse(raw);
            const active = this.tasks.panelTasks();
            const rows = q.view === 'history' ? this.tasks.panelHistory().map(({ task }) => task) : active;
            const scopeNames = new Map();
            for (const task of [...active, ...(q.view === 'history' ? rows : [])]) {
                if (!scopeNames.has(task.scopeId) || task.scopeLabel)
                    scopeNames.set(task.scopeId, {
                        id: task.scopeId,
                        label: task.scopeLabel ?? task.title,
                        coordinator: task.coordinator.id,
                    });
            }
            const groups = [...scopeNames.values()];
            const scopes = [...new Set(rows.map((t) => t.coordinator.cwd))];
            const directory = workspace(q.workspace);
            const filtered = rows.filter((t) => (!directory || t.coordinator.cwd === directory) &&
                (!q.coordinator || q.coordinator === t.coordinator.id) &&
                (!q.assignee || q.assignee === t.assignee.id) &&
                (!q.scope || q.scope === t.scopeId) &&
                (!q.status || q.status === t.status) &&
                (!q.search ||
                    [t.title, t.goal, t.id, t.scopeLabel].some((s) => s?.toLowerCase().includes(q.search.toLowerCase()))));
            const allowed = new Set(filtered.map((t) => t.id));
            const attention = [];
            const seen = new Set();
            for (const t of active.filter((t) => allowed.has(t.id) && !['completed', 'cancelled', 'failed'].includes(t.status))) {
                for (const question of t.questions)
                    if (!question.mergedInto && question.status !== 'resolved' && !seen.has(question.id)) {
                        seen.add(question.id);
                        attention.push({
                            key: question.id,
                            taskId: t.id,
                            kind: '待回答',
                            title: question.question,
                            affected: question.taskIds,
                        });
                    }
                const kind = t.uncertain
                    ? '投递不确定'
                    : t.status === 'review'
                        ? '待验收'
                        : t.status === 'blocked'
                            ? '受阻'
                            : t.appliedRevision > 0 && !t.adopted
                                ? '待同步'
                                : undefined;
                if (kind)
                    attention.push({ key: t.id, taskId: t.id, kind, title: t.title, affected: [t.id] });
            }
            const needsAction = new Set(attention.flatMap((entry) => entry.affected));
            const key = (t) => ({
                priority: q.sort !== 'recent' && needsAction.has(t.id) ? 0 : 1,
                updatedAt: t.updatedAt,
                id: t.id,
            });
            const compare = (a, b) => a.priority - b.priority || b.updatedAt - a.updatedAt || a.id.localeCompare(b.id);
            const sorted = filtered.sort((a, b) => compare(key(a), key(b)));
            const after = q.cursor ? sorted.filter((entry) => compare(key(entry), q.cursor) > 0) : sorted;
            const page = after.slice(0, 40);
            return {
                attention,
                groups,
                workspaces: scopes,
                total: sorted.length,
                next: after.length > page.length ? key(page[page.length - 1]) : null,
                items: page.map((t) => ({
                    id: t.id,
                    title: t.title,
                    status: t.status,
                    label: labels[t.status],
                    coordinator: t.coordinator.id,
                    assignee: t.assignee.id,
                    updatedAt: t.updatedAt,
                    revision: t.revision,
                    appliedRevision: t.appliedRevision,
                    wait: 'queueReason' in t ? t.queueReason : null,
                })),
            };
        }
        operation(id) {
            this.owner();
            return this.tasks.panelOperation(id);
        }
        async preview(id, index) {
            this.owner();
            const task = this.tasks.panelLookup(id);
            if (!task)
                throw new Error('TASK_NOT_FOUND');
            await this.tasks.transport.validate(task);
            const artifact = taskFiles(task)[index];
            if (!artifact)
                throw new Error('该产物记录已更新，请重新打开详情');
            const inside = (directory, path) => {
                const name = relative(directory, path);
                return !!name && !isAbsolute(name) && name !== '..' && !name.startsWith('..' + sep);
            };
            const path = resolve(task.assignee.cwd, artifact);
            if (!inside(task.assignee.cwd, path) ||
                !/^\.(txt|md|markdown|csv|json|yaml|yml|log|diff|patch|js|ts|tsx|py|css|html)$/i.test(extname(path)))
                throw new Error('此产物请在原执行会话或工作目录中查看');
            const [root, actual] = await Promise.all([realpath(task.assignee.cwd), realpath(path)]);
            if (!inside(root, actual) || !(await stat(actual)).isFile())
                throw new Error('仅可预览执行目录中的普通文件');
            const handle = await open(actual, 'r');
            try {
                const limit = 32 * 1024;
                const info = await handle.stat();
                if (!info.isFile())
                    throw new Error('仅可预览普通文件');
                const bytes = Buffer.alloc(limit);
                const { bytesRead } = await handle.read(bytes, 0, limit, 0);
                if (bytes.subarray(0, bytesRead).includes(0))
                    throw new Error('此文件请在原工作目录中查看');
                return { name: artifact, text: bytes.toString('utf8', 0, bytesRead), truncated: info.size > bytesRead };
            }
            finally {
                await handle.close();
            }
        }
        detail(id) {
            this.owner();
            const live = this.tasks.panelDetail(id);
            if (live)
                return live;
            const archive = this.tasks.archivedTask(id);
            if (!archive)
                throw new Error('TASK_NOT_FOUND');
            return {
                ...archive.task,
                questions: archive.questions,
                deliveries: archive.events,
                archivedAt: archive.archivedAt,
                actions: [],
                token: '',
                runtime: '历史',
                uncertain: false,
                queueReason: null,
                adopted: archive.task.revision === archive.task.appliedRevision,
            };
        }
        async coordinator(id) {
            requireSessivraSession(id);
            const live = this.tasks.transport.live(id);
            if (live) {
                this.tasks.transport.caller(live);
                return live;
            }
            const meta = await this.header(id);
            if (meta && managedBySuperagent(meta))
                throw new Error('SUPERAGENT_OWNS_SESSION');
            const controller = this.ctx.get('sessionController');
            if (!controller)
                throw new Error('TASK_SESSION_CONTROLLER_UNAVAILABLE');
            const result = await controller.resolveAgent(id);
            if ('error' in result)
                throw result.error;
            const resumed = this.tasks.transport.live(id);
            if (!resumed)
                throw new Error('TASK_SESSION_UNAVAILABLE');
            return resumed;
        }
        async create(c, fingerprint) {
            if (c.assignee)
                requireSessivraSession(c.assignee);
            if (!!c.coordinator === !!c.coordinatorDirectory)
                throw new Error('CHOOSE_ONE_COORDINATOR');
            for (const directory of [c.coordinatorDirectory, c.cwd]) {
                if (directory && (!isAbsolute(directory) || !(await stat(directory).catch(() => null))?.isDirectory()))
                    throw new Error('请选择存在的绝对工作目录');
            }
            const coordinatorId = c.coordinator ?? 'sessivra-coordinator-' + c.operationId;
            const requestId = 'panel-' + c.operationId;
            const id = taskIdFor(coordinatorId, requestId);
            const previous = this.tasks.panelLookup(id);
            if (previous) {
                if (previous.panelReceipts?.[requestId] !== fingerprint)
                    throw new Error('TASK_REQUEST_ID_CONFLICT');
                return { id };
            }
            if (c.origin)
                await readMessageOrigin(this.ctx, c.origin, c.origin.messageId);
            if (c.coordinatorDirectory) {
                const controller = this.ctx.get('sessionController');
                if (!controller)
                    throw new Error('TASK_SESSION_CONTROLLER_UNAVAILABLE');
                const known = await this.header(coordinatorId);
                if (known && known.cwd !== c.coordinatorDirectory)
                    throw new Error('TASK_REQUEST_ID_CONFLICT');
                if (!known) {
                    const created = await controller.create({ sessionId: coordinatorId, cwd: c.coordinatorDirectory });
                    if (created.sessionId !== coordinatorId)
                        throw new Error('TASK_COORDINATOR_ID_CHANGED');
                    await controller.rename({ sessionId: coordinatorId, title: '协调 · ' + c.title });
                }
            }
            const owner = await this.coordinator(coordinatorId);
            this.tasks.transport.caller(owner);
            const assign = (target) => this.tasks.assign(owner, {
                requestId,
                target,
                title: c.title,
                goal: c.goal,
                acceptance: c.acceptance,
                scope: c.scope ?? requestId,
                resources: c.resources,
                requiredQuestions: c.requiredQuestions,
                ...(c.origin ? { origin: c.origin } : {}),
            }, { scopeLabel: c.scopeLabel, fingerprint });
            if (c.assignee) {
                await this.messenger.selectRecipient(owner, c.assignee, c.title, requestId, false);
                await assign(c.assignee);
            }
            else {
                const child = await this.collaboration.createChild(owner, { requestId, label: c.title, prompt: c.goal, cwd: c.cwd, reasoningEffort: c.reasoningEffort }, new AbortController().signal, async (target) => {
                    const t = await assign(target);
                    return { id: t.id, taskId: t.id, status: t.status };
                }, false);
                if (child.status === 'not-confirmed')
                    throw new Error('CHILD_CREATION_NOT_CONFIRMED: ' + child.id + (child.error ? ': ' + child.error : ''));
            }
            return { id };
        }
        async command(raw) {
            this.owner();
            const c = panelCommand.parse(raw);
            const fingerprint = createHash('sha256').update(JSON.stringify(c)).digest('hex');
            if (c.action === 'create')
                return this.create(c, fingerprint);
            const op = { taskId: c.taskId, operationId: c.operationId, expected: c.expected, fingerprint };
            if (c.action === 'archive') {
                await this.tasks.archiveTask(op);
                return { id: c.taskId };
            }
            const t = this.tasks.panelLookup(c.taskId);
            if (!t)
                throw new Error('TASK_NOT_FOUND');
            const owner = await this.coordinator(t.coordinator.id);
            switch (c.action) {
                case 'update':
                    await this.tasks.update(owner, { ...c, revision: t.revision }, op);
                    break;
                case 'answer':
                    await this.tasks.decide(owner, { ...c, authority: 'user' }, op);
                    break;
                case 'review':
                    await this.tasks.review(owner, { ...c, revision: t.revision, decisionRevision: t.decisionRevision }, op);
                    break;
                case 'reconcile':
                    await this.tasks.reconcile(owner, t.id, op);
                    break;
                default:
                    if (!('reason' in c))
                        throw new Error('TASK_ACTION_UNAVAILABLE');
                    await this.tasks.control(owner, { taskId: t.id, revision: t.revision, action: c.action, reason: c.reason }, op);
            }
            return { id: t.id };
        }
    };
})();
export { SessivraPanel };
