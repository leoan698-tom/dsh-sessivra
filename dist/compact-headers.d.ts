import React from 'react';
import type { Menu as HostMenu } from '@deepseek-ai/dsh-client-ui-primitives';
import type { HeaderViews } from './header-views.js';
/** Keep native title/actions and tab click handlers; only move view selection into a compact menu. */
export declare function CompactHeaders({ host, Menu, labelFor, close, headerViews, current }: {
    host: HTMLElement;
    Menu: typeof HostMenu;
    labelFor(id: string): string;
    close(id: string): void;
    headerViews: HeaderViews;
    current?: string;
}): React.JSX.Element;
