"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const { resolvePackagedBinaryPath } = require("../electron/binary-path");

test("prefers the physical asar.unpacked binary over the virtual asar path", () => {
  const virtualPath = "D:\\Apps\\Klipo\\resources\\app.asar\\node_modules\\ffmpeg-static\\ffmpeg.exe";
  const unpackedPath = "D:\\Apps\\Klipo\\resources\\app.asar.unpacked\\node_modules\\ffmpeg-static\\ffmpeg.exe";
  const existing = new Set([virtualPath, unpackedPath]);
  assert.equal(resolvePackagedBinaryPath(virtualPath, (value) => existing.has(value)), unpackedPath);
});

test("falls back to the original path when no unpacked copy exists", () => {
  const path = "D:\\Apps\\Klipo\\resources\\app.asar\\node_modules\\tool\\tool.exe";
  assert.equal(resolvePackagedBinaryPath(path, (value) => value === path), path);
});

test("keeps development binary paths unchanged", () => {
  const path = "D:\\Projects\\Klipo\\node_modules\\ffmpeg-static\\ffmpeg.exe";
  assert.equal(resolvePackagedBinaryPath(path, (value) => value === path), path);
});

test("returns null for missing binary candidates", () => {
  assert.equal(resolvePackagedBinaryPath("D:\\missing\\ffmpeg.exe", () => false), null);
  assert.equal(resolvePackagedBinaryPath("", () => true), null);
});
