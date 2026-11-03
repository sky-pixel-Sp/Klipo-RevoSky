# Klipo RevoSky

Local-first Windows desktop video clipping and editing app. The project is under active MVP development.

## Current foundation

- Electron desktop app with context isolation, sandboxed renderer and an allow-listed preload bridge.
- Native multi-file media import and FFprobe inspection (duration, resolution, codecs, audio presence and size).
- Single-clip trim and MP4 export using a real FFmpeg child process.
- 25 subtitle/title presets rendered through FFmpeg drawtext.
- Nine selectable FFmpeg effects: cinematic, warm, monochrome, sharpen, vignette, soft focus, mirror, bright and muted.
- CPU encoding, detected QSV/NVENC/AMF hardware encoding, CPU-filter + hardware-encode hybrid mode, and configurable thread count.
- FFmpeg progress protocol, elapsed/ETA display, activity log and cancellation.
- Optional yt-dlp URL downloader for supported sites; availability depends on yt-dlp, platform policy, access and the user's rights.
- OpenAI-compatible AI chat endpoint configuration plus a separate audio transcription endpoint.
- API keys stored encrypted with Electron safeStorage when available.
- English default UI with an Indonesian navigation translation.
- Windows x64 NSIS packaging workflow and Node built-in unit tests.

## Quick start on Windows

Requirements: Windows 10/11 x64, Node.js 20.19+ (Node 22 LTS recommended), and 5 GB+ free disk space for build/dependency and temporary media files.

    git clone https://github.com/sky-pixel-Sp/Klipo-RevoSky.git
    cd Klipo-RevoSky
    npm install
    npm test
    npm run dev

Build the installer with: npm run dist:win

See docs/BUILD.md for Windows instructions and GitHub Actions artifact details.

## Hardware guidance

For an 8 GB RAM Intel Core i5-U laptop, begin with 720p or 1080x1920 output, CPU mode and 2-4 threads. Hardware encoding is shown only when the installed FFmpeg build lists a supported encoder. The driver/device must still pass a real render. CPU mode is the fallback. Hybrid means CPU-side filters plus GPU video encoding; it does not mean every filter is computed simultaneously by both processors.

## Implemented vs. not yet implemented

| Feature | Status |
|---|---|
| Local media import / preview / metadata | Implemented in this foundation |
| Single clip trim and MP4 render | Implemented |
| 25 FFmpeg caption presets | Implemented |
| Nine FFmpeg video effects | Implemented |
| CPU threads / QSV / NVENC / AMF discovery | Implemented with runtime availability checks |
| Render progress, ETA, log and cancel | Implemented for active FFmpeg jobs |
| URL downloader | yt-dlp integration; install separately and follow site rules |
| AI chat | OpenAI-compatible chat completions endpoint |
| AI transcription | Compatible /audio/transcriptions endpoint; video audio is extracted locally first |
| Multi-track timeline, transitions and keyframes | Planned |
| Automatic highlight detection / AI edit execution | Planned; assistant currently provides plans, not automatic timeline mutations |
| Google Drive OAuth | Planned; requires OAuth app setup and scopes |
| MCP server connection / random relay URL | Not enabled; must be built with explicit trust and permission handling |
| clippo.id login / publishing | Not enabled until official API docs and authorization are available |
| Cross-platform social search | Planned; requires permitted platform APIs or sources |

## Security and content rights

Renderer JavaScript receives no Node.js access and never receives API keys. File operations and child processes run in the Electron main process. URL downloads must only be used for content the user is authorized to save. The app does not attempt to bypass DRM, paywalls, private-content access controls or platform restrictions. Never commit API keys, account cookies or private media.

## Project documents

- docs/ARCHITECTURE.md — process boundaries and media pipeline.
- docs/BUILD.md — local development and Windows installer.
- docs/ROADMAP.md — milestones and external integrations.

## License

MIT for original repository source code. Third-party binaries, services and platforms retain their own licenses and terms.