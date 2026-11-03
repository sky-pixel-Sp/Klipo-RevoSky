"use strict";

function parseHighlightPayload(content, videoDurationSeconds) {
  const raw = String(content || "").trim();
  if (!raw) throw new Error("The AI provider returned an empty highlight response.");

  const unfenced = raw.replace(/^\s*```(?:json)?\s*/i, "").replace(/\s*```\s*$/, "");
  const firstObject = unfenced.indexOf("{");
  const lastObject = unfenced.lastIndexOf("}");
  if (firstObject < 0 || lastObject <= firstObject) {
    throw new Error("The AI response did not contain a JSON highlight object.");
  }

  let payload;
  try {
    payload = JSON.parse(unfenced.slice(firstObject, lastObject + 1));
  } catch (_error) {
    throw new Error("The AI highlight response was not valid JSON.");
  }

  const duration = Number(videoDurationSeconds);
  if (!Number.isFinite(duration) || duration <= 0) {
    throw new Error("The selected video's duration is invalid.");
  }

  const source = Array.isArray(payload) ? payload : payload.highlights;
  if (!Array.isArray(source)) {
    throw new Error("The AI response is missing its highlights array.");
  }

  const results = [];
  for (const item of source) {
    if (!item || results.length >= 5) continue;
    const start = Number(item.start);
    const end = Number(item.end);
    if (!Number.isFinite(start) || !Number.isFinite(end)) continue;
    if (start < 0 || end <= start || end > duration + 0.05) continue;
    if (end - start < 2 || end - start > 60) continue;

    results.push({
      startSeconds: Math.round(start * 10) / 10,
      endSeconds: Math.round(Math.min(end, duration) * 10) / 10,
      durationSeconds: Math.round((Math.min(end, duration) - start) * 10) / 10,
      title: String(item.title || "Highlight").trim().slice(0, 80) || "Highlight",
      reason: String(item.reason || "").trim().slice(0, 240)
    });
  }

  if (!results.length) {
    throw new Error("The AI did not return any valid 2–60 second clips inside the video's duration.");
  }
  return results;
}

module.exports = { parseHighlightPayload };
