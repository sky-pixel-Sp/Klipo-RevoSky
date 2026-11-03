"use strict";

const fs = require("node:fs/promises");
const path = require("node:path");
const { spawnSync } = require("node:child_process");

const DOWNLOAD_URL = "https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp.exe";
const outputPath = path.join(__dirname, "..", "vendor", "yt-dlp.exe");

async function main() {
  await fs.mkdir(path.dirname(outputPath), { recursive: true });

  console.log("Downloading official Windows yt-dlp binary...");
  const response = await fetch(DOWNLOAD_URL, { redirect: "follow" });
  if (!response.ok) {
    throw new Error("yt-dlp download failed with HTTP " + response.status + ".");
  }

  const bytes = Buffer.from(await response.arrayBuffer());
  if (bytes.length < 1024 * 1024 || bytes.subarray(0, 2).toString("ascii") !== "MZ") {
    throw new Error("Downloaded yt-dlp file failed basic Windows executable validation.");
  }

  const temporaryPath = outputPath + ".download";
  await fs.writeFile(temporaryPath, bytes);
  const check = spawnSync(temporaryPath, ["--version"], {
    encoding: "utf8",
    windowsHide: true,
    timeout: 30000
  });

  if (check.error || check.status !== 0 || !String(check.stdout || "").trim()) {
    await fs.rm(temporaryPath, { force: true });
    throw new Error("Downloaded yt-dlp binary failed its --version check: " +
      (check.error ? check.error.message : String(check.stderr || "unknown error")));
  }

  await fs.rename(temporaryPath, outputPath);
  console.log("Validated yt-dlp version " + String(check.stdout).trim() +
    " and saved it to " + outputPath);
}

main().catch((error) => {
  console.error("Could not prepare bundled yt-dlp:", error.message);
  process.exitCode = 1;
});
