# Product roadmap — Klipo RevoSky

## 0.2 — Usability rebuild

- Indonesian-first guided desktop interface and clear empty/loading/error/success states.
- Stable editor state across page navigation.
- Synchronized numeric and slider trim controls.
- Real portrait, landscape and square output profiles.
- Checkbox effect selection instead of an opaque multi-select.
- Conservative RAM-aware render thread defaults.
- Provider model discovery, explicitly selected fallback models and typed quota/auth/model errors.
- Bundled Windows yt-dlp with installed-app smoke verification.
- Main-process validation and FFprobe verification before an export is reported as complete.

## 0.3 — Editing depth

- Project save/restore with media relinking and explicit missing-file handling.
- Multi-clip timeline model with split, trim, reorder, undo/redo and autosave.
- Preview proxies and waveform caching for large source files.
- Subtitle segments, SRT/VTT import/export and word-level timing when supported by the selected transcription provider.
- Render queue with measured ETA, resumable metadata and resource limits.

## 0.4 — Production assistant

- Provider capability discovery (chat, transcription, vision) without assuming all models support every modality.
- Reversible AI edit plans with user approval and audit history.
- Local or remote transcription choices with clear system requirements.
- Scene/shot analysis only through verified model capabilities.

## Later integrations

- Google Drive OAuth with least-privilege scopes.
- MCP client with server identity, tool permissions and write confirmation.
- clippo.id publishing only after official API and authorization support are documented.

## Quality gates

- No fake or inactive buttons presented as working features.
- No successful job state until output verification passes.
- No AI quota retry loop that burns the same exhausted daily free quota.
- No API keys exposed to renderer JavaScript or logs.
- Feature availability must match real provider, platform and hardware capabilities.
