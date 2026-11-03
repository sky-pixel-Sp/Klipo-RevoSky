# Testing strategy and current evidence

## Automated tests

Run on Node.js 22:

    npm install
    npm run check
    npm test

The test suite covers:

- Child-process stdout/stderr capture, non-zero exits and timeouts.
- Render-plan validation, CPU thread clamping, unsupported GPU encoder rejection, filter-path escaping and even output dimensions for yuv420p.
- AI highlight response parsing, timestamp range validation, overlap rejection, five-result limit and display-text bounds.
- A real FFmpeg end-to-end smoke test. It generates a synthetic test video with an audio track, renders each of the nine video effects and all 25 caption presets, then uses FFprobe to verify the resulting MP4 dimensions, duration and retained audio.

The FFmpeg smoke test intentionally uses a generated fixture. It does not require a private video or an external download.

## Checks that still require user/provider hardware

These are not covered by CI because they depend on private credentials, platform permissions or specific hardware:

- Live OpenAI-compatible chat requests and live timestamped transcription (response_format=verbose_json).
- AI highlight quality on a real creator video. The parser and timestamp safety checks are unit-tested, but model judgment is provider-dependent.
- yt-dlp downloads from a real source. Only download media that you own or are authorized to save; site access, cookies and platform restrictions vary.
- QSV, NVENC or AMF output on a physical device with compatible drivers. Listing an encoder is not proof that the driver can encode; choose CPU fallback if a real hardware render fails.
- Installer installation, app startup, import and export on the user's Windows 11 laptop.
- Google Drive OAuth, MCP client/server connections and clippo.id publishing. They are not implemented in this build; provider documentation, client configuration and explicit permissions are prerequisites.

## Interpreting CI

A successful Windows workflow means syntax checks passed, automated tests passed and the x64 NSIS installer was packaged and uploaded. It does not establish that private API credentials, remote services, platform downloads or every hardware encoder work on every machine.
