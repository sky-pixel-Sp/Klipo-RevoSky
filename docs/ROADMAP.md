# Product roadmap

## Milestone 0 — Desktop foundation (current)

- Electron desktop shell with context isolation and a narrow preload API.
- Local media import and FFprobe metadata.
- FFmpeg trim/export pipeline, caption filters, encoder discovery and progress events.
- 25 FFmpeg drawtext caption presets.
- Optional yt-dlp command integration.
- OpenAI-compatible chat and configurable audio transcription endpoints.
- AI highlight suggestions from timestamped transcription, with validated ranges and user approval before export.
- Windows installer workflow and automated unit tests.

## Milestone 1 — Editing workflow

- Multi-clip project format, track model, split/trim/move operations and undo/redo.
- Preview timeline with proxy generation and waveform cache.
- Per-clip transitions, color adjustments, audio ducking and keyframes.
- Subtitle segmentation, word timing and SRT/VTT import/export.
- Render queue with resumable job metadata and reliable ETA based on measured throughput.

## Milestone 2 — AI production assistant

- Provider capability registry (chat, vision, transcription, embeddings) rather than assuming every model supports every modality.
- Shot/scene analysis, highlight scoring, hook suggestions and editable clip suggestions.
- Human-readable action plan, approval gates, audit log and reversible edits.
- Local Whisper/faster-whisper optional install profile for capable machines.

## Milestone 3 — Integrations

- Google Drive OAuth with least-privilege scopes and explicit user selection of files.
- MCP client configuration for user-supplied trusted servers; show tool permissions and require approval for writes.
- Platform reference search through permitted public APIs or documented endpoints.
- clippo.id publishing only after official API docs, OAuth flow and terms are confirmed.

## Milestone 4 — Quality and distribution

- GPU compatibility matrix and device-specific render tests.
- Windows code signing, crash reporting opt-in, auto-update and release channel.
- Accessibility, full localization, installer/uninstaller testing and media-format regression suite.

## Non-negotiable product rules

- No fake buttons, placeholder assets or simulated job progress.
- Never expose API keys to renderer JavaScript or logs.
- Never claim a provider supports audio/video inputs until verified.
- Never bypass DRM, paywalls, private-content permissions or platform access controls.
- Show a feature as unavailable when a required credential, API or hardware capability is missing.
