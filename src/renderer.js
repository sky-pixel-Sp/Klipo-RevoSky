"use strict";

(() => {
  const state = {
    media: [],
    selectedPath: "",
    selected: null,
    appInfo: null,
    page: "dashboard",
    messages: [],
    job: null,
    lastOutputPath: "",
    lastChatPrompt: "",
    toastTimer: null
  };

  const $ = (selector) => document.querySelector(selector);
  const $$ = (selector) => Array.from(document.querySelectorAll(selector));

  function formatTime(seconds) {
    const total = Math.max(0, Math.floor(Number(seconds) || 0));
    const hours = Math.floor(total / 3600);
    const minutes = Math.floor((total % 3600) / 60);
    const remainder = total % 60;
    return (hours ? String(hours).padStart(2, "0") + ":" : "") +
      String(minutes).padStart(2, "0") + ":" + String(remainder).padStart(2, "0");
  }

  function formatBytes(bytes) {
    if (!Number.isFinite(Number(bytes)) || Number(bytes) <= 0) return "—";
    const units = ["B", "KB", "MB", "GB", "TB"];
    let value = Number(bytes);
    let unit = 0;
    while (value >= 1024 && unit < units.length - 1) {
      value /= 1024;
      unit += 1;
    }
    return value.toFixed(unit === 0 ? 0 : 1) + " " + units[unit];
  }

  function toast(message, kind = "info") {
    const node = $("#toast");
    node.textContent = String(message || "");
    node.className = "toast" + (kind === "error" ? " error" : "");
    node.hidden = false;
    clearTimeout(state.toastTimer);
    state.toastTimer = setTimeout(() => { node.hidden = true; }, 5200);
  }

  function logLine(message, level = "info") {
    const container = $("#consoleLines");
    if (!container) return;
    const node = document.createElement("div");
    node.className = "console-line " + level;
    const time = document.createElement("time");
    time.textContent = new Date().toLocaleTimeString();
    const value = document.createElement("span");
    value.textContent = String(message == null ? "" : message);
    node.append(time, value);
    container.append(node);
    while (container.children.length > 120) container.firstElementChild.remove();
    container.scrollTop = container.scrollHeight;
  }

  function setPage(page) {
    const allowed = new Set(["dashboard", "editor", "downloads", "ai", "settings"]);
    state.page = allowed.has(page) ? page : "dashboard";
    $$("[data-page-panel]").forEach((panel) => {
      panel.classList.toggle("active", panel.dataset.pagePanel === state.page);
    });
    $$(".nav-item[data-page]").forEach((item) => {
      item.classList.toggle("active", item.dataset.page === state.page);
    });
    const labels = {
      dashboard: "Beranda",
      editor: "Editor video",
      downloads: "Unduh media",
      ai: "Studio AI",
      settings: "Pengaturan"
    };
    $("#pageBreadcrumb").textContent = labels[state.page];
    if (state.page === "editor") updateTranscriptionSource();
    if (state.page === "ai") updateTranscriptionSource();
  }

  function appendChat(role, content, retryPrompt = "") {
    const container = $("#chatMessages");
    const row = document.createElement("div");
    row.className = role === "user" ? "user-message" : role === "error" ? "error-message" : "assistant-message";

    if (role === "assistant") {
      const avatar = document.createElement("div");
      avatar.className = "assistant-avatar";
      avatar.textContent = "✳";
      row.append(avatar);
    } else if (role === "error") {
      const avatar = document.createElement("div");
      avatar.className = "assistant-avatar";
      avatar.textContent = "!";
      row.append(avatar);
    }

    const body = document.createElement("div");
    const heading = document.createElement("strong");
    heading.textContent = role === "user" ? "Kamu" : role === "error" ? "Permintaan belum berhasil" : "Klipo Assistant";
    const paragraph = document.createElement("p");
    paragraph.textContent = String(content || "");
    body.append(heading, paragraph);

    if (role === "error" && retryPrompt) {
      const retry = document.createElement("button");
      retry.type = "button";
      retry.className = "retry-chat";
      retry.textContent = "Coba kirim lagi →";
      retry.addEventListener("click", () => sendChat(retryPrompt));
      body.append(retry);
    }

    row.append(body);
    container.append(row);
    container.scrollTop = container.scrollHeight;
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
    const select = $("#captionStyle");
    select.replaceChildren();
    styles.forEach(([id, label]) => {
      const option = document.createElement("option");
      option.value = id;
      option.textContent = label;
      select.append(option);
    });
  }

  function updateCaptionPreview() {
    const text = $("#captionText").value.trim();
    const display = text || "Pratinjau caption";
    const style = "style-" + $("#captionStyle").value;
    $("#styleSample").textContent = display;
    $("#styleSample").className = "style-sample " + style;
    $("#captionOverlay").textContent = text;
    $("#captionOverlay").className = "caption-overlay " + style;
    $("#captionOverlay").hidden = !text || !state.selected || !state.selected.width;
  }

  function updateClipRangeControls() {
    if (!state.selected) return;
    const total = Math.max(0.1, Number(state.selected.durationSeconds) || 0.1);
    const start = Math.min(Math.max(0, Number($("#startSeconds").value) || 0), Math.max(0, total - 0.1));
    const duration = Math.min(Math.max(0.1, Number($("#durationSeconds").value) || 0.1), Math.max(0.1, total - start));
    $("#startSeconds").max = String(Math.max(0, total - 0.1));
    $("#durationSeconds").min = "0.1";
    $("#durationSeconds").max = String(Math.max(0.1, total - start));
    $("#startSeconds").value = start.toFixed(1);
    $("#durationSeconds").value = duration.toFixed(1);

    $("#trimStartSlider").max = String(Math.max(0, total - 0.1));
    $("#trimStartSlider").value = String(start);
    $("#trimDurationSlider").max = String(Math.max(0.1, total - start));
    $("#trimDurationSlider").value = String(duration);
    $("#startRangeValue").textContent = start.toFixed(1) + " s";
    $("#durationRangeValue").textContent = duration.toFixed(1) + " s";
  }

  function updateEditorMedia(resetRange = false) {
    const item = state.selected;
    const video = $("#videoPreview");
    if (!item) {
      video.pause();
      video.removeAttribute("src");
      video.hidden = true;
      $("#previewEmpty").hidden = false;
      $("#selectedName").textContent = "Belum ada media dipilih";
      $("#selectedMeta").textContent = "Impor video untuk mulai mengedit";
      $("#previewResolution").textContent = "Belum ada media";
      $("#timelineDuration").textContent = "00:00";
      $("#captionOverlay").hidden = true;
      $("#startSeconds").value = "0";
      $("#durationSeconds").value = "15";
      $("#trimStartSlider").value = "0";
      $("#trimDurationSlider").value = "15";
      $("#startRangeValue").textContent = "0.0 s";
      $("#durationRangeValue").textContent = "15.0 s";
      return;
    }

    $("#selectedName").textContent = item.name;
    $("#selectedMeta").textContent = formatTime(item.durationSeconds) + " · " +
      item.width + " × " + item.height + " · " + formatBytes(item.sizeBytes);
    $("#previewResolution").textContent = item.width + " × " + item.height;
    $("#timelineDuration").textContent = formatTime(item.durationSeconds);

    if (item.width && item.height && item.previewUrl) {
      if (video.src !== item.previewUrl) {
        video.src = item.previewUrl;
        video.load();
      }
      video.hidden = false;
      $("#previewEmpty").hidden = true;
    } else {
      video.pause();
      video.removeAttribute("src");
      video.hidden = true;
      $("#previewEmpty").hidden = false;
    }

    if (resetRange) {
      $("#startSeconds").value = "0";
      $("#durationSeconds").value = Math.min(30, Math.max(0.1, item.durationSeconds || 15)).toFixed(1);
    }
    updateClipRangeControls();
    updateCaptionPreview();
    updateTranscriptionSource();
  }

  function selectMedia(filePath) {
    const item = state.media.find((entry) => entry.path === filePath && !entry.error);
    if (!item) return;
    const changed = state.selectedPath !== item.path;
    state.selectedPath = item.path;
    state.selected = item;
    updateEditorMedia(changed);
    updateTranscriptionSource();
    renderLibrary();
  }

  function renderLibrary() {
    const library = $("#libraryList");
    library.replaceChildren();
    const valid = state.media.filter((item) => !item.error);
    $("#libraryCount").textContent = String(valid.length);

    if (!valid.length) {
      const empty = document.createElement("div");
      empty.className = "library-empty";
      empty.textContent = "Belum ada media. Impor video untuk memulai.";
      library.append(empty);
    }

    valid.forEach((item) => {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "library-item" + (state.selectedPath === item.path ? " selected" : "");
      const icon = document.createElement("span");
      icon.className = "library-file-icon";
      icon.textContent = "▣";
      const name = document.createElement("span");
      name.className = "library-file-name";
      name.textContent = item.name;
      button.append(icon, name);
      button.title = item.name;
      button.addEventListener("click", () => {
        selectMedia(item.path);
        setPage("editor");
      });
      library.append(button);
    });

    const recent = $("#recentMedia");
    recent.replaceChildren();
    if (!valid.length) {
      const empty = document.createElement("div");
      empty.className = "empty-state";
      const icon = document.createElement("div");
      icon.className = "empty-state-icon";
      icon.textContent = "▧";
      const heading = document.createElement("strong");
      heading.textContent = "Workspace masih kosong";
      const description = document.createElement("p");
      description.textContent = "Impor video untuk melihat durasi, resolusi, dan kontrol editing.";
      const choose = document.createElement("button");
      choose.type = "button";
      choose.className = "button button-secondary";
      choose.textContent = "Pilih video";
      choose.addEventListener("click", importMedia);
      empty.append(icon, heading, description, choose);
      recent.append(empty);
      return;
    }

    valid.slice(-6).reverse().forEach((item) => {
      const card = document.createElement("button");
      card.type = "button";
      card.className = "recent-card";
      const thumb = document.createElement("span");
      thumb.className = "recent-card-thumb";
      thumb.textContent = "▶";
      const details = document.createElement("span");
      details.className = "recent-card-details";
      const name = document.createElement("strong");
      name.textContent = item.name;
      const meta = document.createElement("small");
      meta.textContent = formatTime(item.durationSeconds) + " · " + item.width + " × " + item.height +
        " · " + formatBytes(item.sizeBytes);
      details.append(name, meta);
      card.append(thumb, details);
      card.addEventListener("click", () => {
        selectMedia(item.path);
        setPage("editor");
      });
      recent.append(card);
    });
  }

  async function importMedia() {
    const buttons = ["#globalImport", "#dashboardImport", "#editorImport", "#previewImport", "#emptyImport", "#emptyImportFallback"];
    buttons.forEach((selector) => { const node = $(selector); if (node) node.disabled = true; });
    try {
      const items = await window.klipo.importMedia();
      if (!Array.isArray(items) || !items.length) return;
      for (const item of items) {
        const existing = state.media.findIndex((media) => media.path === item.path);
        if (existing >= 0) state.media[existing] = item;
        else state.media.push(item);
        if (item.error) logLine("Gagal membaca " + item.name + ": " + item.error, "warning");
      }
      renderLibrary();
      const firstValid = items.find((item) => !item.error);
      if (firstValid) {
        selectMedia(firstValid.path);
        setPage("editor");
        logLine("Media siap diedit: " + firstValid.name);
      } else {
        toast("File dipilih, tetapi tidak ada media yang dapat dibaca.", "error");
      }
    } catch (error) {
      logLine("Impor gagal: " + error.message, "error");
      toast("Impor media gagal: " + error.message, "error");
    } finally {
      buttons.forEach((selector) => { const node = $(selector); if (node) node.disabled = false; });
    }
  }

  function updateTranscriptionSource() {
    const item = state.selected;
    $("#transcribeSource").textContent = item ? item.name : "Belum ada media dipilih";
    $("#transcribeSource").classList.toggle("empty", !item);
    $("#transcribeButton").disabled = !item || !item.hasAudio;
    $("#findHighlightsButton").disabled = !item || !item.hasAudio || !item.width || !item.height;

    if (!item) {
      $("#highlightStatus").textContent = "Impor video dengan audio untuk memulai.";
    } else if (!item.width || !item.height) {
      $("#highlightStatus").textContent = "File audio saja tidak dapat dianalisis sebagai video highlight.";
    } else if (!item.hasAudio) {
      $("#highlightStatus").textContent = "Video ini tidak memiliki audio.";
    } else {
      $("#highlightStatus").textContent = "Siap menganalisis " + item.name + ".";
    }
  }

  function configureHardware() {
    const info = state.appInfo;
    if (!info) return;
    const ram = formatBytes(info.totalMemoryBytes);
    $("#deviceCpu").textContent = info.cpuModel || "CPU tidak diketahui";
    $("#deviceMemory").textContent = ram + " RAM · " + info.logicalCpus + " logical CPU";
    $("#deviceEncoder").textContent = info.encoders && info.encoders.length
      ? info.encoders.join(", ") : "Encoder CPU tersedia";
    $("#specCpu").textContent = info.cpuModel || "Unknown";
    $("#specThreads").textContent = String(info.logicalCpus || "—");
    $("#specMemory").textContent = ram;
    $("#specProfile").textContent = String(info.memoryProfile || "balanced");
    $("#specEncoders").textContent = (info.encoders || []).join(", ") || "Tidak terdeteksi";
    $("#specFfmpeg").textContent = info.ffmpegAvailable && info.ffprobeAvailable ? "FFmpeg + FFprobe siap" : "Binary media tidak lengkap";
    $("#specYtdlp").textContent = info.downloaderAvailable ? "Tersedia (bundled)" : "Tidak ditemukan";

    const recommended = Math.max(1, Number(info.recommendedThreads) || 2);
    const threadControl = $("#cpuThreads");
    threadControl.max = String(Math.max(1, Number(info.logicalCpus) || 1));
    threadControl.value = String(Math.min(Number(threadControl.max), recommended));
    $("#threadValue").textContent = threadControl.value;

    const encoder = $("#renderEncoder");
    encoder.replaceChildren();
    const choices = [
      ["h264_qsv", "Intel Quick Sync"],
      ["h264_nvenc", "NVIDIA NVENC"],
      ["h264_amf", "AMD AMF"]
    ];
    const available = choices.filter(([value]) => (info.encoders || []).includes(value));
    if (!available.length) {
      const option = document.createElement("option");
      option.value = "";
      option.textContent = "Tidak ada encoder hardware yang terdeteksi";
      encoder.append(option);
      encoder.disabled = true;
    } else {
      available.forEach(([value, label]) => {
        const option = document.createElement("option");
        option.value = value;
        option.textContent = label;
        encoder.append(option);
      });
    }
    updateRenderMode();
    $("#ytStatus").textContent = info.downloaderAvailable
      ? "yt-dlp bawaan Klipo tersedia."
      : "yt-dlp tidak ditemukan. Instal ulang Klipo untuk memulihkannya.";
    $("#ytStatusDot").classList.toggle("inactive", !info.downloaderAvailable);
  }

  function updateRenderMode() {
    const hardware = $("#renderMode").value !== "cpu";
    const hasEncoder = Boolean(state.appInfo && state.appInfo.encoders && state.appInfo.encoders.length);
    $("#renderEncoder").disabled = !hardware || !hasEncoder;
    $("#encoderHint").textContent = hardware
      ? "Filter tetap berjalan di CPU; video dikodekan dengan encoder hardware. Jika render gagal, pilih CPU."
      : "CPU adalah mode paling kompatibel. Jumlah thread disarankan dari RAM perangkat.";
  }

  function selectedEffectIds() {
    return $$("[data-effect]:checked").map((input) => input.dataset.effect);
  }

  function syncTrimFromInput() {
    if (!state.selected) return;
    updateClipRangeControls();
    const start = Number($("#startSeconds").value || 0);
    const video = $("#videoPreview");
    if (Number.isFinite(start) && video.readyState >= 1 && start < video.duration) {
      video.currentTime = start;
    }
  }

  async function exportVideo() {
    const item = state.selected;
    if (!item || !item.width || !item.height) {
      toast("Impor video terlebih dahulu sebelum mengekspor.", "error");
      return;
    }

    const start = Number($("#startSeconds").value || 0);
    const duration = Number($("#durationSeconds").value || 0);
    if (!Number.isFinite(start) || !Number.isFinite(duration) || start < 0 || duration <= 0 ||
        start + duration > item.durationSeconds + 0.05) {
      toast("Periksa waktu awal dan durasi klip. Rentang harus berada di dalam video.", "error");
      return;
    }

    const mode = $("#renderMode").value;
    if (mode !== "cpu" && !$("#renderEncoder").value) {
      toast("Tidak ada encoder hardware yang tersedia. Pilih mode CPU.", "error");
      return;
    }

    const profile = window.KlipoOutputProfiles.getOutputProfile($("#outputAspect").value);
    const button = $("#exportButton");
    button.disabled = true;
    button.querySelector("span").textContent = "…";
    logLine("Menyiapkan ekspor " + profile.label + " · " + duration.toFixed(1) + " detik.");

    try {
      const result = await window.klipo.startRender({
        inputPath: item.path,
        startSeconds: start,
        durationSeconds: duration,
        width: profile.width,
        height: profile.height,
        fps: Number($("#outputFps").value),
        threads: Number($("#cpuThreads").value),
        mode,
        encoder: $("#renderEncoder").value,
        effects: selectedEffectIds(),
        captionText: $("#captionText").value,
        captionStyle: $("#captionStyle").value
      });
      if (!result.started) {
        button.disabled = false;
        button.querySelector("span").textContent = "↗";
        if (!result.canceled) toast(result.error || "Ekspor tidak dapat dimulai.", "error");
      } else {
        $("#jobEta").textContent = "Render sedang berjalan…";
        $("#jobStatusTop").textContent = "Render berjalan";
        $("#jobConsole").scrollIntoView({ behavior: "smooth", block: "nearest" });
      }
    } catch (error) {
      button.disabled = false;
      button.querySelector("span").textContent = "↗";
      logLine("Ekspor gagal dimulai: " + error.message, "error");
      toast("Ekspor gagal: " + error.message, "error");
    }
  }

  async function downloadFromUrl() {
    const input = $("#downloadUrl");
    const url = input.value.trim();
    if (!url) {
      toast("Masukkan URL video terlebih dahulu.", "error");
      input.focus();
      return;
    }

    const button = $("#downloadButton");
    button.disabled = true;
    try {
      const result = await window.klipo.startDownload(url);
      if (!result.started) {
        button.disabled = false;
        if (!result.canceled) toast(result.error || "Unduhan tidak dapat dimulai.", "error");
      } else {
        $("#downloadStatus").textContent = "Sedang mengunduh…";
        $("#downloadProgressLabel").textContent = "RUNNING";
        $("#jobStatusTop").textContent = "Unduhan berjalan";
      }
    } catch (error) {
      button.disabled = false;
      logLine("Unduhan gagal dimulai: " + error.message, "error");
      toast("Unduhan gagal: " + error.message, "error");
    }
  }

  async function transcribeSelected() {
    if (!state.selected || !state.selected.hasAudio) return;
    const button = $("#transcribeButton");
    button.disabled = true;
    button.textContent = "Mentranskripsikan…";
    try {
      const text = await window.klipo.transcribeMedia(state.selected.path);
      $("#transcriptOutput").value = text;
      logLine("Transkripsi selesai. Periksa hasil sebelum menggunakannya sebagai caption.");
      toast("Transkripsi selesai.");
    } catch (error) {
      logLine("Transkripsi gagal: " + error.message, "error");
      toast("Transkripsi gagal: " + error.message, "error");
    } finally {
      button.disabled = !state.selected || !state.selected.hasAudio;
      button.textContent = "Transkripsikan media terpilih";
    }
  }

  function renderHighlightResults(highlights) {
    const container = $("#highlightResults");
    container.replaceChildren();
    if (!Array.isArray(highlights) || !highlights.length) {
      const empty = document.createElement("div");
      empty.className = "highlight-empty";
      empty.textContent = "AI tidak mengembalikan rentang highlight yang valid.";
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
      reason.textContent = item.reason || "Saran berdasarkan transkrip bertimestamp.";
      const apply = document.createElement("button");
      apply.type = "button";
      apply.className = "text-link";
      apply.textContent = "Gunakan rentang ini di editor →";
      apply.addEventListener("click", () => {
        if (!state.selected) return;
        setPage("editor");
        $("#startSeconds").value = item.startSeconds.toFixed(1);
        $("#durationSeconds").value = item.durationSeconds.toFixed(1);
        updateClipRangeControls();
        logLine("Rentang highlight diterapkan. Tinjau hasilnya sebelum ekspor.");
      });
      card.append(heading, reason, apply);
      container.append(card);
    });
  }

  async function findHighlights() {
    if (!state.selected) return;
    const button = $("#findHighlightsButton");
    button.disabled = true;
    button.textContent = "Menganalisis…";
    $("#highlightStatus").textContent = "Mengekstrak audio, meminta transkrip bertimestamp, dan menilai momen…";
    try {
      const highlights = await window.klipo.findHighlights(state.selected.path);
      renderHighlightResults(highlights);
      $("#highlightStatus").textContent = highlights.length + " saran siap. Pilih saran untuk menerapkannya ke editor.";
      logLine("Analisis AI menghasilkan " + highlights.length + " saran highlight yang lolos validasi.");
    } catch (error) {
      $("#highlightStatus").textContent = error.message;
      logLine("Analisis highlight gagal: " + error.message, "error");
      toast("Analisis highlight gagal: " + error.message, "error");
    } finally {
      button.disabled = !state.selected || !state.selected.hasAudio || !state.selected.width || !state.selected.height;
      button.textContent = "✦ Cari highlight";
    }
  }

  async function sendChat(prompt) {
    const message = String(prompt == null ? $("#chatInput").value : prompt).trim();
    if (!message) return;
    if (message.length > 4000) {
      toast("Pesan terlalu panjang. Maksimum 4.000 karakter.", "error");
      return;
    }

    $("#chatInput").value = "";
    $("#chatSend").disabled = true;
    state.lastChatPrompt = message;
    appendChat("user", message);

    const nextMessages = state.messages.concat([{ role: "user", content: message }]);
    try {
      const response = await window.klipo.askAi(nextMessages);
      state.messages = nextMessages.concat([{ role: "assistant", content: response }]);
      appendChat("assistant", response);
    } catch (error) {
      // Failed prompts are not added to the conversation history. Retry will submit
      // the prompt once, not replay every failed request from the current session.
      appendChat("error", error.message || "Provider AI tidak dapat menyelesaikan permintaan.", message);
      logLine("Permintaan AI gagal: " + error.message, "warning");
    } finally {
      $("#chatSend").disabled = false;
      $("#chatInput").focus();
    }
  }

  async function loadAiSettings() {
    const settings = await window.klipo.getAiSettings();
    $("#chatBaseUrl").value = settings.chatBaseUrl || "https://openrouter.ai/api/v1";
    $("#chatModel").value = settings.chatModel || "";
    $("#chatFallbackModels").value = Array.isArray(settings.chatFallbackModels)
      ? settings.chatFallbackModels.join(", ") : "";
    $("#transcriptionBaseUrl").value = settings.transcriptionBaseUrl || "https://api.openai.com/v1";
    $("#transcriptionModel").value = settings.transcriptionModel || "whisper-1";
    $("#chatConfigStatus").textContent = settings.chatConfigured
      ? "● API key tersimpan aman · model " + (settings.chatModel || "belum dipilih")
      : "○ Chat AI belum dikonfigurasi";
    $("#transcriptionConfigStatus").textContent = settings.transcriptionConfigured
      ? "● Endpoint transkripsi sudah dikonfigurasi"
      : "○ Transkripsi belum dikonfigurasi";
    $("#chatStatus").textContent = settings.chatConfigured ? "TERKONFIGURASI" : "BELUM DIATUR";
    $("#chatStatus").classList.toggle("configured", Boolean(settings.chatConfigured));
  }

  async function saveAiSettings() {
    const feedback = $("#settingsFeedback");
    const button = $("#saveAiSettings");
    button.disabled = true;
    feedback.textContent = "Menyimpan kredensial secara aman…";
    try {
      const result = await window.klipo.saveAiSettings({
        chatBaseUrl: $("#chatBaseUrl").value.trim(),
        chatModel: $("#chatModel").value.trim(),
        chatFallbackModels: $("#chatFallbackModels").value,
        chatApiKey: $("#chatApiKey").value,
        transcriptionBaseUrl: $("#transcriptionBaseUrl").value.trim(),
        transcriptionModel: $("#transcriptionModel").value.trim(),
        transcriptionApiKey: $("#transcriptionApiKey").value
      });
      $("#chatApiKey").value = "";
      $("#transcriptionApiKey").value = "";
      await loadAiSettings();
      feedback.textContent = "Tersimpan. Chat: " + (result.chatConfigured ? "siap" : "belum lengkap") +
        " · Transkripsi: " + (result.transcriptionConfigured ? "siap" : "belum lengkap") + ".";
      toast("Pengaturan AI berhasil disimpan.");
    } catch (error) {
      feedback.textContent = error.message;
      toast("Pengaturan tidak tersimpan: " + error.message, "error");
    } finally {
      button.disabled = false;
    }
  }

  async function loadChatModels() {
    const button = $("#loadChatModels");
    const feedback = $("#chatConfigStatus");
    button.disabled = true;
    button.textContent = "Memuat…";
    try {
      const models = await window.klipo.listAiModels({
        baseUrl: $("#chatBaseUrl").value.trim(),
        apiKey: $("#chatApiKey").value
      });
      const datalist = $("#chatModelSuggestions");
      datalist.replaceChildren();
      models.forEach((model) => {
        const option = document.createElement("option");
        option.value = model.id;
        option.label = model.name && model.name !== model.id ? model.name : model.id;
        datalist.append(option);
      });
      feedback.textContent = models.length
        ? "Koneksi katalog berhasil · " + models.length + " model tersedia. Pilih salah satu dari daftar model."
        : "Koneksi berhasil, tetapi provider tidak mengembalikan katalog model.";
      if (!$("#chatModel").value && models.length) $("#chatModel").value = models[0].id;
      toast(models.length + " model berhasil dimuat.");
    } catch (error) {
      feedback.textContent = error.message;
      toast("Tidak dapat memuat model: " + error.message, "error");
    } finally {
      button.disabled = false;
      button.textContent = "Muat model";
    }
  }

  async function addDownloadedMedia(filePath) {
    if (!filePath) return;
    try {
      const item = await window.klipo.inspectDownloaded(filePath);
      if (!state.media.some((media) => media.path === item.path)) state.media.push(item);
      renderLibrary();
      selectMedia(item.path);
      setPage("editor");
      logLine("Media hasil unduhan sudah masuk ke editor: " + item.name);
      toast("Media berhasil diimpor ke editor.");
    } catch (error) {
      logLine("Unduhan selesai tetapi file tidak dapat diimpor otomatis: " + error.message, "warning");
      toast("Unduhan selesai, tetapi impor otomatis gagal: " + error.message, "error");
    }
  }

  function handleJobUpdate(update) {
    state.job = update;
    const percent = Math.max(0, Math.min(100, Number(update.percent) || 0));
    $("#globalProgressBar").style.width = percent + "%";
    $("#globalProgressText").textContent = update.status === "complete"
      ? "100%" : update.status === "running" ? Math.round(percent) + "%" : String(update.status || "SIAP").toUpperCase();
    $("#cancelJob").disabled = update.status !== "running";
    $("#jobStatusTop").textContent = update.status === "running"
      ? (update.kind === "download" ? "Unduhan berjalan" : "Render berjalan")
      : update.status === "complete" ? "Pekerjaan selesai"
        : update.status === "error" ? "Pekerjaan gagal"
          : update.status === "canceled" ? "Dibatalkan" : "Siap digunakan";

    $("#openOutput").hidden = !update.outputPath || update.status !== "complete";
    if (update.outputPath && update.status === "complete") state.lastOutputPath = update.outputPath;

    if (update.kind === "download") {
      $("#downloadProgressBar").style.width = percent + "%";
      $("#downloadProgressLabel").textContent = String(update.status || "").toUpperCase();
      $("#downloadStatus").textContent = update.status === "complete"
        ? "Unduhan selesai." : update.status === "error" ? (update.error || "Unduhan gagal.")
          : update.status === "canceled" ? "Unduhan dibatalkan."
            : "Mengunduh… " + Math.round(percent) + "%";
      if (update.status !== "running") $("#downloadButton").disabled = false;
    }

    if (update.status === "running") {
      const eta = Number.isFinite(update.etaSeconds)
        ? " · perkiraan " + Math.ceil(update.etaSeconds) + " detik tersisa" : "";
      $("#jobEta").textContent = (update.kind === "download" ? "Unduhan berjalan" : "Render berjalan") + eta;
    } else if (update.status === "complete") {
      $("#jobEta").textContent = "Selesai · " + (update.outputPath || "file tersimpan");
      $("#exportButton").disabled = false;
      $("#exportButton").querySelector("span").textContent = "↗";
      logLine("Hasil siap: " + (update.outputPath || "folder unduhan"));
      if (update.kind === "download" && update.outputPath) addDownloadedMedia(update.outputPath);
      toast(update.kind === "download" ? "Unduhan selesai." : "Ekspor video selesai.");
    } else if (update.status === "error") {
      $("#jobEta").textContent = update.error || "Pekerjaan gagal";
      $("#exportButton").disabled = false;
      $("#exportButton").querySelector("span").textContent = "↗";
      logLine(update.error || "Pekerjaan gagal.", "error");
      toast(update.error || "Pekerjaan gagal.", "error");
    } else if (update.status === "canceled") {
      $("#jobEta").textContent = "Pekerjaan dibatalkan";
      $("#exportButton").disabled = false;
      $("#exportButton").querySelector("span").textContent = "↗";
      toast("Pekerjaan dibatalkan.");
    }
  }

  function bindEvents() {
    $$("[data-page]").forEach((button) => {
      button.addEventListener("click", () => setPage(button.dataset.page));
    });
    $$("[data-go]").forEach((button) => {
      button.addEventListener("click", (event) => {
        event.preventDefault();
        setPage(button.dataset.go);
      });
    });

    ["#globalImport", "#dashboardImport", "#editorImport", "#previewImport", "#emptyImport", "#emptyImportFallback"]
      .forEach((selector) => $(selector).addEventListener("click", importMedia));
    $("#dashboardOpenEditor").addEventListener("click", () => setPage("editor"));
    $("#removeSelected").addEventListener("click", () => {
      state.selectedPath = "";
      state.selected = null;
      updateEditorMedia(true);
      updateTranscriptionSource();
      renderLibrary();
    });

    $("#captionText").addEventListener("input", updateCaptionPreview);
    $("#captionStyle").addEventListener("change", updateCaptionPreview);
    $("#exportButton").addEventListener("click", exportVideo);
    $("#downloadButton").addEventListener("click", downloadFromUrl);
    $("#transcribeButton").addEventListener("click", transcribeSelected);
    $("#findHighlightsButton").addEventListener("click", findHighlights);
    $("#useTranscript").addEventListener("click", () => {
      $("#captionText").value = $("#transcriptOutput").value.slice(0, 500);
      updateCaptionPreview();
      setPage("editor");
      toast("Teks transkrip dimasukkan ke caption.");
    });
    $("#chatForm").addEventListener("submit", (event) => {
      event.preventDefault();
      sendChat();
    });
    $("#saveAiSettings").addEventListener("click", saveAiSettings);
    $("#loadChatModels").addEventListener("click", loadChatModels);

    $("#cpuThreads").addEventListener("input", (event) => {
      $("#threadValue").textContent = event.target.value;
    });
    $("#renderMode").addEventListener("change", updateRenderMode);
    $("#useFullClip").addEventListener("click", () => {
      if (!state.selected) return;
      $("#startSeconds").value = "0";
      $("#durationSeconds").value = Math.min(30, state.selected.durationSeconds).toFixed(1);
      updateClipRangeControls();
    });

    $("#startSeconds").addEventListener("change", syncTrimFromInput);
    $("#durationSeconds").addEventListener("change", updateClipRangeControls);
    $("#trimStartSlider").addEventListener("input", () => {
      $("#startSeconds").value = $("#trimStartSlider").value;
      syncTrimFromInput();
    });
    $("#trimDurationSlider").addEventListener("input", () => {
      $("#durationSeconds").value = $("#trimDurationSlider").value;
      updateClipRangeControls();
    });
    $("#videoPreview").addEventListener("loadedmetadata", () => updateClipRangeControls());
    $("#clearLogs").addEventListener("click", () => $("#consoleLines").replaceChildren());
    $("#cancelJob").addEventListener("click", async () => {
      try { await window.klipo.cancelJob(); } catch (error) { toast("Gagal membatalkan pekerjaan: " + error.message, "error"); }
    });
    $("#openOutput").addEventListener("click", async () => {
      if (!state.lastOutputPath) return;
      try {
        await window.klipo.openPath(state.lastOutputPath);
      } catch (error) {
        toast("Tidak dapat membuka file hasil: " + error.message, "error");
      }
    });
  }

  async function boot() {
    populateCaptionStyles();
    bindEvents();
    window.klipo.onJobUpdate(handleJobUpdate);
    window.klipo.onJobLog((entry) => logLine(entry.message, entry.level));
    window.addEventListener("unhandledrejection", (event) => {
      const message = event.reason && event.reason.message ? event.reason.message : String(event.reason || "Kesalahan tidak diketahui");
      logLine("Kesalahan aplikasi: " + message, "error");
      toast("Terjadi kesalahan: " + message, "error");
    });

    try {
      state.appInfo = await window.klipo.getAppInfo();
      configureHardware();
      logLine("Perangkat terdeteksi: " + state.appInfo.cpuModel + " · " + state.appInfo.logicalCpus +
        " logical CPU · " + formatBytes(state.appInfo.totalMemoryBytes) + " RAM.");
      if (state.appInfo.downloaderAvailable) logLine("yt-dlp bawaan Klipo tersedia.");
      else logLine("yt-dlp tidak ditemukan. Instal ulang Klipo untuk memulihkan downloader.", "warning");
    } catch (error) {
      logLine("Deteksi perangkat gagal: " + error.message, "warning");
      toast("Informasi perangkat tidak dapat dibaca: " + error.message, "error");
    }

    try {
      await loadAiSettings();
    } catch (error) {
      logLine("Pengaturan AI tidak dapat dimuat: " + error.message, "warning");
    }

    renderLibrary();
    updateEditorMedia();
    updateTranscriptionSource();
    updateCaptionPreview();
  }

  document.addEventListener("DOMContentLoaded", boot);
})();
