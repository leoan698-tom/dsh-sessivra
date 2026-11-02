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
import { policyInput } from './schemas.js';
/** Only authenticated Host operator UI; no corresponding model tool. */
let MessengerSettings = (() => {
    let _classSuper = TypertRemoteService;
    let _instanceExtraInitializers = [];
    let _view_decorators;
    let _selectedFor_decorators;
    let _selectRecipient_decorators;
    let _authorizeSelected_decorators;
    let _revokeSelected_decorators;
    let _clearSelected_decorators;
    let _setDeliveryMode_decorators;
    let _sendOperator_decorators;
    let _conversation_decorators;
    let _policy_decorators;
    let _release_decorators;
    let _backup_decorators;
    let _clear_decorators;
    return class MessengerSettings extends _classSuper {
        static {
            const _metadata = typeof Symbol === "function" && Symbol.metadata ? Object.create(_classSuper[Symbol.metadata] ?? null) : void 0;
            _view_decorators = [Remote];
            _selectedFor_decorators = [Remote];
            _selectRecipient_decorators = [Remote];
            _authorizeSelected_decorators = [Remote];
            _revokeSelected_decorators = [Remote];
            _clearSelected_decorators = [Remote];
            _setDeliveryMode_decorators = [Remote];
            _sendOperator_decorators = [Remote];
            _conversation_decorators = [Remote];
            _policy_decorators = [Remote];
            _release_decorators = [Remote];
            _backup_decorators = [Remote];
            _clear_decorators = [Remote];
            __esDecorate(this, null, _view_decorators, { kind: "method", name: "view", static: false, private: false, access: { has: obj => "view" in obj, get: obj => obj.view }, metadata: _metadata }, null, _instanceExtraInitializers);
            __esDecorate(this, null, _selectedFor_decorators, { kind: "method", name: "selectedFor", static: false, private: false, access: { has: obj => "selectedFor" in obj, get: obj => obj.selectedFor }, metadata: _metadata }, null, _instanceExtraInitializers);
            __esDecorate(this, null, _selectRecipient_decorators, { kind: "method", name: "selectRecipient", static: false, private: false, access: { has: obj => "selectRecipient" in obj, get: obj => obj.selectRecipient }, metadata: _metadata }, null, _instanceExtraInitializers);
            __esDecorate(this, null, _authorizeSelected_decorators, { kind: "method", name: "authorizeSelected", static: false, private: false, access: { has: obj => "authorizeSelected" in obj, get: obj => obj.authorizeSelected }, metadata: _metadata }, null, _instanceExtraInitializers);
            __esDecorate(this, null, _revokeSelected_decorators, { kind: "method", name: "revokeSelected", static: false, private: false, access: { has: obj => "revokeSelected" in obj, get: obj => obj.revokeSelected }, metadata: _metadata }, null, _instanceExtraInitializers);
            __esDecorate(this, null, _clearSelected_decorators, { kind: "method", name: "clearSelected", static: false, private: false, access: { has: obj => "clearSelected" in obj, get: obj => obj.clearSelected }, metadata: _metadata }, null, _instanceExtraInitializers);
            __esDecorate(this, null, _setDeliveryMode_decorators, { kind: "method", name: "setDeliveryMode", static: false, private: false, access: { has: obj => "setDeliveryMode" in obj, get: obj => obj.setDeliveryMode }, metadata: _metadata }, null, _instanceExtraInitializers);
            __esDecorate(this, null, _sendOperator_decorators, { kind: "method", name: "sendOperator", static: false, private: false, access: { has: obj => "sendOperator" in obj, get: obj => obj.sendOperator }, metadata: _metadata }, null, _instanceExtraInitializers);
            __esDecorate(this, null, _conversation_decorators, { kind: "method", name: "conversation", static: false, private: false, access: { has: obj => "conversation" in obj, get: obj => obj.conversation }, metadata: _metadata }, null, _instanceExtraInitializers);
            __esDecorate(this, null, _policy_decorators, { kind: "method", name: "policy", static: false, private: false, access: { has: obj => "policy" in obj, get: obj => obj.policy }, metadata: _metadata }, null, _instanceExtraInitializers);
            __esDecorate(this, null, _release_decorators, { kind: "method", name: "release", static: false, private: false, access: { has: obj => "release" in obj, get: obj => obj.release }, metadata: _metadata }, null, _instanceExtraInitializers);
            __esDecorate(this, null, _backup_decorators, { kind: "method", name: "backup", static: false, private: false, access: { has: obj => "backup" in obj, get: obj => obj.backup }, metadata: _metadata }, null, _instanceExtraInitializers);
            __esDecorate(this, null, _clear_decorators, { kind: "method", name: "clear", static: false, private: false, access: { has: obj => "clear" in obj, get: obj => obj.clear }, metadata: _metadata }, null, _instanceExtraInitializers);
            if (_metadata) Object.defineProperty(this, Symbol.metadata, { enumerable: true, configurable: true, writable: true, value: _metadata });
        }
        messenger = __runInitializers(this, _instanceExtraInitializers);
        constructor(ctx, messenger) {
            super(ctx, 'sessionMessenger');
            this.messenger = messenger;
        }
        async view() { await this.messenger.sweep(); return { directory: this.messenger.directory().map(r => ({ ...r, policy: this.messenger.inspectPolicy(r.id) })), state: this.messenger.snapshot(false), limits: this.messenger.limits }; }
        selectedFor(sourceId) { return this.messenger.selectedFor(sourceId); }
        selectRecipient(sourceId, targetId, label) { return this.messenger.selectRecipientById(sourceId, targetId, label); }
        authorizeSelected(sourceId, revision) { return this.messenger.authorizeSelected(sourceId, revision); }
        revokeSelected(sourceId, revision) { return this.messenger.revokeSelected(sourceId, revision); }
        clearSelected(sourceId) { return this.messenger.clearSelected(sourceId); }
        setDeliveryMode(sourceId, revision, mode) { return this.messenger.setDeliveryMode(sourceId, revision, mode); }
        sendOperator(sourceId, input) { return this.messenger.sendOperator(sourceId, input); }
        async conversation(sourceId, targetId) {
            await this.messenger.sweep();
            const messages = this.messenger.snapshot(true).messages;
            return Object.values(messages).filter(m => (m.origin === 'operator' && m.sourceRoot === sourceId && m.target === targetId) || (m.status === 'received' && m.sourceRoot === sourceId && m.sender === targetId && m.replyTo && messages[m.replyTo]?.origin === 'operator' && messages[m.replyTo]?.sourceRoot === sourceId && messages[m.replyTo]?.target === targetId)).sort((a, b) => a.created - b.created);
        }
        policy(id, input) { return this.messenger.setPolicy(id, policyInput.parse(input)); }
        release(id) { return this.messenger.release(id); }
        backup(includeText) { if (typeof includeText !== 'boolean')
            throw new Error('INVALID_REQUEST'); return this.messenger.snapshot(includeText); }
        clear(confirmation) { if (confirmation !== 'DELETE MESSENGER DATA')
            throw new Error('CONFIRMATION_REQUIRED'); return this.messenger.clear(); }
    };
})();
export { MessengerSettings };
