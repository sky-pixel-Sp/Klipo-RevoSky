# Windows build guide

## Prerequisites

1. Install Node.js 22 LTS (Node.js 20.19+ is the minimum supported version).
2. Install Git for Windows.
3. Use a Windows 10/11 x64 machine.
4. Ensure at least 5 GB of free disk space for dependencies, temporary render files and build output.
5. For URL imports, install yt-dlp separately and make sure yt-dlp is available in PowerShell PATH.

## Run from source

Open PowerShell in the cloned repository:

    npm install
    npm test
    npm run dev

## Produce an installer

    npm run dist:win

The NSIS installer is written to the release directory. The app bundles FFmpeg/FFprobe npm binaries for the target platform where package installation supports them. Verify the actual installer on a clean Windows machine before distribution.

## GitHub Actions

The workflow in .github/workflows/windows-build.yml runs tests and builds the x64 installer on Windows. Push to main or run it manually from the Actions tab. The workflow uploads the installer as a downloadable artifact.

## Hardware acceleration notes

The app inspects the FFmpeg encoder list before enabling QSV, NVENC or AMF. A listed encoder does not prove that a compatible GPU driver/device is currently usable; an actual render is the final check. CPU mode is the compatibility fallback. Hybrid mode means CPU-side filters with hardware video encoding, not that every effect is split across CPU and GPU.

## Laptop settings (8 GB RAM)

- Start with 720p or 1080x1920 output and 2-4 CPU threads.
- Use veryfast CPU encoding to keep interactive use responsive.
- Close memory-heavy apps while rendering.
- Prefer SSD scratch space and keep free disk headroom.
- Avoid loading large local language models on an 8 GB system; use remote AI APIs or lightweight services.
