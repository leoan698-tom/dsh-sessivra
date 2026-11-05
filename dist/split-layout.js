export const MAIN_PANE = '$main';
export const mainLayout = () => ({ kind: 'pane', id: MAIN_PANE });
export const clampRatio = (ratio) => Number.isFinite(ratio) ? Math.max(.1, Math.min(.9, ratio)) : .5;
export function paneIds(node) {
    return node.kind === 'pane' ? [node.id] : [...paneIds(node.first), ...paneIds(node.second)];
}
export function removePane(node, id) {
    if (node.kind === 'pane')
        return node.id === id ? undefined : node;
    const first = removePane(node.first, id), second = removePane(node.second, id);
    return !first ? second : !second ? first : first === node.first && second === node.second ? node : { ...node, first, second };
}
/** Close the old main leaf and keep the promoted occurrence's exact position. */
export function promotePane(node, id) {
    if (id === MAIN_PANE || !paneIds(node).includes(id))
        return node;
    const rename = (branch) => branch.kind === 'pane'
        ? branch.id === id ? { ...branch, id: MAIN_PANE } : branch
        : { ...branch, first: rename(branch.first), second: rename(branch.second) };
    return rename(removePane(node, MAIN_PANE) ?? node);
}
// Remove the source before inserting: moving never duplicates a leaf or creates
// a self-containing branch. Collapsing its old parent preserves sibling ratios.
export function dockPane(node, source, target, edge, splitId) {
    if (source === target || !paneIds(node).includes(target))
        return node;
    const pruned = removePane(node, source) ?? node;
    const insert = (branch) => {
        if (branch.kind === 'split')
            return { ...branch, first: insert(branch.first), second: insert(branch.second) };
        if (branch.id !== target)
            return branch;
        const added = { kind: 'pane', id: source }, before = edge === 'left' || edge === 'top';
        return { kind: 'split', id: splitId, axis: edge === 'left' || edge === 'right' ? 'x' : 'y', ratio: .5,
            first: before ? added : branch, second: before ? branch : added };
    };
    return insert(pruned);
}
export function resizeSplit(node, id, ratio) {
    if (node.kind === 'pane')
        return node;
    if (node.id === id)
        return { ...node, ratio: clampRatio(ratio) };
    return { ...node, first: resizeSplit(node.first, id, ratio), second: resizeSplit(node.second, id, ratio) };
}
export function splitGeometry(node, width, height) {
    const panes = new Map();
    const dividers = [];
    const walk = (branch, rect) => {
        if (branch.kind === 'pane') {
            panes.set(branch.id, rect);
            return;
        }
        const horizontal = branch.axis === 'x', length = horizontal ? rect.width : rect.height;
        const gap = Math.min(6, length), available = Math.max(0, length - gap), first = available * clampRatio(branch.ratio);
        dividers.push({ node: branch, parent: rect, rect: horizontal ? { ...rect, x: rect.x + first, width: gap } : { ...rect, y: rect.y + first, height: gap } });
        walk(branch.first, horizontal ? { ...rect, width: first } : { ...rect, height: first });
        walk(branch.second, horizontal ? { ...rect, x: rect.x + first + gap, width: available - first } : { ...rect, y: rect.y + first + gap, height: available - first });
    };
    walk(node, { x: 0, y: 0, width: Math.max(0, width), height: Math.max(0, height) });
    return { panes, dividers };
}
export function nearestEdge(rect, x, y) {
    const nx = (x - rect.x) / Math.max(1, rect.width), ny = (y - rect.y) / Math.max(1, rect.height);
    return [['left', nx], ['right', 1 - nx], ['top', ny], ['bottom', 1 - ny]].sort((a, b) => a[1] - b[1])[0][0];
}
export function edgePreview(rect, edge) {
    return edge === 'left' ? { ...rect, width: rect.width / 2 } : edge === 'right' ? { ...rect, x: rect.x + rect.width / 2, width: rect.width / 2 }
        : edge === 'top' ? { ...rect, height: rect.height / 2 } : { ...rect, y: rect.y + rect.height / 2, height: rect.height / 2 };
}
