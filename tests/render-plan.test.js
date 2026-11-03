"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const { CAPTION_PRESETS, getCaptionPreset } = require("../src/caption-presets");
const { buildRenderArgs, clampNumber, escapeFilterPath, EFFECT_FILTERS } = require("../src/core/render-plan");

test("there are at least 20 unique caption presets", () => {
  assert.ok(CAPTION_PRESETS.length >= 20);
  assert.equal(new Set(CAPTION_PRESETS.map((item) => item.id)).size, CAPTION_PRESETS.length);
});

test("unknown caption style falls back to classic", () => {
  assert.equal(getCaptionPreset("not-a-style").id, "classic");
});

test("CPU render plan uses libx264 and clamps threads", () => {
  const plan = buildRenderArgs({
    inputPath: "input.mp4", outputPath: "output.mp4",
    startSeconds: 2, durationSeconds: 18, threads: 99,
    captionText: "Hello world", captionStyle: "bold-outline", captionFilePath: "captions.txt",
    effects: ["cinematic", "vignette"]
  }, { logicalCpus: 8 });
  assert.equal(plan.codec, "libx264");
  assert.equal(plan.threads, 8);
  assert.ok(plan.args.includes("libx264"));
  assert.ok(plan.args.some((arg) => String(arg).includes("drawtext=")));
  assert.ok(plan.filters.includes(EFFECT_FILTERS.cinematic));
  assert.ok(plan.filters.includes(EFFECT_FILTERS.vignette));
});

test("GPU render mode refuses unsupported encoders", () => {
  assert.throws(() => buildRenderArgs({
    inputPath: "in.mp4", outputPath: "out.mp4", durationSeconds: 8,
    mode: "gpu", encoder: "h264_qsv", availableEncoders: []
  }), /unavailable/);
});

test("GPU render mode accepts a detected encoder", () => {
  const plan = buildRenderArgs({
    inputPath: "in.mp4", outputPath: "out.mp4", durationSeconds: 8,
    mode: "gpu", encoder: "h264_qsv", availableEncoders: ["h264_qsv"]
  });
  assert.equal(plan.codec, "h264_qsv");
});

test("unsupported effects are rejected rather than ignored", () => {
  assert.throws(() => buildRenderArgs({
    inputPath: "in.mp4", outputPath: "out.mp4", durationSeconds: 8,
    effects: ["make-believe-effect"]
  }), /Unsupported effect/);
});

test("clamp and Windows filter path escaping are deterministic", () => {
  assert.equal(clampNumber(100, 2, 1, 10), 10);
  assert.equal(escapeFilterPath("C:\\Media\\clip.mp4"), "C\\:/Media/clip.mp4");
});