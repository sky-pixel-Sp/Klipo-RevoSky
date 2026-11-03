"use strict";

(() => {
  const state = {
    media: [], selected: null, appInfo: null, language: "en", page: "dashboard",
    messages: [], job: null, lastOutputPath: ""
  };
  const $ = (selector) => document.querySelector(selector);
  const $$ = (selector) => Array.from(document.querySelectorAll(selector));
  const formatTime = (seconds) => {
    const value = Math.max(0, Math.floor(Number(seconds) || 0));
    return String(Math.floor(value / 60)).padStart(2, "0") + ":" + String(value % 60).padStart(2, "0");
  };
  const formatBytes = (bytes) => {
    if (!Number.isFinite(bytes) || bytes <= 0) return "—";
    const units = ["B", "KB", "MB", "GB"];
    let value = bytes, unit = 0;
    while (value >= 1024 && unit < units.length - 1) { value /= 1024; unit += 1; }
    return value.toFixed(unit === 0 ? 0 : 1) + " " + units[unit];
  };

  function logLine(message, level = "info") {
    const node = document.createElement("div");
    node.className = "console-line " + level;
    const time = document.createElement("time");
    time.textContent = new Date().toLocaleTimeString();
    const text = document.createElement("span");
    text.textContent = String(message == null ? "" : message);
    node.append(time, text);
    $("#consoleLines").append(node);
    $("#consoleLines").scrollTop = $("#consoleLines").scrollHeight;
  }

  function setPage(page) {
    state.page = page;
    $$("[data-page-panel]").forEach((panel) => panel.classList.toggle("active", panel.dataset.pagePanel === page));
    $$(".nav-item[data-page]").forEach((item) => item.classList.toggle("active", item.dataset.page === page));
    const labels = { dashboard: "Home", editor: "Editor", downloads: "Downloads", ai: "AI Studio", settings: "Settings" };
    $("#pageBreadcrumb").textContent = labels[page] || "Home";
    if (page === "editor" && state.selected) updateEditorMedia();
    if (page === "ai") updateTranscriptionSource();
  }

  function setLanguage(language) {
    state.language = language === "id" ? "id" : "en";
    document.documentElement.lang = state.language;
    $("#languageToggle").textContent = state.language === "en" ? "EN ⌄" : "ID ⌄";
    const dict = state.language === "id"
      ? { navHome: "Beranda", navEditor: "Editor", navDownloads: "Unduhan", navAi: "Studio AI", navSettings: "Pengaturan", importMedia: "Impor media" }
      : { navHome: "Home", navEditor: "Editor", navDownloads: "Downloads", navAi: "AI Studio", navSettings: "Settings", importMedia: "Import media" };
    $$("[data-i18n]").forEach((node) => { node.textContent = dict[node.dataset.i18n] || node.textContent; });
    $("#settingsLanguage").value = state.language;
    localStorage.setItem("klipo-language", state.language);
  }

  async function importMedia() {
    try {
      const items = await window.klipo.importMedia();
      for (const item of items) {
        if (!state.media.some((media) => media.path === item.path)) state.media.push(item);
        if (item.error) logLine("Could not inspect " + item.name + ": " + item.error, "warning");
      }
      renderLibrary();
      const firstValid = items.find((item) => !item.error);
      if (firstValid) selectMedia(firstValid.path);
      if (items.length) setPage("editor");
    } catch (error) { logLine("Import failed: " + error.message, "error"); }
  }

  function selectMedia(filePath) {
    state.selected = state.media.find((item) => item.path === filePath) || null;
    updateEditorMedia();
    updateTranscriptionSource();
    renderLibrary();
  }

  function renderLibrary() {
    const library = $("#libraryList");
    library.replaceChildren();
    const valid = state.media.filter((item) => !item.error);
    if (!valid.length) {
      const empty = document.createElement("div");
      empty.className = "library-empty";
      empty.textContent = state.language === "id" ? "Belum ada media" : "No imported media yet";
      library.append(empty);
    }
    valid.forEach((item) => {
      const button = document.createElement("button");
      button.className = "library-item" + (state.selected && state.selected.path === item.path ? " selected" : "");
      const icon = document.createElement("span");
      icon.className = "library-file-icon";
      icon.textContent = "▣";
      const name = document.createElement("span");
      name.className = "library-file-name";
      name.textContent = item.name;
      button.append(icon, name);
      button.addEventListener("click", () => { selectMedia(item.path); setPage("editor"); });
      library.append(button);
    });
    const recent = $("#recentMedia");
    recent.replaceChildren();
    if (!valid.length) {
      const empty = document.createElement("div");
      empty.className = "empty-state";
      const icon = document.createElement("div");
      icon.className = "empty-icon";
      icon.textContent = "▧";
      const heading = document.createElement("strong");
      heading.textContent = "Your workspace is ready";
      const description = document.createElement("p");
      description.textContent = "Import a video to see its preview, duration, resolution and editing controls here.";
      const choose = document.createElement("button");
      choose.className = "button button-secondary";
      choose.textContent = "Choose a media file";
      choose.addEventListener("click", importMedia);
      empty.append(icon, heading, description, choose);
      recent.append(empty);
    } else {
      valid.slice(-6).reverse().forEach((item) => {
        const card = document.createElement("button");
        card.className = "recent-card";
        const thumb = document.createElement("span");
        thumb.className = "recent-card-thumb";
        thumb.textContent = "▶";
        const details = document.createElement("span");
        details.className = "recent-card-details";
        const name = document.createElement("strong");
        name.textContent = item.name;
        const meta = document.createElement("small");
        meta.textContent = formatTime(item.durationSeconds) + " · " + item.width + " × " + item.height + " · " + formatBytes(item.sizeBytes);
        details.append(name, meta);
        card.append(thumb, details);
        card.addEventListener("click", () => { selectMedia(item.path); setPage("editor"); });
        recent.append(card);
      });
    }
  }

  function updateEditorMedia() {
    const item = state.selected;
    const video = $("#videoPreview");
    if (!item) {
      video.pause();
      video.removeAttribute("src");
      video.hidden = true;
      $("#previewEmpty").hidden = false;
      $("#selectedName").textContent = "No media selected";
      $("#selectedMeta").textContent = "Import a video to begin editing";
      $("#previewResolution").textContent = "No media selected";
      $("#timelineDuration").textContent = "00:00";
      $("#startSeconds").max = 0;
      $("#durationSeconds").value = 15;
      return;
    }
    $("#selectedName").textContent = item.name;
    $("#selectedMeta").textContent = formatTime(item.durationSeconds) + " · " + item.width + " × " + item.height + " · " + formatBytes(item.sizeBytes);
    $("#previewResolution").textContent = item.width + " × " + item.height;
    $("#timelineDuration").textContent = formatTime(item.durationSeconds);
    $("#startSeconds").max = Math.max(0, item.durationSeconds - 0.1);
    $("#startSeconds").value = 0;
    $("#durationSeconds").max = Math.max(0.1, item.durationSeconds);
    $("#durationSeconds").value = Math.min(30, Math.max(0.1, item.durationSeconds || 15)).toFixed(1);
    $("#transcribeSource").textContent = item.name;
    if (item.width && item.height) {
      video.src = item.previewUrl;
      video.hidden = false;
      $("#previewEmpty").hidden = true;
      video.load();
    } else {
      video.hidden = true;
      $("#previewEmpty").hidden = false;
    }
    updateCaptionPreview();
  }

  function updateTranscriptionSource() {
    $("#transcribeSource").textContent = state.selected ? state.selected.name : "No media selected";
    $("#transcribeButton").disabled = !state.selected;
    $("#findHighlightsButton").disabled = !state.selected || !state.selected.hasAudio || !state.selected.width || !state.selected.height;
    $("#highlightStatus").textContent = !state.selected
      ? "Import and select a video with audio first."
      : (!state.selected.width || !state.selected.height)
        ? "Select a video file with audio, not an audio-only file."
        : state.selected.hasAudio
          ? "Ready to analyze " + state.selected.name + "."
          : "This video has no audio track.";
  }

  function populateCaptionStyles() {
    const styles = [
      ["classic", "Classic White"], ["bold-outline", "Bold Outline"], ["yellow-pop", "Yellow Pop"],
      ["cyan-pop", "Cyan Pop"], ["red-alert", "Red Alert"], ["minimal", "Minimal Clean"],
      ["soft-shadow", "Soft Shadow"], ["creator-bold", "Creator Bold"], ["gold-cinema", "Cinema Gold"],
      ["pink-highlight", "Pink Highlight"], ["green-marker", "Green Marker"], ["documentary", "Documentary"],
      ["blue-karaoke", "Blue Karaoke"], ["news-bar", "News Bar"], ["comic", "Comic Impact"],
      ["pastel", "Pastel Soft"], ["mono", "Mono Terminal"], ["elegant", "Elegant Serif"],
      ["sports", "Sports Energy"], ["high-contrast", "High Contrast"], ["vintage", "Vintage Cream"],
      ["lavender", "Lavender Glow"], ["orange", "Orange Punch"], ["lower-third", "Lower Third"],
      ["compact", "Compact Subtitle"]
    ];
    styles.forEach(([id, label]) => {
      const option = document.createElement("option");
      option.value = id;
      option.textContent = label;
      $("#captionStyle").append(option);
    });
  }

  function updateCaptionPreview() {
    const sample = $("#styleSample");
    const overlay = $("#captionOverlay");
    const value = $("#captionText").value.trim() || "Your caption preview";
    sample.textContent = value;
    overlay.textContent = value;
    overlay.hidden = !$("#captionText").value.trim();
    sample.className = "style-sample style-" + $("#captionStyle").value;
    overlay.className = "caption-overlay style-" + $("#captionStyle").value;
  }

  function configureHardware() {
    const info = state.appInfo;
    if (!info) return;
    const ram = formatBytes(info.totalMemoryBytes);
    $("#deviceCpu").textContent = info.cpuModel;
    $("#deviceMemory").textContent = ram + " RAM · " + info.logicalCpus + " logical CPUs";
    $("#deviceEncoder").textContent = info.encoders.length ? info.encoders.join(", ") : "CPU encoder available";
    $("#specCpu").textContent = info.cpuModel;
    $("#specThreads").textContent = info.logicalCpus;
    $("#specMemory").textContent = ram;
    $("#specEncoders").textContent = info.encoders.join(", ") || "No hardware encoder detected";
    $("#specFfmpeg").textContent = info.ffmpegAvailable ? "Available" : "Not found";
    $("#specYtdlp").textContent = info.downloaderAvailable ? "Available" : "Not installed";
    $("#ytStatus").textContent = info.downloaderAvailable ? "yt-dlp detected on this device." : "yt-dlp not installed or not in PATH.";
    $("#ytStatusDot").classList.toggle("inactive", !info.downloaderAvailable);
    const threadControl = $("#cpuThreads");
    threadControl.max = String(Math.max(1, info.logicalCpus));
    threadControl.value = String(Math.min(4, info.logicalCpus));
    $("#threadValue").textContent = threadControl.value;

    const encoder = $("#renderEncoder");
    encoder.replaceChildren();
    const choices = [{ value: "h264_qsv", label: "Intel Quick Sync" }, { value: "h264_nvenc", label: "NVIDIA NVENC" }, { value: "h264_amf", label: "AMD AMF" }];
    const available = choices.filter((choice) => info.encoders.includes(choice.value));
    if (!available.length) {
      const option = document.createElement("option");
      option.value = "";
      option.textContent = "No supported hardware encoder detected";
      encoder.append(option);
      encoder.disabled = true;
    } else {
      available.forEach((choice) => {
        const option = document.createElement("option");
        option.value = choice.value;
        option.textContent = choice.label;
        encoder.append(option);
      });
      encoder.disabled = false;
    }
  }

  async function exportVideo() {
    if (!state.selected) { logLine("Import a video before exporting.", "warning"); return; }
    const start = Number($("#startSeconds").value || 0);
    const duration = Number($("#durationSeconds").value || 0);
    if (!Number.isFinite(duration) || duration <= 0 || start + duration > state.selected.durationSeconds + 0.05) {
      logLine("Check the clip start and duration values.", "warning");
      return;
    }
    const mode = $("#renderMode").value;
    if (mode !== "cpu" && !$("#renderEncoder").value) {
      logLine("No compatible hardware encoder is available. Choose CPU mode.", "warning");
      return;
    }
    const selectedEffects = Array.from($("#renderEffects").selectedOptions).map((option) => option.value);
    const estimatedMb = (duration * 7.2) / 8;
    logLine("Preparing MP4 export · estimated video size around " + estimatedMb.toFixed(1) + " MB. Actual size varies with content.");
    $("#exportButton").disabled = true;
    const result = await window.klipo.startRender({
      inputPath: state.selected.path,
      startSeconds: start,
      durationSeconds: duration,
      width: 1080,
      height: 1920,
      fps: Number($("#outputFps").value),
      threads: Number($("#cpuThreads").value),
      mode,
      encoder: $("#renderEncoder").value,
      effects: selectedEffects,
      captionText: $("#captionText").value,
      captionStyle: $("#captionStyle").value
    });
    if (!result.started) {
      $("#exportButton").disabled = false;
      if (!result.canceled) logLine(result.error || "Export was not started.", "error");
    } else {
      $("#exportButton").querySelector("span").textContent = "…";
      $("#jobConsole").scrollIntoView({ behavior: "smooth", block: "nearest" });
    }
  }

  async function downloadFromUrl() {
    const url = $("#downloadUrl").value.trim();
    if (!url) { logLine("Paste a video URL first.", "warning"); return; }
    $("#downloadButton").disabled = true;
    const result = await window.klipo.startDownload(url);
    if (!result.started) {
      $("#downloadButton").disabled = false;
      if (!result.canceled) logLine(result.error || "Download was not started.", "error");
    }
  }

  async function transcribeSelected() {
    if (!state.selected) return;
    $("#transcribeButton").disabled = true;
    $("#transcribeButton").textContent = "Transcribing…";
    try {
      const text = await window.klipo.transcribeMedia(state.selected.path);
      $("#transcriptOutput").value = text;
      logLine("Transcription finished. Review the text before using it as a caption.");
    } catch (error) { logLine("Transcription failed: " + error.message, "error"); }
    finally { $("#transcribeButton").disabled = false; $("#transcribeButton").textContent = "Transcribe selected file"; }
  }

  function renderHighlightResults(highlights) {
    const container = $("#highlightResults");
    container.replaceChildren();
    if (!highlights.length) {
      const empty = document.createElement("div");
      empty.className = "highlight-empty";
      empty.textContent = "No valid highlights were returned.";
      container.append(empty);
      return;
    }

    highlights.forEach((item, index) => {
      const card = document.createElement("article");
      card.className = "highlight-card";
      const heading = document.createElement("div");
      heading.className = "highlight-card-heading";
      const title = document.createElement("strong");
      title.textContent = item.title || ("Highlight " + (index + 1));
      const time = document.createElement("span");
      time.textContent = formatTime(item.startSeconds) + " – " + formatTime(item.endSeconds);
      heading.append(title, time);
      const reason = document.createElement("p");
      reason.textContent = item.reason || "Suggested from the timestamped transcript.";
      const apply = document.createElement("button");
      apply.className = "text-button";
      apply.textContent = "Use this clip range in Editor →";
      apply.addEventListener("click", () => {
        if (!state.selected) return;
        setPage("editor");
        $("#startSeconds").value = item.startSeconds.toFixed(1);
        $("#durationSeconds").value = item.durationSeconds.toFixed(1);
        logLine("Applied AI highlight range: " + title.textContent + " (" + time.textContent + "). Review it before exporting.");
      });
      card.append(heading, reason, apply);
      container.append(card);
    });
  }

  async function findHighlights() {
    if (!state.selected) return;
    const button = $("#findHighlightsButton");
    button.disabled = true;
    button.textContent = "Analyzing transcript…";
    $("#highlightStatus").textContent = "Extracting audio, requesting timestamps and ranking moments…";
    try {
      const highlights = await window.klipo.findHighlights(state.selected.path);
      renderHighlightResults(highlights);
      $("#highlightStatus").textContent = highlights.length + " clip suggestions ready. Review each range before export.";
      logLine("AI highlight analysis returned " + highlights.length + " validated clip suggestions.");
    } catch (error) {
      $("#highlightStatus").textContent = error.message;
      logLine("AI highlight analysis failed: " + error.message, "error");
    } finally {
      button.disabled = !state.selected || !state.selected.hasAudio || !state.selected.width || !state.selected.height;
      button.textContent = "Find highlights in selected media";
    }
  }

  function appendChat(role, content) {
    const row = document.createElement("div");
    row.className = role === "user" ? "user-message" : "assistant-message";
    if (role !== "user") {
      const avatar = document.createElement("div");
      avatar.className = "assistant-avatar";
      avatar.textContent = "✳";
      row.append(avatar);
    }
    const body = document.createElement("div");
    const heading = document.createElement("strong");
    heading.textContent = role === "user" ? "You" : "Klipo Assistant";
    const text = document.createElement("p");
    text.textContent = content;
    body.append(heading, text);
    row.append(body);
    $("#chatMessages").append(row);
    $("#chatMessages").scrollTop = $("#chatMessages").scrollHeight;
  }

  async function sendChat() {
    const input = $("#chatInput");
    const text = input.value.trim();
    if (!text) return;
    input.value = "";
    state.messages.push({ role: "user", content: text });
    appendChat("user", text);
    $("#chatSend").disabled = true;
    try {
      const response = await window.klipo.askAi(state.messages);
      state.messages.push({ role: "assistant", content: response });
      appendChat("assistant", response);
    } catch (error) {
      appendChat("assistant", "I could not complete that request: " + error.message);
    } finally { $("#chatSend").disabled = false; }
  }

  async function saveAiSettings() {
    const feedback = $("#settingsFeedback");
    feedback.textContent = "Saving securely…";
    try {
      const result = await window.klipo.saveAiSettings({
        chatBaseUrl: $("#chatBaseUrl").value.trim(),
        chatModel: $("#chatModel").value.trim(),
        chatApiKey: $("#chatApiKey").value,
        transcriptionBaseUrl: $("#transcriptionBaseUrl").value.trim(),
        transcriptionModel: $("#transcriptionModel").value.trim(),
        transcriptionApiKey: $("#transcriptionApiKey").value
      });
      $("#chatApiKey").value = "";
      $("#transcriptionApiKey").value = "";
      feedback.textContent = "Settings saved. Chat " + (result.chatConfigured ? "configured" : "not configured") + "; transcription " + (result.transcriptionConfigured ? "configured" : "not configured") + ".";
      await loadAiSettings();
    } catch (error) { feedback.textContent = error.message; }
  }

  async function loadAiSettings() {
    const settings = await window.klipo.getAiSettings();
    $("#chatBaseUrl").value = settings.chatBaseUrl;
    $("#chatModel").value = settings.chatModel;
    $("#transcriptionBaseUrl").value = settings.transcriptionBaseUrl;
    $("#transcriptionModel").value = settings.transcriptionModel;
    $("#chatConfigStatus").textContent = settings.chatConfigured ? "● Chat credentials saved" : "○ Chat not configured";
    $("#transcriptionConfigStatus").textContent = settings.transcriptionConfigured ? "● Transcription credentials saved" : "○ Transcription not configured";
    $("#chatStatus").textContent = settings.chatConfigured ? "CONNECTED CONFIGURATION" : "NOT CONFIGURED";
  }

  async function addDownloadedMedia(filePath) {
    if (!filePath) return;
    try {
      const item = await window.klipo.inspectDownloaded(filePath);
      if (!state.media.some((media) => media.path === item.path)) state.media.push(item);
      selectMedia(item.path);
      renderLibrary();
      setPage("editor");
      logLine("Downloaded media was added to your editor library: " + item.name);
    } catch (error) {
      logLine("Download completed, but Klipo could not import the file automatically: " + error.message, "warning");
    }
  }

  function handleJobUpdate(update) {
    state.job = update;
    const percent = Math.max(0, Math.min(100, Number(update.percent || 0)));
    $("#globalProgressBar").style.width = percent + "%";
    $("#globalProgressText").textContent = update.status === "complete" ? "100%" : update.status === "running" ? Math.round(percent) + "%" : update.status;
    $("#cancelJob").disabled = update.status !== "running";
    $("#openOutput").hidden = !update.outputPath || update.status !== "complete";
    if (update.outputPath && update.status === "complete") state.lastOutputPath = update.outputPath;
    if (update.kind === "download") {
      $("#downloadProgressBar").style.width = percent + "%";
      $("#downloadProgressLabel").textContent = update.status.toUpperCase();
      $("#downloadStatus").textContent = update.status === "complete" ? "Download completed." : update.status === "error" ? update.error : "Downloading… " + Math.round(percent) + "%";
      if (update.status !== "running") $("#downloadButton").disabled = false;
    }
    if (update.status === "running") {
      const eta = Number.isFinite(update.etaSeconds) ? " · about " + Math.ceil(update.etaSeconds) + " sec remaining" : "";
      $("#jobEta").textContent = "Job running" + eta;
    } else if (update.status === "complete") {
      $("#jobEta").textContent = "Completed successfully";
      $("#exportButton").disabled = false;
      $("#exportButton").querySelector("span").textContent = "↗";
      logLine("Output ready: " + (update.outputPath || "download folder"));
      if (update.kind === "download" && update.outputPath) addDownloadedMedia(update.outputPath);
    } else if (update.status === "error") {
      $("#jobEta").textContent = update.error || "Job failed";
      $("#exportButton").disabled = false;
      $("#exportButton").querySelector("span").textContent = "↗";
    } else if (update.status === "canceled") {
      $("#jobEta").textContent = "Job canceled";
      $("#exportButton").disabled = false;
      $("#exportButton").querySelector("span").textContent = "↗";
    }
  }

  function bindEvents() {
    $$("[data-page]").forEach((button) => button.addEventListener("click", () => setPage(button.dataset.page)));
    $$("[data-go]").forEach((button) => button.addEventListener("click", () => setPage(button.dataset.go)));
    $("#globalImport").addEventListener("click", importMedia);
    ["#dashboardImport", "#emptyImport", "#editorImport", "#previewImport"].forEach((selector) => $(selector).addEventListener("click", importMedia));
    $("#dashboardOpenEditor").addEventListener("click", () => setPage("editor"));
    $("#removeSelected").addEventListener("click", () => { state.selected = null; updateEditorMedia(); updateTranscriptionSource(); renderLibrary(); });
    $("#captionText").addEventListener("input", updateCaptionPreview);
    $("#captionStyle").addEventListener("change", updateCaptionPreview);
    $("#exportButton").addEventListener("click", exportVideo);
    $("#downloadButton").addEventListener("click", downloadFromUrl);
    $("#transcribeButton").addEventListener("click", transcribeSelected);
    $("#findHighlightsButton").addEventListener("click", findHighlights);
    $("#useTranscript").addEventListener("click", () => {
      $("#captionText").value = $("#transcriptOutput").value;
      updateCaptionPreview();
      setPage("editor");
    });
    $("#chatForm").addEventListener("submit", (event) => { event.preventDefault(); sendChat(); });
    $("#saveAiSettings").addEventListener("click", saveAiSettings);
    $("#cpuThreads").addEventListener("input", (event) => { $("#threadValue").textContent = event.target.value; });
    $("#renderMode").addEventListener("change", () => {
      const hardware = $("#renderMode").value !== "cpu";
      $("#renderEncoder").disabled = !hardware || !state.appInfo || state.appInfo.encoders.length === 0;
      $("#encoderHint").textContent = hardware ? "Uses CPU filters with the selected hardware H.264 encoder. Driver/device availability is confirmed by a real render." : "CPU mode uses software H.264 encoding.";
    });
    $("#useFullClip").addEventListener("click", () => {
      if (!state.selected) return;
      $("#startSeconds").value = 0;
      $("#durationSeconds").value = Math.min(30, state.selected.durationSeconds).toFixed(1);
    });
    $("#languageToggle").addEventListener("click", () => setLanguage(state.language === "en" ? "id" : "en"));
    $("#settingsLanguage").addEventListener("change", (event) => setLanguage(event.target.value));
    $("#cancelJob").addEventListener("click", async () => { await window.klipo.cancelJob(); });
    $("#clearLogs").addEventListener("click", () => $("#consoleLines").replaceChildren());
    $("#openOutput").addEventListener("click", () => { if (state.lastOutputPath) window.klipo.openPath(state.lastOutputPath); });
    $("#videoPreview").addEventListener("timeupdate", () => {
      const video = $("#videoPreview");
      if (video.duration) $("#startSeconds").dataset.playhead = video.currentTime.toFixed(1);
    });
  }

  async function boot() {
    populateCaptionStyles();
    bindEvents();
    state.language = localStorage.getItem("klipo-language") || "en";
    setLanguage(state.language);
    window.klipo.onJobUpdate(handleJobUpdate);
    window.klipo.onJobLog((entry) => logLine(entry.message, entry.level));
    try {
      state.appInfo = await window.klipo.getAppInfo();
      configureHardware();
      logLine("Device detected: " + state.appInfo.cpuModel + " · " + state.appInfo.logicalCpus + " logical CPUs.");
      if (state.appInfo.downloaderAvailable) logLine("yt-dlp is available on PATH.");
    } catch (error) { logLine("Hardware detection failed: " + error.message, "warning"); }
    try { await loadAiSettings(); } catch (error) { logLine("Could not load AI settings: " + error.message, "warning"); }
    renderLibrary();
    updateCaptionPreview();
  }

  document.addEventListener("DOMContentLoaded", boot);
})();