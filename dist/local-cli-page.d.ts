import React from 'react';
import type { TaskPanelApi } from './task-panel.js';
export declare function LocalCliPage({ api }: {
    api: Pick<TaskPanelApi, 'cliStatus' | 'refreshCliStatus' | 'cliLogin'>;
}): React.JSX.Element;
