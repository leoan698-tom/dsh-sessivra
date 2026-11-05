# Changelog

## 0.3.0-dev.26 (public prerelease, 2026-11-04)

- Compact every pane header to one 40px row with a native-styled view menu backed by the complete scoped Host view roster. Support × close for main, additional and last views; preserve the promoted session's editor draft by unmounting its old occurrence before navigation.

- Place the retained native main header inside its pane geometry and reuse the native scoped header for additional panes. Highlight all visible sessions in the sidebar, clear highlights on close or panel navigation, and preserve row handlers and native selection semantics.

- Drag a session into any native composer to insert its native @ reference without splitting, sending, replacing selected draft text or changing another pane's draft. Preserve exact session identity and native reference persistence.

- Remove the split toolbar and use icon-only pane close controls. Scope pane styling to plugin-owned shell classes; never restyle native conversation buttons. Add native-control computed-style parity regressions.

- Add free session docking at any pane edge with nested horizontal/vertical splits, draggable dividers, per-split ratios, keyboard adjustment and local branch collapse. Remove the preset equal-size layouts and the four-view limit.
- Keep pane DOM and drafts mounted when redocking existing views, including the native main view. Add browser checks for actual four-edge drops, mixed-axis resizing, nonuniform geometry, fifth-view docking and reference release.
- Keep the native header and main composer mounted; embedded views reuse the Host conversation factory and exact ordinary/subagent addresses, with independent references released on close.
- Fix Windows/Electron fast drag gestures that do not complete native drop delivery; retain native sorting cleanup and cancel/outside guards.
- Verify native desktop nested docking, horizontal/vertical resizing, redocking, local collapse and independent A/B/C model sends; retain view lifecycle regressions and isolated browser geometry checks.

## 0.3.0-dev.25 (public prerelease, 2026-11-03)

- Publish the managed task coordination and sidebar improvements from dev.21 through dev.24.local.2 under the existing npm package name.
- Include task revisions, shared questions and decisions, automatic delivery, coordinator acceptance and queue release after acceptance.
- Include the pending checklist, queue count and first-step human-message-ID fixes verified in the native desktop workflow.
- Refresh public installation, upgrade, recovery and verification documentation; keep DSH 0.2.1-rc.5 / Node.js 24+ compatibility.
- Runtime source is unchanged from the verified dev.24.local.2 candidate. This is a distribution and documentation promotion, not a stable release.

## 0.3.0-dev.24.local.2 (local desktop fix, 2026-11-03)

- Expose the admitted current human message ID in the first model request after a user reply. rc.5 prepares runtime context before that message is appended to session history; decision authorization still validates the genuine persisted message.
- Add a regression that fails with the previous human message ID and passes without an extra model step. Retain both local.1 fixes.

## 0.3.0-dev.24.local.1 (local desktop fix, 2026-11-03)

- Align an unstarted task's derived checklist with revised acceptance conditions, including repair on reopen; retain recorded execution progress, task identity and shared decisions.
- Exclude the currently displayed waiting task from the sidebar's subsequent-task count.
- Add regressions for requirement changes before startup, exact queue counts, repair without model activation, and preservation of existing execution checkpoints.

## 0.3.0-dev.24 (local development build, 2026-11-03)

- Add durable scoped tasks with revision adoption, checkpoints, a separately versioned decision record, automatic question/result delivery and coordinator acceptance evidence.
- Deduplicate business questions across related child sessions, hold known prerequisite work before startup, validate user answers against current human messages, and synchronize direct answers from a child.
- Queue subsequent tasks until acceptance, preserve unfinished obligations during updates, and pause/cancel only at safe tool boundaries without aborting running tools.
- Guard stale work and results, preserve task identity across retries and restart, and quarantine uncertain deliveries instead of automatically repeating external effects.
- Show managed task status and pending adoption in the existing conversation tree; keep native tool approvals and ordinary child conversation identity.
- Retain the dev.23.local.3 sidebar and dialog improvements. This tarball is a local release, not an npm publication. See docs/MANAGED_TASKS.md for installation, recovery and limitations.

## 0.3.0-dev.23.local.3 (local development build, 2026-11-02)

- Read the native workspace's shared archive filter through the public Slot store and suppress active teammate supplements in archived-only searches; exclude newly archived members and ancestors immediately.
- Retain the teammate identity badge alongside running, waiting, offline, read-only and creation states.
- Render session dialogs through the native shell.overlay slot so modal events have no parent-row React ancestry; isolate child-tree and menu pointer transitions, preserving native hover and dialog focus recovery.

## 0.3.0-dev.22.local.2 (local development build, 2026-11-02)

