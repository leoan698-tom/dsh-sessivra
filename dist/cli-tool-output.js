const language = 'sessivra-output';
const codeBlock = '.md-code-block';
const content = '[data-code-block-content]';
export function formatCliToolOutput(title, output) {
    const label = title.replace(/[\r\n]/gu, ' ').replace(/[\\`*_{}\[\]()<>!~]/gu, '\\$&');
    if (!output)
        return `\n\n**${label}**\n\n`;
    let length = 3;
    for (const run of output.matchAll(/~{3,}/gu))
        length = Math.max(length, run[0].length + 1);
    const fence = '~'.repeat(length);
    let format = language;
    if (/^\s*[{[]/u.test(output)) {
        try {
            JSON.parse(output);
            format = 'json';
        }
        catch { /* Keep CLI output verbatim. */ }
    }
    return `\n\n**${label}**\n\n${fence}${format}\n${output}\n${fence}\n\n`;
}
export function installCliToolOutput(doc) {
    const style = doc.createElement('style');
    style.textContent = `
    .md-code-block[data-sessivra-cli-output] [data-code-block-content] { max-height: 280px; overflow: auto; }
    .md-code-block[data-sessivra-cli-output="closed"] [data-code-block-content] { display: none; }
    .md-code-block .sessivra-cli-output-toggle { cursor: pointer; }
    .md-code-block .sessivra-cli-output-fallback { border: 0; background: transparent; color: inherit; display: inline-grid; place-items: center; width: 28px; height: 28px; }
    .md-code-block .sessivra-cli-output-toggle[aria-expanded="true"] svg { transform: rotate(180deg); }
  `;
    doc.head.append(style);
    const watched = new Map();
    const prepare = (block) => {
        if (!block.isConnected || watched.has(block))
            return;
        const region = block.querySelector(content);
        const banner = block.querySelector('[data-code-block-banner]') ?? region?.previousElementSibling;
        if (!banner || !region)
            return;
        const heading = block.previousElementSibling;
        const headingText = heading?.matches('p') && heading.childElementCount === 1 && heading.firstElementChild?.matches('strong')
            ? heading.textContent?.trim() : undefined;
        const cliHeading = !!headingText && /^(Grok|Codex) · /u.test(headingText);
        const walker = doc.createTreeWalker(banner, 4);
        let labeled = false;
        for (let node = walker.nextNode(); node; node = walker.nextNode()) {
            if (node.textContent?.trim() === language) {
                labeled = true;
                break;
            }
        }
        if (labeled || cliHeading) {
            const button = doc.createElement('button');
            const nativeButton = banner.querySelector('button');
            button.type = 'button';
            button.className = nativeButton
                ? `${nativeButton.className} sessivra-cli-output-toggle`
                : 'sessivra-cli-output-toggle sessivra-cli-output-fallback';
            const svg = doc.createElementNS('http://www.w3.org/2000/svg', 'svg');
            svg.setAttribute('width', '14');
            svg.setAttribute('height', '14');
            svg.setAttribute('viewBox', '0 0 16 16');
            svg.setAttribute('aria-hidden', 'true');
            const arrow = doc.createElementNS(svg.namespaceURI, 'path');
            arrow.setAttribute('d', 'M4 6l4 4 4-4');
            arrow.setAttribute('fill', 'none');
            arrow.setAttribute('stroke', 'currentColor');
            arrow.setAttribute('stroke-width', '1.5');
            arrow.setAttribute('stroke-linecap', 'round');
            arrow.setAttribute('stroke-linejoin', 'round');
            svg.append(arrow);
            button.append(svg);
            const label = (expanded) => {
                const caption = expanded ? '收起原始输出' : '展开原始输出';
                button.title = caption;
                button.setAttribute('aria-label', caption);
                button.setAttribute('aria-expanded', String(expanded));
            };
            label(false);
            button.addEventListener('click', () => {
                const expand = block.getAttribute('data-sessivra-cli-output') !== 'open';
                block.setAttribute('data-sessivra-cli-output', expand ? 'open' : 'closed');
                label(expand);
            });
            block.setAttribute('data-sessivra-cli-output', 'closed');
            watched.set(block, button);
            if (nativeButton)
                nativeButton.before(button);
            else
                banner.prepend(button);
        }
    };
    doc.querySelectorAll(codeBlock).forEach(prepare);
    const Observer = doc.defaultView?.MutationObserver;
    const observer = Observer && new Observer(changes => {
        for (const [block, button] of watched) {
            if (block.isConnected && button.isConnected)
                continue;
            watched.delete(block);
            if (block.isConnected)
                prepare(block);
        }
        for (const change of changes) {
            for (const node of change.addedNodes) {
                if (node.nodeType !== 1)
                    continue;
                const element = node;
                const owner = element.closest(codeBlock);
                if (owner)
                    prepare(owner);
                element.querySelectorAll(codeBlock).forEach(prepare);
            }
        }
    });
    observer?.observe(doc.body, { childList: true, subtree: true });
    return () => {
        observer?.disconnect();
        style.remove();
        for (const [block, button] of watched) {
            block.removeAttribute('data-sessivra-cli-output');
            button.remove();
        }
    };
}
