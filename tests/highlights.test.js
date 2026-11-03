"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const { parseHighlightPayload } = require("../src/core/highlights");

test("parses fenced JSON and normalizes valid highlight timestamps", () => {
  const result = parseHighlightPayload(
    'Here are the picks:\n```json\n{"highlights":[{"start":2.34,"end":12.86,"title":"Strong opening","reason":"Clear hook"}]}\n```',
    30
  );
  assert.equal(result.length, 1);
  assert.deepEqual(result[0], {
    startSeconds: 2.3,
    endSeconds: 12.9,
    durationSeconds: 10.6,
    title: "Strong opening",
    reason: "Clear hook"
  });
});

test("rejects out-of-range, too-short and too-long suggestions", () => {
  const result = parseHighlightPayload(JSON.stringify({ highlights: [
    { start: -1, end: 8 },
    { start: 2, end: 3 },
    { start: 0, end: 61 },
    { start: 10, end: 20, title: "Valid" },
    { start: 20, end: 31, title: "Beyond end" }
  ] }), 30);
  assert.equal(result.length, 1);
  assert.equal(result[0].title, "Valid");
});

test("limits output to five suggestions and bounds display text", () => {
  const highlights = Array.from({ length: 8 }, (_, index) => ({
    start: index * 5, end: index * 5 + 4, title: "T".repeat(100), reason: "R".repeat(300)
  }));
  const result = parseHighlightPayload(JSON.stringify({ highlights }), 60);
  assert.equal(result.length, 5);
  assert.equal(result[0].title.length, 80);
  assert.equal(result[0].reason.length, 240);
});

test("rejects malformed or empty model output", () => {
  assert.throws(() => parseHighlightPayload("not json", 20), /JSON/);
  assert.throws(() => parseHighlightPayload('{"items":[]}', 20), /missing its highlights/);
  assert.throws(() => parseHighlightPayload('{"highlights":[]}', 20), /did not return/);
});
