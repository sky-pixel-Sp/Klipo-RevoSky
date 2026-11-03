# Testing strategy — Klipo RevoSky 0.2.0

## Local test commands

On Node.js 22:

    npm install
    npm run check
    npm test

## Automated coverage

- Process runner: stdout/stderr capture, non-zero exit and timeout handling.
- Render-plan builder: safe input validation, CPU thread clamping, rejection of unavailable GPU encoders, filter-path escaping, even dimensions and caption/effect composition.
- Output profiles: exact 9:16, 16:9 and 1:1 dimensions.
- Device profile: conservative thread defaults for low-memory, 8 GB, 16 GB and limited-CPU configurations.
- AI provider: OpenRouter free-model daily quota classification, auth/model errors, `/models` catalogue normalization, fallback selection, and no retry loop for exhausted daily quota. HTTP behavior is tested with deterministic mocked fetch functions; live provider credentials are not used by tests.
- Highlight parser: JSON parsing, timestamp bounds, overlap rejection, five-result limit and text bounds.
- UI contract: required pages, media controls, trim sliders, output ratio, model discovery, fallback configuration, activity and bridge calls.
- FFmpeg end-to-end: generated synthetic video with audio, all nine effects and 25 caption presets; FFprobe verifies output metadata and retained audio.
- Windows installed-app smoke test: silent NSIS install, Electron startup, page/preload contract, output-profile module, trim controls, packaged FFmpeg/FFprobe/yt-dlp presence, synthetic render, FFprobe output verification and silent uninstall.

## Manual tests still required

Automated tests cannot prove the following without the user's actual device, files, service credentials or platform conditions:

- Import and preview of the user's range of MP4/MOV/MKV/WebM/audio assets.
- Per-driver QSV/NVENC/AMF output on their physical laptop; CPU render is the baseline fallback.
- Actual download behavior against a permitted live URL. Site extractors, login requirements and platform policies change independently of Klipo.
- Live AI chat, model catalogue access and fallback model behavior with the user's active provider account and quota.
- Speech-to-text and AI highlight quality on a real video using a provider/model that supports timestamped `verbose_json`.
- Sustained export performance, memory pressure and UI responsiveness on the user's Windows 11 laptop.

Google Drive OAuth, MCP, multi-track timeline and clippo.id publishing are not part of the 0.2 implementation and are not counted as passing tests.

## Interpreting CI

A green workflow means the checked code passed syntax checks and tests, the NSIS installer built, the installed app passed the automated smoke check, FFmpeg rendered a synthetic clip that FFprobe accepted, yt-dlp was present in the packaged app, and uninstall completed. It does not prove that every external provider, website, private account or physical GPU works on every machine.
