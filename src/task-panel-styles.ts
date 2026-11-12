/* Keep the manager in the same theme and scale as DSH's TaskManagerPage. */
export const css = `
.sessivra-tasks {
  --paper: var(--dsw-alias-bg-base, Canvas);
  --text: var(--dsw-alias-label-primary, CanvasText);
  --secondary: var(--dsw-alias-label-secondary, var(--text));
  --muted: var(--dsw-alias-label-tertiary, GrayText);
  --caption: var(--dsw-alias-label-caption, var(--muted));
  --stroke: var(--dsw-alias-border-l3, color-mix(in srgb, CanvasText 18%, transparent));
  --divider: var(--dsw-alias-border-l4, var(--stroke));
  --hover: var(--dsw-alias-interactive-bg-hover, color-mix(in srgb, CanvasText 6%, transparent));
  --fill: var(--dsw-alias-button-primary-fill, CanvasText);
  --on-fill: var(--dsw-alias-label-primary-foreground, Canvas);
  --focus: var(--dsw-focus-ring-color, Highlight);
  --success: var(--dsw-alias-state-success-primary, var(--secondary));
  --warning: var(--dsw-alias-state-warn-label, var(--secondary));
  --radius: var(--dsw-radius-md, 10px);
  box-sizing: border-box;
  display: flex;
  container-type: inline-size;
  width: 100%;
  height: 100%;
  min-width: 0;
  min-height: 0;
  overflow: hidden;
  border-start-start-radius: var(--dsw-radius-xl, 16px);
  background: var(--paper);
  color: var(--text);
  font-family: inherit;
  font-size: 14px;
  line-height: 1.6;
  text-align: start;

  & *, & *::before, & *::after { box-sizing: border-box; }
  & svg { flex: none; }
  & :is(h2,h3,h4,p,ul,ol,pre) { margin: 0; }
  & :is(h2,h3) { color: var(--text); font-size: 20px; font-weight: 500; line-height: 28px; }
  & h4 { font-size: 14px; font-weight: 500; line-height: 22px; }
  & :is(ul,ol) { padding-inline-start: 20px; }
  & :is(p,li) { white-space: pre-wrap; overflow-wrap: anywhere; }
  & :is(input,textarea,select,button) { min-width: 0; max-width: 100%; color: inherit; font: inherit; }
  & :is(input:not([type=checkbox]),textarea,select) {
    border: .5px solid var(--stroke); border-radius: var(--radius);
    background: var(--paper); padding: 7px 10px; line-height: 22px;
  }
  & input::placeholder, & textarea::placeholder { color: var(--caption); }
  & textarea { resize: vertical; }
  & select { text-overflow: ellipsis; }
  & button {
    display: inline-flex; align-items: center; justify-content: center; gap: 4px;
    min-height: 32px; padding: 0 12px; border: .5px solid var(--stroke);
    border-radius: var(--radius); background: transparent; cursor: pointer;
    font-size: 14px; font-weight: 400; line-height: 22px;
  }
  & button:hover:not(:disabled) { background: var(--hover); }
  & button:disabled { cursor: default; opacity: .4; }
  & :is(button,summary,input,textarea,select):focus-visible { outline: 2px solid var(--focus); outline-offset: 2px; }
  & :is(.st-primary,button[type=submit]) { border: 0; background: var(--fill); color: var(--on-fill); }
  & :is(.st-primary,button[type=submit]):hover:not(:disabled) { background: var(--dsw-alias-button-primary-hover, var(--fill)); }

  & .st-master, & .st-detail { min-width: 0; min-height: 0; overflow: auto; scrollbar-gutter: stable; }
  & .st-master { flex: 1; }
  & .st-shell { max-width: 1056px; margin: 0 auto; padding: 28px clamp(24px,4vw,48px) 48px; }
  & .st-head { display: flex; align-items: center; justify-content: space-between; gap: 16px; margin-bottom: 24px; }
  & .st-head .st-primary { flex: none; height: 32px; border-radius: 16px; font-size: 13px; line-height: 20px; }
  & nav { display: flex; flex-wrap: wrap; gap: 8px 12px; margin-bottom: 14px; }
  & nav button { min-height: 28px; padding: 0 10px; border: 0; border-radius: 14px; color: var(--muted); }
  & nav button[aria-pressed=true] { color: var(--text); background: var(--hover); }
  & .st-cli { max-width: 760px; }
  & .st-cli-head, & .st-cli-row { display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 10px 16px; }
  & .st-cli-head { margin: 18px 0 14px; }
  & .st-cli-head h3 { margin: 0; }
  & .st-cli button { min-height: 36px; }
  & .st-cli-list { list-style: none; border: 1px solid var(--stroke); border-radius: 14px; margin: 0; padding: 0; }
  & .st-cli-list li { padding: 16px; }
  & .st-cli-list li + li { border-top: 1px solid var(--stroke); }
  & .st-cli-row > div { flex: 1 0 125px; display: grid; gap: 4px; }
  & .st-cli-state, & .st-cli-note, & .st-cli-row small { color: var(--secondary); }
  & .st-cli-state[data-ready=true] { color: var(--text); }
  & .st-cli-note { margin: 10px 0 0; }

  & .st-bar { display: flex; align-items: center; gap: 8px; margin-bottom: 16px; }
  & .st-search {
    flex: 1; display: flex; align-items: center; gap: 6px; min-width: 0; height: 36px;
    padding: 0 10px; border: .5px solid var(--stroke); border-radius: 12px; color: var(--muted);
  }
  & .st-search svg { width: 14px; height: 14px; }
  & .st-search input { flex: 1; width: 100%; height: 100%; padding: 0; border: 0; border-radius: 0; background: transparent; color: var(--text); outline: none; }
  & .st-search:focus-within { border-color: var(--focus); }
  & .st-bar > button { flex: none; border: 0; color: var(--secondary); }
  & .st-bar > button[aria-expanded=true], & .st-chipbar button { background: var(--hover); }
  & .st-filters { display: grid; grid-template-columns: repeat(auto-fit, minmax(130px,1fr)); gap: 12px; margin: 0 0 16px; }
  & .st-filters label, & form label { min-width: 0; display: grid; gap: 5px; color: var(--secondary); font-size: 13px; }
  & .st-chipbar, & .st-actions, & .st-meta { display: flex; align-items: center; flex-wrap: wrap; gap: 8px; }
  & .st-chipbar { margin-bottom: 12px; }
  & .st-chipbar button { min-height: 25px; border: 0; font-size: 12px; border-radius: 14px; }
  & .st-listhead, & .st-blocktitle { display: flex; align-items: center; gap: 7px; }
  & .st-listhead, & .st-groupname { margin: 0 8px 6px; font-size: 12px; color: var(--muted); }
  & .st-items:has(.st-empty) .st-listhead { display: none; }
  & .st-count { color: var(--muted); font-size: 12px; font-variant-numeric: tabular-nums; font-weight: 400; }
  & .st-row {
    display: grid; justify-content: stretch; gap: 2px; width: 100%; text-align: start;
    padding: 8px 10px; border: 0; border-radius: 12px; overflow-wrap: anywhere;
  }
  & .st-row + .st-row { margin-top: 2px; }
  & .st-row[aria-pressed=true] { background: var(--hover); }
  & .st-row strong, & .st-question strong, & .st-verdict strong { font-weight: 500; }
  & .st-row small, & .st-meta { display: flex; flex-wrap: wrap; align-items: center; gap: 8px; color: var(--muted); font-size: 13px; }
  & .st-row small { justify-content: space-between; }
  & .st-pill { display: inline-flex; align-items: center; gap: 5px; color: var(--secondary); }
  & .st-pill i { width: 5px; height: 5px; background: var(--caption); border-radius: 50%; }
  & .st-green i { background: var(--success); }
  & .st-amber i { background: var(--warning); }
  & .st-blue i { background: var(--dsw-alias-state-business-primary, var(--secondary)); }
  & .st-groupname { margin-top: 10px; }
  & .st-listfoot { text-align: center; padding-top: 8px; }
  & .st-empty { display: grid; justify-items: center; text-align: center; padding: 48px 20px; color: var(--muted); }
  & .st-emptyicon { display: flex; margin-bottom: 12px; color: var(--caption); }
  & .st-emptyicon svg { width: 20px; height: 20px; }
  & .st-empty h4 { font-size: 14px; font-weight: 400; }
  & .st-empty p { margin-top: 4px; }
  & .st-empty button { margin-top: 16px; color: var(--text); }

  & .st-detail {
    flex: 0 0 47%; border-inline-start: .5px solid var(--divider);
    padding: 28px 24px 40px; overflow-wrap: anywhere;
  }
  & .st-detail > * + * { margin-block-start: 22px; }
  & .st-detailtop { display: flex; align-items: flex-start; justify-content: space-between; gap: 10px; }
  & .st-detailtop button { flex: none; width: 28px; min-height: 28px; padding: 0; border: 0; color: var(--muted); }
  & .st-meta { margin-top: 5px; gap: 6px; }
  & .st-meta > span + span::before { content: "·"; margin-inline-end: 6px; }
  & .st-blocktitle { margin-bottom: 6px; }
  & .st-blocktitle svg { color: var(--muted); }
  & .st-outcome { display: grid; gap: 12px; padding-block: 14px; border-block: .5px solid var(--divider); }
  & .st-outcome h4 { color: var(--secondary); margin-bottom: 4px; }
  & .st-figures { font-size: 18px; font-weight: 550; margin-bottom: 4px; font-variant-numeric: tabular-nums; }
  & .st-review-state { display: flex; align-items: baseline; flex-wrap: wrap; gap: 4px 10px; }
  & .st-review-state :is(span,small), & .st-question p { color: var(--secondary); font-size: 13px; }
  & .st-review-state strong { font-weight: 550; }

  & .st-file { border: .5px solid var(--stroke); border-radius: var(--radius); overflow: hidden; }
  & .st-file + .st-file { margin-top: 6px; }
  & .st-file-toggle { justify-content: flex-start; gap: 8px; width: 100%; padding: 7px 10px; border: 0; border-radius: 0; text-align: start; }
  & .st-file-toggle:focus-visible { outline-offset: -2px; }
  & .st-file-toggle span { flex: 1; }
  & .st-file-toggle :is(small,svg) { color: var(--muted); }
  & .st-file-toggle[aria-expanded=true] svg:last-child { transform: rotate(90deg); }
  & .st-preview { border-top: .5px solid var(--divider); }
  & .st-readtools { display: flex; justify-content: flex-end; gap: 4px; padding: 4px 8px; }
  & .st-readtools button { min-height: 26px; padding: 0 8px; border: none; color: var(--secondary); font-size: 12px; }
  & .st-readbody { max-height: min(50vh, 440px); overflow: auto; padding: 2px 14px 14px; }
  & .st-readbody[data-expanded=true] { max-height: none; }
  & .st-readbody pre { white-space: pre-wrap; font-family: var(--dsw-font-mono,monospace); font-size: 13px; }
  & .st-readbody table { border-collapse: collapse; width: max-content; min-width: 100%; font-variant-numeric: tabular-nums; }
  & .st-readbody :is(th,td) { padding: 5px 9px; border: 1px solid var(--divider); white-space: nowrap; }
  & .st-readbody th { background: var(--hover); font-weight: 550; }
  & .st-question + .st-question { margin-top: 10px; }
  & .st-question p { margin: 4px 0; }
  & .st-answer { margin-inline-end: 8px; color: var(--text); }
  & .st-folds { border-top: .5px solid var(--divider); }
  & .st-folds details { border-bottom: .5px solid var(--divider); }
  & details > summary { padding: 10px 0; color: var(--secondary); cursor: pointer; }
  & .st-foldbody { display: grid; gap: 12px; padding-bottom: 12px; }
  & .st-formpage { max-width: 680px; }
  & form { display: grid; gap: 14px; }
  & form h3 { font-size: 16px; }
  & form > p { font-size: 13px; color: var(--muted); }
  & form fieldset { min-width: 0; border: .5px solid var(--stroke); border-radius: var(--radius); }
  & input[type=checkbox] { accent-color: var(--fill); width: 16px; height: 16px; }
  & form details { border-block: .5px solid var(--divider); }
  & form details label { margin: 10px 0; }
  & [role=alert] { margin-block: 12px; padding: 8px 12px; border-radius: var(--radius); background: var(--hover); color: var(--dsw-alias-state-error-primary,var(--text)); }
}

@container (max-width: 730px) {
  .sessivra-tasks[data-detail] .st-master { display: none; }
  .sessivra-tasks .st-detail { flex: 1; border-inline-start: 0; padding: 22px 18px; }
  .sessivra-tasks .st-shell { padding: 22px 18px 32px; }
}
`;
