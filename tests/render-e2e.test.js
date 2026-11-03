"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { spawnSync } = require("node:child_process");
const ffmpegPath = require("ffmpeg-static");
const ffprobePackage = require("ffprobe-static");
const ffprobePath = ffprobePackage && ffprobePackage.path;
const { CAPTION_PRESETS } = require("../src/caption-presets");
const { buildRenderArgs, EFFECT_FILTERS } = require("../src/core/render-plan");

function run(command, args, label) {
  const result = spawnSync(command, args, {
    encoding: "utf8",
    windowsHide: true,
    timeout: 90000,
    maxBuffer: 16 * 1024 * 1024
  });
  if (result.error) throw result.error;
  assert.equal(
    result.status,
    0,
    label + " failed (exit " + result.status + ").\n" +
    String(result.stderr || result.stdout || "").slice(-5000)
  );
  return result;
}

function probe(filePath) {
  const result = run(ffprobePath, [
    "-v", "error", "-show_streams", "-show_format", "-of", "json", filePath
  ], "FFprobe inspection");
  return JSON.parse(result.stdout);
}

test("FFmpeg end-to-end renders synthetic audio/video with every effect and caption preset", {
  timeout: 300000
}, () => {
  assert.ok(ffmpegPath && fs.existsSync(ffmpegPath), "ffmpeg-static binary must exist");
  assert.ok(ffprobePath && fs.existsSync(ffprobePath), "ffprobe-static binary must exist");
  assert.equal(Object.keys(EFFECT_FILTERS).length, 9, "expected all nine effect definitions");

  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "klipo render, [e2e]-"));
  try {
    const inputPath = path.join(directory, "fixture.mp4");
    run(ffmpegPath, [
      "-hide_banner", "-y",
      "-f", "lavfi", "-i", "testsrc2=size=640x360:rate=15:duration=1.2",
      "-f", "lavfi", "-i", "sine=frequency=997:sample_rate=44100:duration=1.2",
      "-shortest", "-c:v", "libx264", "-preset", "ultrafast",
      "-pix_fmt", "yuv420p", "-c:a", "aac", "-b:a", "64k", inputPath
    ], "Synthetic fixture creation");

    const fixture = probe(inputPath);
    assert.ok(fixture.streams.some((stream) => stream.codec_type === "video"));
    assert.ok(fixture.streams.some((stream) => stream.codec_type === "audio"));

    for (const effectId of Object.keys(EFFECT_FILTERS)) {
      const outputPath = path.join(directory, "effect-" + effectId + ".mp4");
      const plan = buildRenderArgs({
        inputPath, outputPath, startSeconds: 0, durationSeconds: 0.7,
        width: 320, height: 240, fps: 15, threads: 1,
        mode: "cpu", effects: [effectId]
      }, { logicalCpus: 2 });
      run(ffmpegPath, plan.args, "Effect render: " + effectId);
      assert.ok(fs.statSync(outputPath).size > 1000, "effect output should not be empty: " + effectId);
    }

    const captionFilePath = path.join(directory, "caption.txt");
    fs.writeFileSync(captionFilePath, "Klipo caption smoke test", "utf8");
    for (const preset of CAPTION_PRESETS) {
      const outputPath = path.join(directory, "caption-" + preset.id + ".mp4");
      const plan = buildRenderArgs({
        inputPath, outputPath, startSeconds: 0, durationSeconds: 0.7,
        width: 320, height: 180, fps: 15, threads: 1,
        mode: "cpu", captionText: "Klipo caption smoke test",
        captionStyle: preset.id, captionFilePath
      }, { logicalCpus: 2 });
      run(ffmpegPath, plan.args, "Caption render: " + preset.id);
      assert.ok(fs.statSync(outputPath).size > 1000, "caption output should not be empty: " + preset.id);
    }

    const verificationPath = path.join(directory, "caption-classic.mp4");
    const metadata = probe(verificationPath);
    const video = metadata.streams.find((stream) => stream.codec_type === "video");
    const audio = metadata.streams.find((stream) => stream.codec_type === "audio");
    assert.equal(video.width, 320);
    assert.equal(video.height, 240);
    assert.ok(audio, "rendered output must retain source audio");
    assert.ok(Number(metadata.format.duration) >= 0.5);
  } finally {
    fs.rmSync(directory, { recursive: true, force: true });
  }
});
