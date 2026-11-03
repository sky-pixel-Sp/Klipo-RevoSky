"use strict";

const { spawn } = require("node:child_process");

function runCapture(command, args, timeoutMs = 12000) {
  return new Promise((resolve, reject) => {
    let child;
    try {
      child = spawn(command, args, { windowsHide: true, shell: false });
    } catch (error) {
      reject(error);
      return;
    }

    let stdout = "";
    let stderr = "";
    let timedOut = false;
    let settled = false;
    const finish = (error, value) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      if (error) reject(error);
      else resolve(value);
    };

    const timer = setTimeout(() => {
      timedOut = true;
      try { child.kill(); } catch (_error) {}
    }, Math.max(1, Number(timeoutMs) || 12000));

    child.stdout.on("data", (chunk) => {
      stdout += chunk.toString();
    });
    child.stderr.on("data", (chunk) => {
      stderr += chunk.toString();
      if (stderr.length > 16000) stderr = stderr.slice(-16000);
    });
    child.once("error", (error) => finish(error));
    child.once("close", (code, signal) => {
      if (timedOut) {
        finish(new Error("Command timed out after " + timeoutMs + " ms: " + command));
      } else if (code === 0) {
        finish(null, { stdout, stderr });
      } else {
        const detail = stderr.trim() || ("Command failed with code " + code + (signal ? " (" + signal + ")" : ""));
        finish(new Error(detail.slice(-1600)));
      }
    });
  });
}

module.exports = { runCapture };
