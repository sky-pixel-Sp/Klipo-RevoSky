# Architecture

## Process boundaries

- Electron main process: native dialogs, file-system access, FFmpeg/FFprobe child processes, yt-dlp process, encrypted credential persistence and remote API calls.
- Preload: small allow-listed IPC bridge only.
- Renderer: UI, media preview and editor controls. No Node integration, no direct filesystem access, and no API secrets.
- Core render-plan module: pure argument builder with validation, unit tested independently.

## Media render pipeline

1. User selects a local input file through the native file dialog.
2. FFprobe reads duration, dimensions, codecs and audio presence.
3. User chooses in/out, output dimensions, caption text/style, encoder and CPU thread count.
4. Main process writes caption text to an app-managed temporary file.
5. Render plan constructs an argument array; child process launches FFmpeg with shell disabled.
6. FFmpeg progress protocol is parsed into percentage, elapsed time and ETA.
7. Output is saved through a native save dialog; job log and errors are shown in the UI.

## AI provider model

Chat and transcription are separate capabilities. An OpenAI-compatible chat endpoint is not automatically a speech-to-text endpoint. The app stores credentials encrypted with Electron safeStorage when supported and never sends them to renderer code. Provider endpoints must be HTTPS except localhost development endpoints.

## Trust boundaries

User-supplied URLs, media files, API endpoints, model names and MCP server addresses are untrusted inputs. MCP is not yet connected in this milestone. Future MCP tools must be separately permissioned and require confirmation for destructive or external actions.
