export const importPanelStyles = `
.sessivra-import {
  display:flex; flex-direction:column; height:100%; min-height:0; min-width:0;
  color:var(--dsw-alias-label-primary,CanvasText);
  font:var(--dsw-font-s-14, 400 14px/20px system-ui);
}
.sessivra-import .muted {color:var(--dsw-alias-label-secondary,GrayText)}
.sessivra-import .import-frame {
  box-sizing:border-box; width:100%; max-width:1160px; margin-inline:auto;
  padding-inline:clamp(20px,4vw,48px);
}
.sessivra-import > .import-frame {flex:none; padding-top:28px}
.sessivra-import .import-header,.sessivra-import .import-controls,.sessivra-import .import-actions {
  display:flex; align-items:center; justify-content:space-between; flex-wrap:wrap; gap:12px;
}
.sessivra-import .import-header {align-items:flex-start}
.sessivra-import .import-header h1 {margin:0; font:var(--dsw-font-l-20, 500 20px/28px system-ui)}
.sessivra-import .import-header p {margin:3px 0 0; font:var(--dsw-font-xs-13, 400 13px/18px system-ui)}
.sessivra-import .import-actions {justify-content:flex-start; gap:8px}
.sessivra-import .import-toolbar {display:grid; gap:12px; margin-top:16px}
.sessivra-import .import-memory {display:flex; align-items:center; gap:8px}
.sessivra-import .import-folder {display:flex; align-items:center; gap:8px; min-width:0}
.sessivra-import .import-folder span {overflow:hidden; text-overflow:ellipsis; white-space:nowrap}
.sessivra-import .import-toolbar > :last-child {width:100%; min-width:0; box-sizing:border-box}
.sessivra-import .import-scroll {flex:1; min-height:0; overflow:auto}
.sessivra-import .import-content {display:grid; gap:16px; padding-block:20px 28px; overflow-wrap:anywhere}
.sessivra-import .import-content h2 {margin:0 0 6px; font:var(--dsw-font-s-14, 400 14px/20px system-ui)}
.sessivra-import .import-content p {margin:0; padding-block:4px}
.sessivra-import .import-content ul {list-style:none; padding:0; margin:0}
.sessivra-import summary {cursor:pointer}
.sessivra-import .import-project summary {
  display:flex; align-items:center; min-height:36px; box-sizing:border-box; gap:8px;
  padding:6px 8px; border-radius:var(--dsw-radius-sm,8px); list-style:none;
}
.sessivra-import .import-project summary::-webkit-details-marker {display:none}
.sessivra-import .import-project summary svg {flex:none; color:var(--dsw-alias-label-secondary)}
.sessivra-import .import-project[open] .import-chevron {transform:rotate(90deg)}
.sessivra-import .import-project summary small {margin-inline-start:auto; flex:none}
.sessivra-import .import-project > ul {padding-inline-start:24px}
.sessivra-import .import-session,.sessivra-import .import-result-row,.sessivra-import .import-files li {
  display:flex; align-items:center; justify-content:space-between; gap:8px; min-width:0;
}
.sessivra-import .import-session {
  min-height:36px; padding-inline:8px; border-radius:var(--dsw-radius-sm,8px);
}
.sessivra-import .import-session label {min-width:0}
.sessivra-import .import-session-label {display:flex; align-items:center; gap:4px; min-width:0}
.sessivra-import .import-branch-toggle {padding-inline:4px; min-width:24px}
.sessivra-import .import-branch-toggle[aria-expanded=true] svg {transform:rotate(90deg)}
.sessivra-import .import-content .import-branches {
  margin-inline-start:15px; padding-inline-start:12px; border-inline-start:1px solid var(--dsw-alias-border-l3,var(--dsw-alias-border-l2));
}
.sessivra-import .import-session small {flex:none}
.sessivra-import .import-session:hover,.sessivra-import .import-project summary:hover {
  background:var(--dsw-alias-interactive-bg-hover);
}
.sessivra-import .import-session[data-selected=true] {background:var(--dsw-alias-interactive-bg-hover)}
.sessivra-import .import-unavailable {color:var(--dsw-alias-label-secondary)}
.sessivra-import .import-results li {padding:8px; border-top:1px solid var(--dsw-alias-border-l2)}
.sessivra-import .import-results li.import-result-child {margin-inline-start:16px; border-inline-start:1px solid var(--dsw-alias-border-l2)}
.sessivra-import .import-results details,.sessivra-import small {font:var(--dsw-font-xs-13, 400 13px/18px system-ui)}
.sessivra-import .import-files li {justify-content:flex-start; flex-wrap:wrap}
.sessivra-import .import-files button {white-space:normal; height:auto; min-height:28px; text-align:start}
.sessivra-import .import-more {display:flex; justify-content:center}
`;
