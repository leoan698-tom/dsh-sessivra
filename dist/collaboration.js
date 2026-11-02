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
import { Remote, TypertRemoteService } from '@deepseek-ai/dsh-typert-protocol';
import { createHash, randomUUID } from 'node:crypto';
/** Display discovery is broader than navigation and messaging capabilities. */
let Collaboration = (() => {
    let _classSuper = TypertRemoteService;
    let _instanceExtraInitializers = [];
    let _tree_decorators;
    let _candidates_decorators;
    return class Collaboration extends _classSuper {
        static {
            const _metadata = typeof Symbol === "function" && Symbol.metadata ? Object.create(_classSuper[Symbol.metadata] ?? null) : void 0;
            _tree_decorators = [Remote];
            _candidates_decorators = [Remote];
            __esDecorate(this, null, _tree_decorators, { kind: "method", name: "tree", static: false, private: false, access: { has: obj => "tree" in obj, get: obj => obj.tree }, metadata: _metadata }, null, _instanceExtraInitializers);
            __esDecorate(this, null, _candidates_decorators, { kind: "method", name: "candidates", static: false, private: false, access: { has: obj => "candidates" in obj, get: obj => obj.candidates }, metadata: _metadata }, null, _instanceExtraInitializers);
            if (_metadata) Object.defineProperty(this, Symbol.metadata, { enumerable: true, configurable: true, writable: true, value: _metadata });
        }
        messenger = __runInitializers(this, _instanceExtraInitializers);
        relations;
        tail = Promise.resolve();
        constructor(ctx, messenger, relations) {
            super(ctx, 'sessionCollaboration');
            this.messenger = messenger;
            this.relations = relations;
        }
        async tree() {
            const controller = this.ctx.get('sessionController');
            const edges = this.relations.read();
            const archived = new Set(this.ctx.get('workspaceRegistry')?.archivedSessionIds ?? []);
            let items;
            if (!controller?.list) {
                const query = this.ctx.get('sessionQuery');
                if (!query)
                    throw new Error('SESSION_LIST_UNAVAILABLE');
                const sessions = await query.listSessions();
                items = sessions.map(({ header }) => ({ sessionId: header.id, parentSessionId: header.parentSession,
                    cwd: header.cwd, origin: header.origin, delegationDepth: header.delegationDepth,
                    running: this.ctx.agents.get(header.id)?.status === 'running' }));
            }
            else {
                items = (await controller.list({}, new AbortController().signal)).items;
            }
            const visible = items.filter(item => !archived.has(item.sessionId));
            const byId = new Map(visible.map(item => [item.sessionId, item]));
            const childrenByParent = new Map();
            for (const item of visible)
                if (item.origin === 'subagent' && item.parentSessionId) {
                    const siblings = childrenByParent.get(item.parentSessionId) ?? [];
                    siblings.push(item);
                    childrenByParent.set(item.parentSessionId, siblings);
                }
            const ordinary = visible.filter(item => item.origin !== 'subagent' && !(item.delegationDepth ?? 0));
            const tree = ordinary.map(item => {
                const parentId = edges[item.sessionId]?.parentId ?? item.parentSessionId;
                return { id: item.sessionId, ...(parentId ? { parentId } : {}), workspace: item.cwd ?? null,
                    label: item.projections?.values.title || edges[item.sessionId]?.label || '未命名会话',
                    running: item.running, subagent: false };
            });
            // One disposable observation per reachable Session and refresh. An unreadable
            // branch remains visible with a diagnostic; it cannot erase unrelated roots.
            const projections = new Map();
            const read = (item) => {
                let result = projections.get(item.sessionId);
                if (!result) {
                    result = this.treeProjections(item);
                    projections.set(item.sessionId, result);
                }
                return result;
            };
            const added = new Set(tree.map(row => row.id));
            const pending = ordinary.map((item, index) => ({ item, row: tree[index] }));
            for (let index = 0; index < pending.length; index++) {
                const { item: parent, row: parentRow } = pending[index];
                const parentView = await read(parent);
                if (!parentRow.subagent && parentView.values.title)
                    parentRow.label = parentView.values.title;
                const children = new Map((childrenByParent.get(parent.sessionId) ?? []).map(item => [item.sessionId, item]));
                const team = parentView.values.agentTeam;
                const members = new Map(team?.members.map(member => [member.id, member]) ?? []);
                const catalog = new Map(parentView.values.subagentCatalog?.map(entry => [entry.id, entry]) ?? []);
                // Parent catalogs retain new/external executions before a local Session is
                // listed. Roster placeholders retain provisioning/failed member identity.
                const orderedIds = new Set([...members.keys(), ...catalog.keys(), ...children.keys()]);
                for (const id of orderedIds) {
                    if (archived.has(id) || id === parent.sessionId)
                        continue;
                    const member = members.get(id);
                    if (member && member.role !== 'teammate')
                        continue;
                    const child = children.get(id);
                    // A real Session header overrides stale/conflicting catalog membership.
                    if (!child && byId.has(id))
                        continue;
                    const entry = catalog.get(id);
                    const view = child ? await read(child) : undefined;
                    const identity = view?.values.subagent;
                    const mode = identity?.mode === 'continuable' || identity?.mode === 'one-shot' ? identity.mode : !child && entry?.mode === 'external' ? 'external' : 'unknown';
                    const uncertain = parentView.failed || Boolean(team?.failure);
                    const phaseNote = member?.phase === 'failed' ? '创建失败' : member?.phase === 'provisioning' ? '创建中' : undefined;
                    const openable = Boolean(child && !view?.failed && (mode === 'continuable' || mode === 'one-shot'));
                    const canMessage = openable && mode === 'continuable' && !uncertain && (!member || member.phase === 'active');
                    // External identities need not be globally unique Session ids.
                    const nodeId = mode === 'external' ? `external:${Buffer.from(JSON.stringify([parent.sessionId, id])).toString('base64url')}` : id;
                    if (added.has(nodeId))
                        continue;
                    const row = { id: nodeId, parentId: parent.sessionId, workspace: parentRow.workspace ?? child?.cwd ?? null,
                        label: member?.name || identity?.label || entry?.label || view?.values.title || '未命名子智能体',
                        running: child?.running ?? false, subagent: true, childWorkspace: child?.cwd ?? null,
                        subagentMode: mode, openable, canMessage,
                        ...(member ? { subagentKind: 'teammate', teammateName: member.name } : { subagentKind: uncertain ? 'unknown' : 'standalone' }),
                        ...(phaseNote ? { note: phaseNote } : mode === 'external' ? { note: '外部执行' } : !openable ? { note: '历史暂不可用' } : uncertain ? { note: '归属待核对' } : mode === 'one-shot' ? { note: '只读' } : {}),
                        description: view?.values.title || identity?.label || entry?.label };
                    tree.push(row);
                    added.add(nodeId);
                    if (child)
                        pending.push({ item: child, row });
                }
            }
            const parents = new Set(tree.map(row => row.parentId));
            return tree.filter(row => row.subagent || !byId.get(row.id)?.blank || edges[row.id] || row.parentId || parents.has(row.id));
        }
        async treeProjections(item) {
            const hints = item.projections?.values ?? {};
            if (hints.agentTeam !== undefined && hints.subagentCatalog !== undefined && (item.origin !== 'subagent' || hints.subagent !== undefined))
                return { values: hints, failed: false };
            const query = this.ctx.get('sessionQuery');
            if (!query)
                return { values: hints, failed: false };
            // Missing cold list hints are prepared through Query, without resolving or
            // activating the parent/child Agent. No history is returned to the client.
            try {
                const observation = await query.observeSession(item.sessionId);
                try {
                    return { values: { ...hints, ...observation.projections?.values }, failed: false };
                }
                finally {
                    observation[Symbol.dispose]();
                }
            }
            catch {
                return { values: hints, failed: true };
            }
        }
        async candidates(sourceId, query) {
            const sessions = await this.tree();
            const source = sessions.find(session => session.id === sourceId);
            // A child may answer an admitted task, but cannot become an independent
            // cross-session sender just by using the composer picker.
            if (source?.subagent)
                return [];
            return sessions.filter(session => (!session.subagent || session.parentId === sourceId && session.canMessage) && session.id !== sourceId &&
                `${session.label} ${session.workspace ?? ''} ${session.id}`.toLocaleLowerCase().includes(query.toLocaleLowerCase()))
                .sort((a, b) => Number(b.workspace === source?.workspace) - Number(a.workspace === source?.workspace) || a.label.localeCompare(b.label, 'zh-CN')).map(session => {
                const label = session.label.replace(/[\[\]\r\n]/g, ' ').slice(0, 160);
                const cwd = session.subagent ? session.childWorkspace ?? session.workspace : session.workspace;
                const kind = session.subagent && session.subagentKind !== 'unknown' ? session.subagentKind : undefined;
                const displayTitle = kind ? `${label.slice(0, 150)} · ${kind === 'teammate' ? '队员' : '子智能体'}` : label;
                return { sessionId: session.id, label, displayTitle, ...(cwd ? { cwd } : {}),
                    ...(kind ? { kind, parentId: session.parentId } : {}), sameWorkspace: cwd === source?.workspace,
                    mention: `@[${label}](dsh-session:${Buffer.from(JSON.stringify(session.id)).toString('base64url')})` };
            });
        }
        createChild(parent, input, signal) {
            const work = this.tail.then(async () => {
                if (this.ctx.agents.get(parent.id) !== parent || !this.ctx.agents.roots().includes(parent) || parent.session.header.origin === 'subagent' || (parent.session.header.delegationDepth ?? 0) > 0)
                    throw new Error('PARENT_NOT_ACTIVE_CONVERSATION');
                signal.throwIfAborted();
                const requestKey = input.requestId && createHash('sha256').update(JSON.stringify([parent.id, input.requestId])).digest('hex');
                const sessionId = requestKey ? `session-${requestKey.slice(0, 8)}-${requestKey.slice(8, 12)}-${requestKey.slice(12, 16)}-${requestKey.slice(16, 20)}-${requestKey.slice(20, 32)}` : `session-${randomUUID()}`;
                const cwd = input.cwd ?? parent.session.header.cwd;
                if (!cwd)
                    throw new Error('CHILD_WORKSPACE_REQUIRED');
                const initialText = `${input.prompt}\n完成任务后，请向此请求发送一次关联回复。`;
                if (initialText.length > this.messenger.limits.maxLength)
                    throw new Error('CHILD_INITIAL_TASK_TOO_LONG');
                const requestHash = createHash('sha256').update(JSON.stringify([input.label, input.prompt, cwd, input.reasoningEffort ?? null])).digest('hex');
                const edges = structuredClone(this.relations.read());
                const prior = edges[sessionId];
                if (prior && (prior.parentId !== parent.id || prior.requestHash !== requestHash))
                    throw new Error('CHILD_REQUEST_ID_CONFLICT');
                const messageId = `initial-${sessionId}`;
                const previousMessage = this.messenger.snapshot(false).messages[messageId];
                if (previousMessage) {
                    const receipt = this.messenger.status(parent, messageId);
                    return { id: sessionId, parentId: parent.id, kind: 'conversation', reused: true, status: receipt.status, ...(receipt.reason ? { reason: receipt.reason } : {}), messageId, ...(input.reasoningEffort ? { reasoningEffort: input.reasoningEffort } : {}) };
                }
                // Reserve the exact identity before the Host create. An ambiguous create
                // can then be retried by requestId without minting another conversation.
                if (!prior) {
                    edges[sessionId] = { parentId: parent.id, label: input.label, createdAt: Date.now(), requestHash };
                    await this.relations.write(edges);
                }
                const controller = this.ctx.get('sessionController');
                let created = Boolean(this.ctx.agents.list().find(agent => agent.id === sessionId));
                try {
                    if (!created) {
                        if (controller) {
                            // A retry may find a cold, already-created conversation. Inspect
                            // without activation, then resolve only this explicitly reused ID.
                            const stored = prior && await this.ctx.get('sessionPersistence')?.stat(sessionId, { signal });
                            if (stored) {
                                const resolved = await controller.resolveAgent(sessionId);
                                if ('error' in resolved)
                                    throw resolved.error;
                            }
                            else {
                                const result = await controller.create({ sessionId, cwd });
                                if (result.sessionId !== sessionId)
                                    throw new Error(`CHILD_ID_CHANGED:${result.sessionId}`);
                            }
                        }
                        else {
                            await this.ctx.agents.create({ sessionId: sessionId, agentOptions: { ...parent.options, ...(input.reasoningEffort ? { reasoningEffort: input.reasoningEffort } : {}) }, meta: { cwd } });
                        }
                        created = true;
                    }
                    if (input.reasoningEffort && !this.ctx.agents.list().find(agent => agent.id === sessionId)?.session.requestHeader()) {
                        const child = this.ctx.agents.list().find(agent => agent.id === sessionId);
                        if (!child || child.session.requestHeader())
                            throw new Error('CHILD_EFFORT_MUST_PRECEDE_FIRST_REQUEST');
                        const effort = input.reasoningEffort;
                        const provider = child.options.provider, model = child.options.model;
                        if (!provider || !model)
                            throw new Error('CHILD_MODEL_ROUTE_UNAVAILABLE');
                        const resolved = await this.ctx.llm.resolveCallConfig({ provider, model, reasoningEffort: effort });
                        if (resolved.reasoningEffort !== effort)
                            throw new Error('CHILD_EFFORT_NOT_ACCEPTED');
                        // Durable Session-local intent. Do not call controller.selectModel:
                        // rc.5 also saves that selection as the profile-wide default.
                        child.session.append('model/selection', { provider, model, reasoningEffort: effort });
                        // The desktop controller has already cached its initial default. A
                        // public Agent-scoped waterfall supplies the requested effort until
                        // the first header is committed. Later requests use that header and
                        // remain free to follow a subsequent user model selection.
                        const dispose = child.ctx.on('agent/request', async (_payload, next) => {
                            const config = await next();
                            if (child.session.requestHeader()) {
                                dispose();
                                return config;
                            }
                            return { ...config, reasoningEffort: effort };
                        }, { prepend: true });
                        this.ctx.effect(() => dispose);
                    }
                    if (controller)
                        await controller.rename({ sessionId, title: input.label });
                    const selection = await this.messenger.selectRecipient(parent, sessionId, input.label);
                    const receipt = await this.messenger.send(parent, { id: messageId, target: sessionId, selectionRevision: selection.revision,
                        text: initialText }, signal);
                    return { id: sessionId, parentId: parent.id, kind: 'conversation', reused: Boolean(prior), status: receipt.status, messageId: receipt.id, ...(input.reasoningEffort ? { reasoningEffort: input.reasoningEffort } : {}) };
                }
                catch (error) {
                    return { id: sessionId, parentId: parent.id, kind: 'conversation', created, reused: Boolean(prior), status: 'not-confirmed', messageId,
                        error: error instanceof Error ? error.message.slice(0, 400) : 'CHILD_CREATION_OR_INITIAL_TASK_FAILED',
                        recovery: 'Keep this id. Retry the same requestId and arguments, or inspect the existing conversation. Do not mint a replacement automatically.' };
                }
            });
            this.tail = work.catch(() => { });
            return work;
        }
        async close() { await this.tail; }
    };
})();
export { Collaboration };
