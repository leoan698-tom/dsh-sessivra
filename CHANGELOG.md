# Changelog

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
