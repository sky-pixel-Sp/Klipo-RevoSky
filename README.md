# Klipo RevoSky

A local-first AI clipping and video editing desktop application for Windows.

> Project status: foundation / MVP implementation. This repository is not yet a finished CapCut or Opus Clip replacement. External services (AI providers, platform download availability, Google Drive OAuth and clippo.id publishing) require real credentials, compatible APIs and provider/platform permission.

## Goals

- Native desktop workflow for Windows using Electron.
- Import local media and inspect it with FFmpeg/FFprobe.
- Trim and render clips offline with FFmpeg.
- CPU rendering, detected hardware encoders, and CPU-filter + hardware-encode hybrid mode.
- 20+ real FFmpeg-backed caption style presets.
- Transparent render job progress, logs and cancellation.
- Optional yt-dlp integration for URLs supported by yt-dlp, subject to platform terms, rights and authentication.
- OpenAI-compatible chat provider configuration plus a separate transcription endpoint configuration.
- English default UI; Indonesian translation included.

## Requirements

- Windows 10/11 x64.
- Node.js 20.19+ (Node 22 LTS recommended).
- FFmpeg and FFprobe (the app can use ffmpeg-static / ffprobe-static packages).
- Optional: yt-dlp on PATH for supported video URLs.
- Recommended for this MVP: 8 GB RAM, Intel Core i5-class CPU, SSD and adequate free disk space.

## Development

Install dependencies with npm install, then run npm run dev.
Run tests with npm test.
Create a Windows installer with npm run dist:win.
The Windows build is also configured in GitHub Actions. See docs/BUILD.md.

## Current implementation boundaries

| Capability | Status in this foundation |
|---|---|
| Local file import / metadata | Implemented in desktop main process |
| Trim and export MP4 | Implemented through FFmpeg |
| 20+ caption styles | Implemented as FFmpeg drawtext presets |
| CPU / hardware encoder selection | Encoder discovery + guarded selection |
| CPU threads | Configurable and clamped to available logical CPUs |
| Progress / logs / cancel | Implemented for FFmpeg render jobs |
| URL downloads | Optional yt-dlp integration; source/platform restrictions apply |
| AI chat | Configurable OpenAI-compatible chat endpoint |
| AI transcription | Configurable transcription endpoint; provider must support audio transcription |
| Google Drive | Not enabled until OAuth app credentials and scopes are configured |
| MCP | Planned adapter; no fabricated relay URLs or unauthenticated endpoints |
| clippo.id login/publishing | Not enabled without official API documentation and authorization |
| Social search / automatic trend discovery | Planned; must use permitted APIs or public sources |

## Security

API keys are encrypted with Electron safeStorage when available. Do not commit secrets, cookies, OAuth tokens, downloaded media or render outputs. Never use the app to bypass access controls or download content without permission.

## License

MIT for this repository's original source code. Third-party tools and services retain their own licenses and terms.