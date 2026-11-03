"use strict";

const { getCaptionPreset } = require("../caption-presets");

const EFFECT_FILTERS = Object.freeze({
  cinematic: "eq=contrast=1.12:saturation=1.16:brightness=0.01",
  warm: "colorbalance=rs=0.06:gs=0.02:bs=-0.04",
  monochrome: "hue=s=0",
  sharpen: "unsharp=5:5:0.8:3:3:0.4",
  vignette: "vignette=PI/5",
  soft: "gblur=sigma=0.8",
  mirror: "hflip",
  bright: "eq=brightness=0.06:contrast=1.04",
  muted: "eq=saturation=0.78:contrast=1.04"
});

function clampNumber(value, fallback, min, max) {
  const number = Number(value);
  if (!Number.isFinite(number)) return fallback;
  return Math.min(max, Math.max(min, number));
}

function escapeFilterPath(value) {
  return String(value).replace(/\\/g, "/").replace(/:/g, "\\:").replace(/'/g, "\\'");
}

function buildRenderArgs(options, environment = {}) {
  const {
    inputPath, outputPath, captionFilePath, startSeconds, durationSeconds,
    width = 1080, height = 1920, fps = 30, threads = 4,
    mode = "cpu", encoder = "libx264", availableEncoders = []
  } = options || {};

  if (!inputPath || !outputPath) throw new Error("Input and output paths are required.");
  const start = clampNumber(startSeconds, 0, 0, 86400);
  const duration = clampNumber(durationSeconds, 15, 0.1, 86400);
  const w = Math.round(clampNumber(width, 1080, 240, 3840));
  const h = Math.round(clampNumber(height, 1920, 240, 3840));
  const rate = clampNumber(fps, 30, 15, 60);
  const maxThreads = Math.max(1, Number(environment.logicalCpus) || 1);
  const threadCount = Math.round(clampNumber(threads, Math.min(4, maxThreads), 1, maxThreads));

  let codec = "libx264";
  if (mode === "gpu" || mode === "hybrid") {
    const allowed = new Set(["h264_qsv", "h264_nvenc", "h264_amf"]);
    if (!allowed.has(encoder) || !availableEncoders.includes(encoder)) {
      throw new Error("Selected hardware encoder is unavailable in this FFmpeg build or on this device.");
    }
    codec = encoder;
  }

  const filters = [
    "scale=" + w + ":" + h + ":force_original_aspect_ratio=increase",
    "crop=" + w + ":" + h
  ];
  const requestedEffects = Array.isArray(options.effects) ? options.effects : [];
  for (const effectId of requestedEffects) {
    if (!Object.prototype.hasOwnProperty.call(EFFECT_FILTERS, effectId)) {
      throw new Error("Unsupported effect: " + effectId);
    }
    filters.push(EFFECT_FILTERS[effectId]);
  }
  filters.push("fps=" + rate, "format=yuv420p");

  const text = String(options.captionText || "").trim();
  if (text) {
    if (!captionFilePath) throw new Error("Caption text file was not prepared.");
    const preset = getCaptionPreset(options.captionStyle);
    const parts = [
      "drawtext=font='Arial'",
      "textfile='" + escapeFilterPath(captionFilePath) + "'",
      "reload=0", "expansion=none",
      "fontcolor=" + preset.fontColor,
      "fontsize=" + preset.fontSize,
      "borderw=" + preset.borderWidth,
      "bordercolor=" + preset.borderColor,
      "x=(w-text_w)/2",
      "y=" + preset.y
    ];
    if (preset.box) parts.push("box=1", "boxcolor=" + (preset.boxColor || "black@0.5"), "boxborderw=16");
    if (preset.shadow) parts.push("shadowcolor=black@0.8", "shadowx=" + preset.shadow, "shadowy=" + preset.shadow);
    filters.push(parts.join(":"));
  }

  const args = ["-hide_banner", "-y", "-ss", String(start), "-i", inputPath,
    "-t", String(duration), "-map", "0:v:0", "-map", "0:a?",
    "-filter_threads", String(threadCount), "-vf", filters.join(","), "-c:v", codec];

  if (codec === "libx264") args.push("-preset", "veryfast", "-crf", "22", "-threads", String(threadCount));
  else if (codec === "h264_qsv") args.push("-global_quality", "24", "-look_ahead", "0");
  else if (codec === "h264_nvenc") args.push("-preset", "p4", "-cq", "24");
  else if (codec === "h264_amf") args.push("-quality", "balanced", "-rc", "cqp", "-qp_i", "23", "-qp_p", "23");

  args.push("-c:a", "aac", "-b:a", "192k", "-movflags", "+faststart", "-progress", "pipe:1", "-nostats", outputPath);
  return { args, durationSeconds: duration, threads: threadCount, codec, mode, filters };
}

module.exports = { buildRenderArgs, clampNumber, escapeFilterPath, EFFECT_FILTERS };