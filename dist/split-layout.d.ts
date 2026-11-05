export declare const MAIN_PANE = "$main";
export type Edge = 'left' | 'right' | 'top' | 'bottom';
export type SplitLayout = {
    kind: 'pane';
    id: string;
} | {
    kind: 'split';
    id: string;
    axis: 'x' | 'y';
    ratio: number;
    first: SplitLayout;
    second: SplitLayout;
};
export interface Rect {
    x: number;
    y: number;
    width: number;
    height: number;
}
export declare const mainLayout: () => SplitLayout;
export declare const clampRatio: (ratio: number) => number;
export declare function paneIds(node: SplitLayout): string[];
export declare function removePane(node: SplitLayout, id: string): SplitLayout | undefined;
/** Close the old main leaf and keep the promoted occurrence's exact position. */
export declare function promotePane(node: SplitLayout, id: string): SplitLayout;
export declare function dockPane(node: SplitLayout, source: string, target: string, edge: Edge, splitId: string): SplitLayout;
export declare function resizeSplit(node: SplitLayout, id: string, ratio: number): SplitLayout;
export declare function splitGeometry(node: SplitLayout, width: number, height: number): {
    panes: Map<string, Rect>;
    dividers: {
        node: Extract<SplitLayout, {
            kind: "split";
        }>;
        rect: Rect;
        parent: Rect;
    }[];
};
export declare function nearestEdge(rect: Rect, x: number, y: number): Edge;
export declare function edgePreview(rect: Rect, edge: Edge): Rect;
