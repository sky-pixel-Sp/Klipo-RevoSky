"use strict";

function recommendedThreadCount(totalMemoryBytes, logicalCpus) {
  const cpus = Math.max(1, Math.floor(Number(logicalCpus) || 1));
  const memory = Number(totalMemoryBytes) || 0;
  const gib = memory / (1024 ** 3);
  if (gib < 6) return 1;
  if (gib < 10) return Math.min(2, cpus);
  if (gib < 16) return Math.min(3, cpus);
  return Math.min(4, cpus);
}

function deviceProfile(totalMemoryBytes) {
  const gib = (Number(totalMemoryBytes) || 0) / (1024 ** 3);
  if (gib < 6) return "low-memory";
  if (gib < 10) return "balanced";
  if (gib < 16) return "standard";
  return "performance";
}

module.exports = { recommendedThreadCount, deviceProfile };
