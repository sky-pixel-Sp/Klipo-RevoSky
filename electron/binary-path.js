"use strict";

const fs = require("node:fs");

function resolvePackagedBinaryPath(candidate, exists = fs.existsSync) {
  if (typeof candidate !== "string" || !candidate) return null;

  // electron-builder stores asarUnpack contents beside app.asar. Some
  // static-binary packages still report the virtual app.asar path, which
  // exists to Electron's virtual filesystem but cannot be spawned by Windows.
  const unpackedCandidate = candidate.replace(/app\.asar(?=[\\/])/i, "app.asar.unpacked");
  if (unpackedCandidate !== candidate && exists(unpackedCandidate)) {
    return unpackedCandidate;
  }

  return exists(candidate) ? candidate : null;
}

module.exports = { resolvePackagedBinaryPath };
