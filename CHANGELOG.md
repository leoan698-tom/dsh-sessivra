# Changelog

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
