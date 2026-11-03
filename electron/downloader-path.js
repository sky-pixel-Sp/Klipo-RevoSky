"use strict";

const fs = require("node:fs");
const path = require("node:path");

function resolveDownloaderPath(options = {}) {
  const resourcesPath = options.resourcesPath === undefined
    ? (typeof process.resourcesPath === "string" ? process.resourcesPath : "")
    : options.resourcesPath;
  const appDirectory = options.appDirectory || __dirname;
  const exists = options.exists || fs.existsSync;
  const platform = options.platform || process.platform;
  const candidates = [];

  if (resourcesPath) candidates.push(path.join(resourcesPath, "bin", "yt-dlp.exe"));
  candidates.push(path.join(appDirectory, "..", "vendor", "yt-dlp.exe"));

  for (const candidate of candidates) {
    try {
      if (exists(candidate)) return candidate;
    } catch (_error) {}
  }

  // Allow developers who run the app from source to use a PATH installation.
  return platform === "win32" ? "yt-dlp.exe" : "yt-dlp";
}

module.exports = { resolveDownloaderPath };
