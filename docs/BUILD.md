# Windows build guide — Klipo RevoSky 0.2.0

## Prerequisites

1. Windows 10/11 x64.
2. Node.js 22 LTS (Node 20.19+ is the minimum).
3. Git for Windows.
4. At least 5 GB free disk space for dependencies, media fixtures, temporary files and installer output.
5. A working network connection during the first installer build so the official yt-dlp Windows executable can be downloaded and validated.

## Install and run from source

Open PowerShell in the repository:

    npm install
    npm run check
    npm test
    npm run dev

## Build installer

    npm run dist:win

The `predist:win` lifecycle script downloads the official latest Windows `yt-dlp.exe` into `vendor/yt-dlp.exe`, checks the PE/MZ header, runs `yt-dlp --version`, then returns control to electron-builder. The executable is copied to the app's `resources/bin/yt-dlp.exe` directory. A downloader download or validation error must fail the build.

The installer is written into `release/`. It bundles platform-specific FFmpeg and FFprobe npm binaries as well as yt-dlp. End users do not need to install yt-dlp or edit Windows PATH.

## GitHub Actions

Pushes to `main` and `rebuild/**` run the Windows workflow. The workflow performs dependency installation, syntax checks, unit/integration tests, Windows NSIS packaging, silent installation, packaged-app smoke tests, a synthetic FFmpeg render and FFprobe verification, silent uninstallation, and artifact upload.

## Hardware acceleration

The application checks the encoder list returned by its FFmpeg build before offering QSV, NVENC or AMF. Encoder presence does not prove a compatible driver/device is usable. A physical output test is still required. CPU mode is the fallback. Hybrid mode means CPU filters plus hardware H.264 encode.

## Conservative 8 GB laptop defaults

- The app selects two CPU threads by default for a device between 6 and 10 GiB of RAM.
- Start with 720p or 1080×1920 content and CPU mode for the first test.
- Avoid running large local models on an 8 GB system.
- Keep adequate SSD scratch space and close memory-heavy applications during long renders.
