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

test("every UI element id is unique and effects use explicit checkboxes", () => {
  const ids = Array.from(html.matchAll(/\bid="([^"]+)"/g), (match) => match[1]);
  assert.equal(ids.length, new Set(ids).size, "HTML must not contain duplicate element IDs");
  assert.match(html, /<div class="effects-grid" id="renderEffects">/);
  assert.match(html, /data-effect="cinematic"/);
  assert.doesNotMatch(html, /<select[^>]*multiple/);
});

test("all output aspect profiles are exposed to the renderer before it starts", () => {
  assert.match(html, /<script src="\.\/core\/output-profiles\.js"><\/script>\s*<script src="\.\/renderer\.js"><\/script>/);
  assert.match(renderer, /trimStartSlider/);
  assert.match(renderer, /trimDurationSlider/);
  assert.match(renderer, /chatFallbackModels/);
});
