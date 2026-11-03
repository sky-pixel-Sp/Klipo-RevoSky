# Klipo RevoSky 0.2.0

Klipo RevoSky is a local-first Windows desktop video studio. The 0.2 rebuild replaces the earlier crowded MVP interface with a guided Indonesian workflow for importing, trimming, styling, downloading and exporting media.

## What is implemented

- Electron desktop shell with context isolation, sandboxed renderer and a narrow allow-listed IPC bridge.
- Multi-file local import, preview and FFprobe metadata inspection.
- A single-source-clip editing workflow with numeric in/out fields and synchronized trim sliders.
- Three real output profiles: vertical 9:16 (1080×1920), landscape 16:9 (1920×1080) and square 1:1 (1080×1080).
- 25 caption/title presets, one editable text overlay per export, and nine selectable FFmpeg effects.
- CPU H.264 rendering and detected QSV/NVENC/AMF hardware encoders. CPU remains the compatibility fallback.
- RAM-aware default CPU thread limits. For an 8 GB laptop the default is two threads; users can adjust it.
- FFmpeg progress, elapsed time/ETA, bounded activity log, cancel support and FFprobe verification of completed exports.
- Bundled Windows yt-dlp executable. The build downloads and validates the official Windows binary, includes it in installer resources, and provides FFmpeg's path for media merging.
- OpenAI-compatible chat provider configuration, live `/models` discovery, up to three user-selected fallback models, clear handling for authentication/model/provider errors and special handling for OpenRouter's `free-models-per-day` quota response.
- Separate audio transcription endpoint; video audio is extracted locally before being sent to the configured transcription provider.
- AI highlight suggestions based on timestamped transcription. Ranges are validated and must be approved by the user before export.
- API keys encrypted with Electron `safeStorage` when available. Secrets never enter renderer state.
- Indonesian-first interface, contextual empty states, toast feedback, clear activity states and retry actions for failed chat prompts.

## Windows quick start

For end users, use the packaged Windows x64 NSIS installer from the latest successful **Windows build** workflow. The installer bundles FFmpeg, FFprobe and yt-dlp; no separate yt-dlp PATH setup is required.

For developers, use Node.js 22 LTS on Windows 10/11 x64:

    git clone https://github.com/sky-pixel-Sp/Klipo-RevoSky.git
    cd Klipo-RevoSky
    npm install
    npm run check
    npm test
    npm run dev

Build the installer with:

    npm run dist:win

The `predist:win` lifecycle script downloads and validates yt-dlp before electron-builder packages the application. A failed download or version check intentionally stops the build rather than producing an installer with a missing downloader.

## Hardware notes

The app detects CPU model, logical CPU count, installed RAM and FFmpeg encoders. A device with 8 GB RAM receives a conservative two-thread default. Use CPU mode first for compatibility. A listed hardware encoder is only a capability signal; it must still pass an actual render with the installed driver. Hybrid means CPU video filters plus hardware video encoding.

## Feature boundary

| Area | 0.2 status |
|---|---|
| Import, preview, metadata | Implemented |
| One source clip, trim sliders and numeric in/out | Implemented |
| 9:16, 16:9 and 1:1 output selection | Implemented |
| 25 caption presets and nine FFmpeg effects | Implemented |
| CPU, QSV, NVENC, AMF selection | Runtime detection; physical device render must be verified |
| Progress, cancellation and output verification | Implemented for active render/download jobs |
| URL download | Bundled yt-dlp integration; live source behavior depends on site support and permissions |
| AI chat and model discovery | Implemented for OpenAI-compatible `/chat/completions` and `/models` APIs |
| AI fallback | Up to three manually configured models; daily free-model quota is not blindly retried |
| Transcription and AI highlight suggestions | Implemented when a compatible speech endpoint and chat provider are configured |
| Multi-track timeline, keyframes, transitions, word-level subtitle animation | Not implemented in this release |
| Google Drive OAuth, MCP connections, clippo.id publishing | Not implemented; not shown as active features |

## AI provider and quota behavior

Chat and transcription are independent capabilities. A chat completion model does not automatically support speech-to-text. Klipo can list models exposed by a compatible `/models` endpoint. Fallback models must be selected by the user; the app does not assume that another model is free or has the same capabilities.

An OpenRouter `free-models-per-day` 429 is an account quota condition, not an editor or laptop failure. Klipo reports it clearly and does not waste additional requests retrying the same exhausted free-model quota. An alternate model/provider may still require its own active quota or paid usage.

## Testing

Run:

    npm run check
    npm test

The Node test suite covers render argument safety, output profiles, RAM-aware defaults, AI provider behavior with mocked HTTP responses, highlight parsing, process handling, UI element contracts and synthetic FFmpeg/FFprobe end-to-end exports.

The Windows GitHub Actions workflow additionally builds the NSIS installer, installs it silently, launches the packaged app in smoke-test mode, verifies the new UI/bridge/output-profile/downloader resources, renders a synthetic video with audio through packaged FFmpeg and verifies it with packaged FFprobe, then uninstalls the app.

These automated checks do not substitute for real-world tests that require the user's private API keys, live website URLs, personal media, Windows laptop, or physical hardware drivers. See [docs/TESTING.md](docs/TESTING.md).

## Security and content rights

The renderer has no Node.js access. API keys remain in the Electron main process and are stored using OS-backed encryption where supported. User-provided URLs and media are treated as untrusted input. URL downloads must only be used for media the user is authorized to save. Klipo does not bypass DRM, paywalls, private access controls or platform restrictions.

## License

MIT for original repository source code. Third-party binaries, services and platforms retain their own licenses and terms.
