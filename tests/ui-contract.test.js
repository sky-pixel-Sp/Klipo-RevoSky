"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const html = fs.readFileSync(path.join(__dirname, "..", "src", "index.html"), "utf8");
const renderer = fs.readFileSync(path.join(__dirname, "..", "src", "renderer.js"), "utf8");

test("contains the five primary application workspaces", () => {
  for (const page of ["dashboard", "editor", "downloads", "ai", "settings"]) {
    assert.match(html, new RegExp('data-page-panel="' + page + '"'));
  }
});

test("all essential media, editing, AI and activity controls exist", () => {
  const required = [
    "globalImport", "videoPreview", "startSeconds", "durationSeconds",
    "outputAspect", "captionText", "captionStyle", "renderMode",
    "renderEncoder", "cpuThreads", "exportButton", "downloadUrl",
    "downloadButton", "chatForm", "chatMessages", "findHighlightsButton",
    "highlightResults", "chatBaseUrl", "chatModel", "chatFallbackModels",
    "chatApiKey", "loadChatModels", "saveAiSettings", "transcribeButton",
    "globalProgressBar", "cancelJob", "openOutput"
  ];
  for (const id of required) assert.match(html, new RegExp('id="' + id + '"'), "Missing UI control: " + id);
});

test("renderer uses the tested output profile module and model discovery bridge", () => {
  assert.match(html, /output-profiles\.js/);
  assert.match(renderer, /KlipoOutputProfiles\.getOutputProfile/);
  assert.match(renderer, /listAiModels/);
});
