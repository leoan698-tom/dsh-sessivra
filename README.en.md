# DSH Sessivra

[中文](README.md) · **English**

Sessivra is an unofficial session collaboration plugin for [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness). Put a brief and its review side by side, collect files from a child session, and accept its work before releasing the next task.

[Quick start](#quick-start) · [Try one small task](#try-one-small-task) · [60-second demo](docs/DEMO_DEV25.md) · [Releases](https://github.com/leoan698-tom/dsh-sessivra/releases)

## Quick start

Requires **DSH 0.2.1-rc.5 or 0.2.2-rc.1 and Node.js 24+**. Sessions that collaborate must use the same Host/profile.

1. In DSH, open **Plugins → Add plugin** and select the official npm source.
2. Enter `dsh-plugin-sessivra` in the package field. For a pinned install, copy the versioned package name from the installation guide.
3. Reload DSH as prompted, then verify the installed version and enablement in the plugin list.

The guide covers CLI and offline installation. Follow the migration guide if you still use the old messenger, Agent Hub, or the old scoped package. [Installation guide](docs/OPERATIONS.md#安装) · [Migration guide](docs/RENAMING.md)

## Try one small task

Create `requirements.md` in an empty folder with this sample brief:

> Signed-in residents can register for a community event. Each event has a capacity and deadline, and residents can cancel before the event starts. Rules for duplicates, full events, and reopening a place after cancellation need clarification.

Open the folder in DSH and send this request to the main session:

```text
Use Sessivra to create an ordinary child session to review requirements.md.
Ask it to write review.md with source references, missing rules, and verifiable acceptance criteria.
Queue a second task for the same child session: turn the review into checklist.md.
Read review.md and wait for my confirmation before accepting it and releasing the next task.
```

Open Task Center (任务中心) in the sidebar to see the submitted file. Review it and confirm acceptance, then check that the checklist task starts. The dev.25 demo shows the full handoff with a real model, from delegation through file review and acceptance. [60-second English video](https://github.com/leoan698-tom/dsh-sessivra/releases/download/v0.3.0-dev.25/Sessivra-dev25-real-task-demo-en.mp4) · [Demo notes](docs/DEMO_DEV25.md)

## What you can do

| To do this | Start here |
| --- | --- |
| Compare two sessions | Drag a session from the sidebar to a pane edge. Each pane has its own draft. Close the main pane to continue editing in the pane that takes its place. [Split views](docs/SESSION_VIEWS.md) |
| Hand work to another session | Use `@` to select the session, then say whether to reference its history, send a message, or assign work. Linked replies come back to the original request. [Messaging guide](docs/OPERATIONS.md#使用与自查) |
| Find work in the session tree | Expand the parent session in the workspace to open a child session or teammate and inspect its conversation and files. |
| Review child-session work | Open Task Center to create tasks, answer shared questions, inspect results, and accept work. Queued follow-ups for the same child session start after acceptance. [Managed tasks](docs/MANAGED_TASKS.md) |
| Reuse a saved question and answer | Click the fish icon below a reply, or pick a bookmark from the composer’s `@` menu. Preview the sent reference and jump back to its original turn. Verified on Windows desktop with DSH 0.2.2-rc.1. [Release notes](https://github.com/leoan698-tom/dsh-sessivra/releases/tag/v0.3.0-dev.28) |

## Import Claude Code or Codex sessions

The working tree includes development notes for session import, covering source folders, memory, original files, and continuation limits. Check the corresponding release for availability. [Session import notes](docs/SESSION_IMPORT.md)

## Feedback and development

Include your DSH version, plugin version, OS, steps, and observed result in bug reports. Remove private project details before posting. [Report a problem](https://github.com/leoan698-tom/dsh-sessivra/issues) · [Known issues](docs/KNOWN_ISSUES.md)

```sh
npm ci --ignore-scripts
npm run check
```

Rebuild and update `dist/` after source changes. [Architecture](docs/ARCHITECTURE.md) · [Test reports](docs/TEST_REPORT.md) · [Changelog](CHANGELOG.md) · [Third-party notices](THIRD_PARTY_NOTICES.md) · [MIT](LICENSE)
