# Sessivra dev.25 — real-task demo / 真实任务演示

## Watch / 观看

- [中文配音 MP4](https://github.com/leoan698-tom/dsh-sessivra/releases/download/v0.3.0-dev.25/Sessivra-dev25-real-task-demo-zh-voice.mp4)
- [English narrated MP4](https://github.com/leoan698-tom/dsh-sessivra/releases/download/v0.3.0-dev.25/Sessivra-dev25-real-task-demo-en.mp4)
- [中文素材包 / Chinese demo kit](https://github.com/leoan698-tom/dsh-sessivra/releases/download/v0.3.0-dev.25/Sessivra-dev25-demo-kit-voice.zip)
- [English demo kit](https://github.com/leoan698-tom/dsh-sessivra/releases/download/v0.3.0-dev.25/Sessivra-dev25-demo-kit-en.zip)

## What happened

The main session asked an ordinary child session to review an example event-sign-up brief. It also queued a second task for the same child: turn the review into an acceptance checklist. The main session read the actual output files and checked the criteria. The follow-up started only after the first task was formally accepted.

- Run: 2026-11-04 UTC; public `dsh-plugin-sessivra@0.3.0-dev.25`; official DSH `0.2.1-rc.5` Web UI in an isolated demo profile.
- Model: official DeepSeek route, displayed as DeepSeek-V4.1-Flash / High; 37 model steps.
- Only two human messages, both in the main session: the original request and acceptance confirmation. No human prompt was pasted into the child session.
- Input: 10-line `需求.md`; generated outputs: 148-line `需求检查.md` and 193-line `验收清单.md`.
- Four cases: duplicate sign-up, capacity reached, capacity after cancellation, and network timeout. Suggestions and unresolved product decisions stay marked for human confirmation.
- Task one accepted at **04:54:52.691 UTC**; task two scheduled at **04:54:52.700 UTC**. These are task-log timestamps, not video playback times or a performance benchmark.
- **19 run-evidence checks passed**, including artifact existence, main-session file reads, task acceptance and queue ordering. Release installation matched all 81 public-package files.

## Limitations and disclosures

Both videos are 60-second, 1080p edits of the **same run**, using shortened waits, enlarged stills and AI-generated narration. The original run took approximately 3 minutes 40 seconds. The English edition translates the explanatory overlays and narration; the recorded Chinese UI and actual output files remain unchanged.

The run included **one output-limit stop followed by automatic recovery** and **five rejected tool calls**. Recovery is part of this evidence, not proof of failure-free operation. The final files were read and accepted after recovery.

The brief was written for the demonstration. This is not an independent external-user trial, market validation, a completed business-system implementation, or a reliability statistic. The output is a review and a draft checklist; unresolved product rules still require human decisions.

Voice synthesis uses edge-tts (`zh-CN-XiaoxiaoNeural` and `en-US-JennyNeural`). The audio is post-production narration, not the model's live voice. Media verification covers full decoding, scene samples, audio signal/timing and archive checksums; it does not include a separate human listening review or automated transcript comparison.

## 中文说明

本次展示“交办需求检查 → 收回实际文件 → 主会话读取并核对 → 确认验收后，同一子会话执行后续清单任务”。两版视频均来自同一次真实模型运行。需求是演示示例，剪辑包含等待压缩、局部放大和定格，旁白为 AI 合成。

运行发生过一次回合耗尽后自动恢复、五次工具调用被拒；最终两份产物已由主会话读取并验收。19 项检查对应这一次运行证据，不代表任意场景可靠性，也不计作外部用户试用。需求建议和清单中的待确认项仍需产品人员决定。

## Try it / 试用

Use `dsh-plugin-sessivra@0.3.0-dev.25` with DSH `0.2.1-rc.5` / Node.js 24+, in the same Host/profile. [English quick start](../README.en.md) · [中文安装说明](../README.md#开始使用).

Try a small brief of your own and [share the point where you got stuck or the result you found useful](https://github.com/deepseek-ai/deepseek-harness/discussions/11837). Feedback in Chinese and English is welcome; please keep private project details out of public reports.
