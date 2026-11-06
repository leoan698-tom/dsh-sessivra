import React from 'react';
declare const paths: {
    mark: string;
    plus: string;
    inbox: string;
    list: string;
    archive: string;
    search: string;
    filter: string;
    check: string;
    file: string;
    chevron: string;
    close: string;
    back: string;
    group: string;
    chat: string;
    clock: string;
    folder: string;
    external: string;
    warn: string;
};
export declare function Icon({ name, size }: {
    name: keyof typeof paths;
    size?: number;
}): React.JSX.Element;
export declare function Pill({ label, status }: {
    label: string;
    status: string;
}): React.JSX.Element;
export declare function when(at: number, compact?: boolean): string;
export {};
