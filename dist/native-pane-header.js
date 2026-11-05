import { jsx as _jsx } from "react/jsx-runtime";
/** Reuse live native components under separately owned child-slot names.
 * Never redeclare a Host slot or modify its registration or render authority.
 */
export function mirrorNativePaneHeader(slots) {
    let disposed = false, queued = false;
    let cleanup = [];
    const rebuild = () => {
        if (disposed)
            return;
        cleanup.reverse().forEach(dispose => dispose());
        cleanup = [];
        const watched = new Set();
        const mirror = (source, target) => {
            if (!watched.has(source)) {
                watched.add(source);
                cleanup.push(slots.subscribe(source, () => {
                    if (queued || disposed)
                        return;
                    queued = true;
                    queueMicrotask(() => { queued = false; rebuild(); });
                }));
            }
            for (const entry of slots.entriesOfSlot(source)) {
                const children = {};
                const names = new Map();
                for (const [name, spec] of Object.entries(entry.children ?? {})) {
                    const alias = `sessivra.pane-header.${name}`;
                    names.set(name, alias);
                    children[alias] = spec;
                }
                const Component = entry.component;
                const Occurrence = (props) => {
                    const render = (method) => (name, ...args) => {
                        const alias = names.get(name);
                        if (!alias)
                            throw new Error(`Undeclared native header child: ${name}`);
                        return props[method](alias, ...args);
                    };
                    return _jsx(Component, { ...props, renderSlot: render('renderSlot'), renderSlotChain: render('renderSlotChain') });
                };
                cleanup.push(slots.register({
                    name: target, ...entry.options,
                    ...(entry.inject ? { inject: entry.inject } : {}),
                    ...(entry.store ? { store: entry.store } : {}),
                    ...(entry.locale ? { locale: entry.locale } : {}),
                    ...(entry.select ? { select: entry.select } : {}),
                    ...(names.size ? { children } : {}),
                }, Occurrence));
                for (const [name, alias] of names)
                    mirror(name, alias);
            }
        };
        mirror('conversation.header', 'sessivra.conversation.header');
    };
    rebuild();
    return () => { disposed = true; cleanup.reverse().forEach(dispose => dispose()); cleanup = []; };
}
