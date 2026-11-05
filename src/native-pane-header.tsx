import React from 'react';
import type { StoredEntry } from '@deepseek-ai/dsh-client-ui-slots';

interface HeaderSlots {
  entriesOfSlot(name: string): readonly StoredEntry[];
  subscribe(name: string, listener: () => void): () => void;
  register(options: object, component: React.ComponentType<never>): () => void;
}

/** Reuse live native components under separately owned child-slot names.
 * Never redeclare a Host slot or modify its registration or render authority.
 */
export function mirrorNativePaneHeader(slots: HeaderSlots) {
  let disposed = false, queued = false;
  let cleanup: (() => void)[] = [];
  const rebuild = () => {
    if (disposed) return;
    cleanup.reverse().forEach(dispose => dispose()); cleanup = [];
    const watched = new Set<string>();
    const mirror = (source: string, target: string) => {
      if (!watched.has(source)) {
        watched.add(source);
        cleanup.push(slots.subscribe(source, () => {
          if (queued || disposed) return;
          queued = true; queueMicrotask(() => { queued = false; rebuild(); });
        }));
      }
      for (const entry of slots.entriesOfSlot(source)) {
        const children: Record<string, NonNullable<StoredEntry['children']>[string]> = {};
        const names = new Map<string, string>();
        for (const [name, spec] of Object.entries(entry.children ?? {})) {
          const alias = `sessivra.pane-header.${name}`;
          names.set(name, alias); children[alias] = spec;
        }
        const Component = entry.component as React.ComponentType<Record<string, unknown>>;
        const Occurrence = (props: Record<string, unknown>) => {
          const render = (method: 'renderSlot' | 'renderSlotChain') => (name: string, ...args: unknown[]) => {
            const alias = names.get(name);
            if (!alias) throw new Error(`Undeclared native header child: ${name}`);
            return (props[method] as (key: string, ...args: unknown[]) => React.ReactNode)(alias, ...args);
          };
          return <Component {...props} renderSlot={render('renderSlot')} renderSlotChain={render('renderSlotChain')} />;
        };
        cleanup.push(slots.register({
          name: target, ...entry.options,
          ...(entry.inject ? { inject: entry.inject } : {}),
          ...(entry.store ? { store: entry.store } : {}),
          ...(entry.locale ? { locale: entry.locale } : {}),
          ...(entry.select ? { select: entry.select } : {}),
          ...(names.size ? { children } : {}),
        }, Occurrence));
        for (const [name, alias] of names) mirror(name, alias);
      }
    };
    mirror('conversation.header', 'sessivra.conversation.header');
  };
  rebuild();
  return () => { disposed = true; cleanup.reverse().forEach(dispose => dispose()); cleanup = []; };
}
