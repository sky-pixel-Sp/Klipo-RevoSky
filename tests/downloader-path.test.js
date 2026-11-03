"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const path = require("node:path");
const { resolveDownloaderPath } = require("../electron/downloader-path");

test("prefers yt-dlp bundled in Electron resources", () => {
  const resourcesPath = path.join("test-root", "resources");
  const bundled = path.join(resourcesPath, "bin", "yt-dlp.exe");
  const result = resolveDownloaderPath({
    resourcesPath,
    appDirectory: path.join("source", "electron"),
    exists: (candidate) => candidate === bundled,
    platform: "win32"
  });
  assert.equal(result, bundled);
});

test("uses vendored yt-dlp when running from source", () => {
  const appDirectory = path.join("source", "electron");
  const vendored = path.join(appDirectory, "..", "vendor", "yt-dlp.exe");
  const result = resolveDownloaderPath({
    resourcesPath: "",
    appDirectory,
    exists: (candidate) => candidate === vendored,
    platform: "win32"
  });
  assert.equal(result, vendored);
});

test("falls back to a PATH executable when no bundled file exists", () => {
  assert.equal(resolveDownloaderPath({
    resourcesPath: "",
    appDirectory: "source/electron",
    exists: () => false,
    platform: "win32"
  }), "yt-dlp.exe");
});
