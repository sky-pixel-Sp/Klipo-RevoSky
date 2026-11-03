"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const { runCapture } = require("../electron/process-utils");

test("runCapture returns stdout and stderr independently", async () => {
  const result = await runCapture(process.execPath, [
    "-e",
    "process.stdout.write('probe-json'); process.stderr.write('diagnostic-line');"
  ]);
  assert.equal(result.stdout, "probe-json");
  assert.equal(result.stderr, "diagnostic-line");
});

test("runCapture reports a non-zero exit with stderr", async () => {
  await assert.rejects(
    runCapture(process.execPath, ["-e", "process.stderr.write('intentional failure'); process.exit(7);"]),
    /intentional failure/
  );
});

test("runCapture terminates commands that exceed the timeout", async () => {
  await assert.rejects(
    runCapture(process.execPath, ["-e", "setTimeout(() => {}, 5000);"], 80),
    /timed out after 80 ms/
  );
});
