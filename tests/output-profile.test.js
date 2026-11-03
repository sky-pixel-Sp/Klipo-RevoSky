"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const { getOutputProfile } = require("../src/core/output-profiles");
const { recommendedThreadCount, deviceProfile } = require("../src/core/device-profile");

test("provides real vertical, landscape and square export dimensions", () => {
  assert.deepEqual(
    [getOutputProfile("vertical").width, getOutputProfile("vertical").height],
    [1080, 1920]
  );
  assert.deepEqual(
    [getOutputProfile("landscape").width, getOutputProfile("landscape").height],
    [1920, 1080]
  );
  assert.deepEqual(
    [getOutputProfile("square").width, getOutputProfile("square").height],
    [1080, 1080]
  );
  assert.equal(getOutputProfile("unknown").id, "vertical");
});

test("chooses conservative CPU thread defaults using RAM and CPU count", () => {
  const gib = 1024 ** 3;
  assert.equal(recommendedThreadCount(4 * gib, 12), 1);
  assert.equal(recommendedThreadCount(8 * gib, 12), 2);
  assert.equal(recommendedThreadCount(16 * gib, 12), 4);
  assert.equal(recommendedThreadCount(32 * gib, 2), 2);
  assert.equal(deviceProfile(8 * gib), "balanced");
});