- Match the native DSH rename dialog: its input geometry and focus behavior, shared primary/outline buttons and modal footer, with IME-safe submission and retryable errors.
- Let users set and clear local teammate display names without changing Team identities; preserve original names in tooltips and search.
- Extend the existing native search results with visible team members, matching original names, meaningful task labels, aliases and parent paths; opening a match reveals its branch.
- Show exact Host-reported parent unavailability and offer an Open parent action in the read-only composer without sending a message.
- Mark collapsed branches that contain the current conversation, preserving deliberate folds during refresh.
- Reclaim leaf and menu space in narrow sidebars; show menus on hover or keyboard focus and retain long-name suffixes when truncating.

## 0.3.0-dev.21.local.1 (local development build, 2026-11-02)

- Follow the Host's current main-view session for one accurate child selection; reveal and scroll to its ancestor path after navigation or search.
- Restore ordinary child-session rename, pin/unpin and archive controls through Host APIs, with confirmation, failure feedback and the running-session archive guard. Team members remain outside ordinary-session management.
- Persist expansion by session identity, limit default expansion to the first two child levels, and preserve deliberate folds during polling.
- Show one visible loading/error/retry notice, including initial failures and collapsed trees; retain the last successful tree on refresh failures.
- Prefer existing task descriptions for team labels, retain the member name in the tooltip, and explain Host-reported waiting states without treating idle as completed.
- Limit the sidebar to ordinary sessions, ordinary child sessions and confirmed team members. Hide other subagents and their subagent branches, remove empty disclosures, and leave discovery, history, references and messaging unchanged.
- Clarify session hierarchy with branch guides, leaf markers and consistent 28px nested indentation that follows the native workspace depth.
- Give expand/collapse controls a separate 28×28px target and a reserved native-row gutter, with independent hover, pressed and keyboard-focus feedback.
- Keep disclosure clicks, double-clicks, keyboard activation and drag gestures from opening, renaming or dragging the native session row; restore its layout on cleanup.

## 0.3.0-dev.20 (2026-11-01)

- Use the public npm package `dsh-plugin-sessivra` so users can install by entering its package name in DSH.
- Align Host registration, browser loader, protocol contribution and bundle patch with the new package name; retain the bundle entry ID and legacy persistent data, tools and wire IDs.
- Explicitly target the npm `latest` distribution tag for bare-name resolution while keeping the prerelease version and rc.5 compatibility boundary.
- Document replacement of the dev.19 scoped package and npm publication verification.

## 0.3.0-dev.19 (2026-11-01)

- Rename the product to DSH Sessivra and the package to `@leoan698-tom/dsh-sessivra` after checking the distinctive name against GitHub, npm and public web results.
- Update repository URLs, Host registration, client module identity and bundle entry together; preserve legacy wire IDs, tools and persistent data domains.
- Document migration from both the original messenger package and the Agent Hub dev.18 candidate. Local CLI integration and the human task board remain planned features.

## 0.3.0-dev.18 (unreleased)

- Rename the product to DSH Agent Hub / DSH 智能体协作中心 and the package to `@leoan698-tom/dsh-agent-hub` to distinguish it from existing unscoped packages.
- Align the bundle entry, Host identity, browser module and protocol package with the scoped name.
- Preserve legacy wire IDs, message sources, tool names and persistent domains for existing conversations and data.
- Record local CLI sessions, cross-runtime collaboration/context and a human task panel as future scope; this version does not implement those features.
- Document replacing the old package and keeping its data; old release artifacts retain their original names.

## 0.3.0-dev.17

- Preserve the native workspace heading, search, view options and add-workspace controls.
- Extend native session rows with child branches instead of replacing the entire workspace browser.
- Retain workspace nesting, native row actions and timestamps; remove the separate workspace-management/tree switch.
- Share one bounded refresh across row extensions and clean up inserted branches when native rows or the plugin unmount.
- Add DOM interaction coverage for native controls, expansion, sorting, linked-child deduplication and cleanup.
- No messaging permission or persistent schema change.

## 0.3.0-dev.16

- Publish prebuilt server/client modules and a tagged GitHub source so DSH can install directly with its official plugin command.
- Publish an npm-format tarball and SHA-256 checksum in GitHub Releases.
- Make the current 93-test suite independent of private local acceptance artifacts; keep Windows file-lock checks platform-specific.
- Refresh installation, upgrade, removal, architecture and validation documentation; pin compatibility to DSH 0.2.1-rc.5.
- Specify the TypeScript config explicitly for deterministic client builds.
- Document the unresolved Zod advisory and rc.5 schema compatibility constraint.
- No product behavior or storage-schema change from dev.15.

## 0.3.0-dev.15 feature baseline

- Use the native session reference menu for both bounded context and explicit messaging; remove the extra send-target menu.
- Resolve multiple references by exact identity, without selecting the last reference by default.
- Automatically display ordinary child conversations, teammates and standalone subagents with their real ownership.
- Send to directly owned continuable subagents through the native parent-child channel and receive linked replies.
- Preserve one-shot and other-parent references as read-only; do not infer task completion from delivery.
