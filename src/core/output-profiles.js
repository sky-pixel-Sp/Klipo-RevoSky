"use strict";

(function attachOutputProfiles(root, factory) {
  const api = factory();
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  if (root) root.KlipoOutputProfiles = api;
})(typeof window !== "undefined" ? window : null, function createOutputProfiles() {
  const profiles = Object.freeze({
    vertical: Object.freeze({ id: "vertical", label: "Vertikal 9:16", width: 1080, height: 1920 }),
    landscape: Object.freeze({ id: "landscape", label: "Horizontal 16:9", width: 1920, height: 1080 }),
    square: Object.freeze({ id: "square", label: "Kotak 1:1", width: 1080, height: 1080 })
  });

  function getOutputProfile(id) {
    return profiles[id] || profiles.vertical;
  }

  return { profiles, getOutputProfile };
});
