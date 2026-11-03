# Architecture — Klipo RevoSky 0.2.0

## Process boundaries

- **Electron main process:** native dialogs, file system access, FFmpeg/FFprobe/yt-dlp child processes, job lifecycle, encrypted provider settings and remote AI requests.
- **Preload:** narrow, explicit IPC API. It exposes only capabilities such as media import, render/download jobs, AI chat/model listing and activity subscriptions.
- **Renderer:** Indonesian desktop UX, session media library, clip-range controls, caption/effect selection, provider setup and progress. No Node integration and no API key values.
- **Pure core modules:** render argument construction, output profiles, RAM-aware device defaults and timestamped highlight validation.
- **AI provider module:** endpoint model discovery, response normalization, model fallback and typed provider error classification.

## Media pipeline

1. A user imports one or more local assets via native file picker.
2. FFprobe inspects metadata; only paths imported through Klipo are accepted by render/transcription handlers.
3. The user chooses in/out points, aspect profile, FPS, caption and effects.
4. The main process independently checks the selected source and time range before presenting the output dialog.
5. FFmpeg is started with an argument array and shell disabled. The renderer receives progress events but does not control the process directly.
6. On process completion, FFprobe inspects the output. A result is marked successful only when the file exists and contains valid video metadata.
7. A cancellation discards partial output.

## AI provider flow

Chat and transcription have separate endpoints and credential slots. A compatible chat provider can expose `/models` for model discovery and `/chat/completions` for chat. The user chooses a primary model and up to three fallback models. Fallback is used for unavailable models and retryable provider availability errors; OpenRouter's exhausted `free-models-per-day` quota is detected as a terminal daily quota condition and is not retried.

Transcription sends audio only to the configured `/audio/transcriptions` endpoint. Video audio is extracted locally by FFmpeg first. AI highlight ranking only starts after timestamped transcription is returned, and candidate ranges are parsed and validated before they can be applied in the editor.

## Device profile

RAM and logical CPU count inform a conservative default thread count. Users may change it. Encoder names are read from the installed FFmpeg build; their presence alone does not guarantee a hardware driver can encode. CPU H.264 remains the compatibility path.

## Trust boundaries

URLs, imported files, model IDs and provider endpoint settings are untrusted. Only HTTPS provider endpoints are accepted, except localhost development endpoints. API keys are held by the Electron main process and encrypted with Electron `safeStorage` when available. Downloads never bypass DRM, access controls or site permissions.
