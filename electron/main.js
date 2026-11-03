"use strict";

const { app, BrowserWindow, ipcMain, dialog, safeStorage, shell } = require("electron");
const os = require("node:os");
const fs = require("node:fs");
const path = require("node:path");
const { spawn, spawnSync } = require("node:child_process");
const { pathToFileURL } = require("node:url");
const { buildRenderArgs } = require("../src/core/render-plan");
const { runCapture } = require("./process-utils");
const { parseHighlightPayload } = require("../src/core/highlights");

let mainWindow = null;
let activeJob = null;
let encoderCache = null;
const allowedMediaPaths = new Set();
const completedOutputPaths = new Set();

const ffmpegPath = resolveBinary(() => require("ffmpeg-static"), "ffmpeg");
const ffprobePath = resolveBinary(() => require("ffprobe-static").path, "ffprobe");

function resolveBinary(loader, command) {
  try {
    const candidate = loader();
    if (candidate && fs.existsSync(candidate)) return candidate;
  } catch (_error) {}
  return command;
}

function send(channel, payload) {
  if (mainWindow && !mainWindow.isDestroyed()) mainWindow.webContents.send(channel, payload);
}

function logJob(message, level = "info") {
  send("job:log", { message: String(message).slice(0, 1200), level, at: new Date().toISOString() });
}

function getAvailableEncoders() {
  if (encoderCache) return encoderCache;
  try {
    const result = spawnSync(ffmpegPath, ["-hide_banner", "-encoders"], {
      encoding: "utf8", windowsHide: true, timeout: 12000
    });
    const text = String(result.stdout || "") + String(result.stderr || "");
    encoderCache = ["h264_qsv", "h264_nvenc", "h264_amf"].filter((name) => text.includes(name));
  } catch (_error) {
    encoderCache = [];
  }
  return encoderCache;
}

function getAppInfo() {
  const cpus = os.cpus();
  return {
    name: app.getName(),
    version: app.getVersion(),
    platform: process.platform,
    architecture: process.arch,
    cpuModel: cpus[0] ? cpus[0].model : "Unknown CPU",
    logicalCpus: cpus.length,
    totalMemoryBytes: os.totalmem(),
    freeMemoryBytes: os.freemem(),
    encoders: getAvailableEncoders(),
    ffmpegAvailable: ffmpegPath !== "ffmpeg" || spawnSync("ffmpeg", ["-version"], { windowsHide: true }).status === 0,
    ffprobeAvailable: ffprobePath !== "ffprobe" || spawnSync("ffprobe", ["-version"], { windowsHide: true }).status === 0,
    downloaderAvailable: spawnSync("yt-dlp", ["--version"], { windowsHide: true, encoding: "utf8" }).status === 0
  };
}

async function probeMedia(filePath) {
  const stat = await fs.promises.stat(filePath);
  const result = await runCapture(ffprobePath, [
    "-v", "error", "-show_format", "-show_streams", "-of", "json", filePath
  ], 20000);
  const data = JSON.parse(result.stdout);
  const video = (data.streams || []).find((stream) => stream.codec_type === "video");
  const audio = (data.streams || []).find((stream) => stream.codec_type === "audio");
  const duration = Number((data.format || {}).duration || (video || {}).duration || 0);
  return {
    path: filePath,
    previewUrl: pathToFileURL(filePath).href,
    name: path.basename(filePath),
    sizeBytes: stat.size,
    durationSeconds: Number.isFinite(duration) ? duration : 0,
    width: video ? video.width : 0,
    height: video ? video.height : 0,
    videoCodec: video ? video.codec_name : "unknown",
    audioCodec: audio ? audio.codec_name : null,
    hasAudio: Boolean(audio),
    format: (data.format || {}).format_name || "unknown"
  };
}

function safeEndpoint(value) {
  const parsed = new URL(String(value || "").trim());
  const local = ["localhost", "127.0.0.1", "::1"].includes(parsed.hostname);
  if (parsed.protocol !== "https:" && !(local && parsed.protocol === "http:")) {
    throw new Error("AI endpoint must use HTTPS (HTTP is allowed only for localhost).");
  }
  return parsed.toString().replace(/\/+$/, "");
}

function settingsPath() {
  return path.join(app.getPath("userData"), "ai-settings.json");
}

function readStoredSettings() {
  try {
    const raw = JSON.parse(fs.readFileSync(settingsPath(), "utf8"));
    const decrypt = (value) => {
      if (!value || !safeStorage.isEncryptionAvailable()) return "";
      try { return safeStorage.decryptString(Buffer.from(value, "base64")); } catch (_error) { return ""; }
    };
    return {
      chatBaseUrl: raw.chatBaseUrl || "https://openrouter.ai/api/v1",
      chatModel: raw.chatModel || "",
      transcriptionBaseUrl: raw.transcriptionBaseUrl || "https://api.openai.com/v1",
      transcriptionModel: raw.transcriptionModel || "whisper-1",
      chatApiKey: decrypt(raw.chatApiKeyEncrypted),
      transcriptionApiKey: decrypt(raw.transcriptionApiKeyEncrypted)
    };
  } catch (_error) {
    return {
      chatBaseUrl: "https://openrouter.ai/api/v1",
      chatModel: "",
      transcriptionBaseUrl: "https://api.openai.com/v1",
      transcriptionModel: "whisper-1",
      chatApiKey: "",
      transcriptionApiKey: ""
    };
  }
}

function storeSettings(input) {
  if (!safeStorage.isEncryptionAvailable()) {
    throw new Error("Secure credential storage is unavailable on this Windows session. No API key was saved.");
  }
  const previous = readStoredSettings();
  const old = (() => {
    try { return JSON.parse(fs.readFileSync(settingsPath(), "utf8")); } catch (_error) { return {}; }
  })();
  const next = {
    chatBaseUrl: input.chatBaseUrl ? safeEndpoint(input.chatBaseUrl) : previous.chatBaseUrl,
    chatModel: String(input.chatModel || previous.chatModel || "").trim(),
    transcriptionBaseUrl: input.transcriptionBaseUrl ? safeEndpoint(input.transcriptionBaseUrl) : previous.transcriptionBaseUrl,
    transcriptionModel: String(input.transcriptionModel || previous.transcriptionModel || "whisper-1").trim(),
    chatApiKeyEncrypted: input.chatApiKey ? safeStorage.encryptString(String(input.chatApiKey)).toString("base64") : (old.chatApiKeyEncrypted || ""),
    transcriptionApiKeyEncrypted: input.transcriptionApiKey
      ? safeStorage.encryptString(String(input.transcriptionApiKey)).toString("base64") : (old.transcriptionApiKeyEncrypted || "")
  };
  fs.mkdirSync(path.dirname(settingsPath()), { recursive: true });
  fs.writeFileSync(settingsPath(), JSON.stringify(next, null, 2), { mode: 0o600 });
  return {
    chatConfigured: Boolean(next.chatApiKeyEncrypted && next.chatModel),
    transcriptionConfigured: Boolean(next.transcriptionApiKeyEncrypted && next.transcriptionModel)
  };
}

function publicSettings() {
  const settings = readStoredSettings();
  return {
    chatBaseUrl: settings.chatBaseUrl,
    chatModel: settings.chatModel,
    transcriptionBaseUrl: settings.transcriptionBaseUrl,
    transcriptionModel: settings.transcriptionModel,
    chatConfigured: Boolean(settings.chatApiKey && settings.chatModel),
    transcriptionConfigured: Boolean(settings.transcriptionApiKey && settings.transcriptionModel)
  };
}

async function callAiChat(messages) {
  const settings = readStoredSettings();
  if (!settings.chatApiKey || !settings.chatModel) throw new Error("Configure a chat API key and model in Settings first.");
  const endpoint = safeEndpoint(settings.chatBaseUrl) + "/chat/completions";
  const response = await fetch(endpoint, {
    method: "POST",
    headers: { Authorization: "Bearer " + settings.chatApiKey, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: settings.chatModel,
      messages: (Array.isArray(messages) ? messages : []).slice(-12),
      temperature: 0.5
    }),
    signal: AbortSignal.timeout(90000)
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error("AI request failed (" + response.status + "): " + ((payload.error || {}).message || response.statusText));
  return String((((payload.choices || [])[0] || {}).message || {}).content || "The provider returned no text.");
}

async function transcribeMedia(filePath, responseFormat = "") {
  const resolvedPath = path.resolve(filePath);
  if (!allowedMediaPaths.has(resolvedPath)) throw new Error("Import this media through Klipo before requesting transcription.");
  const settings = readStoredSettings();
  if (!settings.transcriptionApiKey || !settings.transcriptionModel) {
    throw new Error("Configure a transcription API key and an audio transcription model in Settings first.");
  }

  let uploadPath = resolvedPath;
  let temporaryAudioPath = null;
  const videoExtensions = new Set([".mp4", ".mov", ".mkv", ".webm", ".avi", ".m4v"]);
  if (videoExtensions.has(path.extname(resolvedPath).toLowerCase())) {
    temporaryAudioPath = path.join(app.getPath("temp"), "klipo-audio-" + Date.now() + ".mp3");
    logJob("Extracting a temporary mono audio track locally for transcription.");
    try {
      await runCapture(ffmpegPath, [
        "-hide_banner", "-y", "-i", resolvedPath, "-vn", "-ac", "1", "-ar", "16000", "-b:a", "64k", temporaryAudioPath
      ], 180000);
      uploadPath = temporaryAudioPath;
    } catch (error) {
      throw new Error("Could not extract audio from this video: " + error.message);
    }
  }

  try {
    const stat = await fs.promises.stat(uploadPath);
    if (stat.size > 100 * 1024 * 1024) throw new Error("This MVP limits transcription uploads to 100 MB.");
    const bytes = await fs.promises.readFile(uploadPath);
    const form = new FormData();
    form.append("file", new Blob([bytes], { type: "audio/mpeg" }), path.basename(uploadPath));
    form.append("model", settings.transcriptionModel);
    if (responseFormat) form.append("response_format", responseFormat);
    const endpoint = safeEndpoint(settings.transcriptionBaseUrl) + "/audio/transcriptions";
    const response = await fetch(endpoint, {
      method: "POST",
      headers: { Authorization: "Bearer " + settings.transcriptionApiKey },
      body: form,
      signal: AbortSignal.timeout(180000)
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error("Transcription failed (" + response.status + "): " + ((payload.error || {}).message || response.statusText));
    return responseFormat === "verbose_json" ? payload : String(payload.text || "");
  } finally {
    if (temporaryAudioPath) await fs.promises.unlink(temporaryAudioPath).catch(() => {});
  }
}

async function findHighlights(filePath) {
  const resolvedPath = path.resolve(String(filePath || ""));
  if (!allowedMediaPaths.has(resolvedPath) || !fs.existsSync(resolvedPath)) {
    throw new Error("Import a valid media file through Klipo before finding highlights.");
  }

  const metadata = await probeMedia(resolvedPath);
  if (!metadata.width || !metadata.height) throw new Error("Select a video file, not an audio-only file, for highlight analysis.");
  if (!metadata.hasAudio) throw new Error("The selected video has no audio track to analyze.");
  const transcription = await transcribeMedia(resolvedPath, "verbose_json");
  const sourceSegments = Array.isArray(transcription.segments) ? transcription.segments : [];
  const compactSegments = [];
  let characterCount = 0;

  for (const segment of sourceSegments) {
    const start = Number(segment.start);
    const end = Number(segment.end);
    const text = String(segment.text || "").trim().slice(0, 400);
    const safeStart = Math.max(0, start);
    const safeEnd = Math.min(metadata.durationSeconds, end);
    if (!text || !Number.isFinite(start) || !Number.isFinite(end) || safeStart >= metadata.durationSeconds || safeEnd <= safeStart) continue;
    if (characterCount + text.length > 18000) break;
    compactSegments.push({ start: safeStart, end: safeEnd, text });
    characterCount += text.length;
    if (compactSegments.length >= 220) break;
  }

  if (!compactSegments.length) {
    throw new Error("The transcription provider returned no timestamped segments. It must support response_format=verbose_json for AI highlights.");
  }

  logJob("Analyzing " + compactSegments.length + " timestamped transcript segments for highlights.");
  const content = await callAiChat([
    {
      role: "system",
      content: "You are a professional short-form video editor. Select the strongest self-contained moments from the supplied timestamped transcript. Do not invent events or timestamps. Return only JSON in this exact shape: {\"highlights\":[{\"start\":12.3,\"end\":31.5,\"title\":\"Short title\",\"reason\":\"Why this moment works\"}]}. Return at most five non-overlapping clips, each 2 to 60 seconds, inside the source duration. Prefer strong hooks, complete thoughts, useful information, emotional peaks, or clear punchlines. Keep the spoken context intact."
    },
    {
      role: "user",
      content: "Source duration: " + metadata.durationSeconds.toFixed(2) + " seconds. Choose highlights from these timestamped transcript segments:\n" + JSON.stringify(compactSegments)
    }
  ]);

  return parseHighlightPayload(content, metadata.durationSeconds);
}

function startRender(options) {
  return new Promise(async (resolve) => {
    if (activeJob) return resolve({ started: false, error: "Another media job is already running." });
    const inputPath = path.resolve(String((options || {}).inputPath || ""));
    if (!inputPath || !allowedMediaPaths.has(inputPath) || !fs.existsSync(inputPath)) {
      return resolve({ started: false, error: "Import a valid local video file first." });
    }

    const output = await dialog.showSaveDialog(mainWindow, {
      title: "Export video",
      defaultPath: path.join(app.getPath("videos"), path.parse(inputPath).name + "-klipo.mp4"),
      filters: [{ name: "MP4 Video", extensions: ["mp4"] }]
    });
    if (output.canceled || !output.filePath) return resolve({ started: false, canceled: true });

    let captionFilePath = null;
    try {
      const captionText = String((options || {}).captionText || "");
      if (captionText.trim()) {
        captionFilePath = path.join(app.getPath("temp"), "klipo-caption-" + Date.now() + ".txt");
        await fs.promises.writeFile(captionFilePath, captionText, "utf8");
      }
      const plan = buildRenderArgs({
        ...options,
        inputPath,
        outputPath: output.filePath,
        captionFilePath,
        availableEncoders: getAvailableEncoders()
      }, { logicalCpus: os.cpus().length });

      logJob("Render started: " + path.basename(inputPath) + " → " + path.basename(output.filePath));
      logJob("Encoder: " + plan.codec + " · CPU/filter threads: " + plan.threads + " · Mode: " + plan.mode);
      const processHandle = spawn(ffmpegPath, plan.args, { windowsHide: true, shell: false, stdio: ["ignore", "pipe", "pipe"] });
      const startedAt = Date.now();
      activeJob = { process: processHandle, kind: "render", captionFilePath, outputPath: output.filePath };
      resolve({ started: true, outputPath: output.filePath });

      let stdoutBuffer = "";
      processHandle.stdout.on("data", (chunk) => {
        stdoutBuffer += chunk.toString();
        const lines = stdoutBuffer.split(/\r?\n/);
        stdoutBuffer = lines.pop() || "";
        for (const line of lines) {
          const pair = line.split("=");
          if (pair.length === 2 && pair[0] === "out_time_ms") {
            const seconds = Number(pair[1]) / 1000000;
            const percent = Math.min(99.5, Math.max(0, seconds / plan.durationSeconds * 100));
            const elapsed = (Date.now() - startedAt) / 1000;
            const eta = percent > 1 ? Math.max(0, elapsed * (100 / percent - 1)) : null;
            send("job:update", { kind: "render", status: "running", percent, elapsedSeconds: elapsed, etaSeconds: eta, outputPath: output.filePath });
          }
        }
      });
      processHandle.stderr.on("data", (chunk) => {
        const lines = chunk.toString().split(/\r?\n/).filter(Boolean);
        for (const line of lines.slice(-8)) logJob(line, "detail");
      });
      processHandle.on("error", (error) => finishRender(error, null));
      processHandle.on("close", (code) => finishRender(code === 0 ? null : new Error("FFmpeg exited with code " + code), code));
    } catch (error) {
      if (captionFilePath) fs.promises.unlink(captionFilePath).catch(() => {});
      resolve({ started: false, error: error.message });
    }

    function finishRender(error, code) {
      const job = activeJob;
      if (!job || job.kind !== "render") return;
      activeJob = null;
      if (job.captionFilePath) fs.promises.unlink(job.captionFilePath).catch(() => {});
      const exists = fs.existsSync(output.filePath);
      const size = exists ? fs.statSync(output.filePath).size : 0;
      if (job.canceled) {
        if (exists) fs.promises.unlink(output.filePath).catch(() => {});
        logJob("Render canceled. Partial output was discarded.", "warning");
        send("job:update", { kind: "render", status: "canceled" });
        return;
      }
      if (!error && code === 0 && size > 0) {
        completedOutputPaths.add(path.resolve(output.filePath));
        logJob("Export complete: " + (size / 1048576).toFixed(2) + " MB");
        send("job:update", { kind: "render", status: "complete", percent: 100, outputPath: output.filePath, sizeBytes: size });
      } else {
        if (exists) fs.promises.unlink(output.filePath).catch(() => {});
        logJob(error ? error.message : "Render did not produce an output file.", "error");
        send("job:update", { kind: "render", status: "error", error: error ? error.message : "Render failed." });
      }
    }
  });
}

async function startDownload(rawUrl) {
  if (activeJob) return { started: false, error: "Another media job is already running." };
  let url;
  try {
    url = new URL(String(rawUrl || "").trim());
    if (!["http:", "https:"].includes(url.protocol)) throw new Error("Only HTTP and HTTPS links are accepted.");
  } catch (error) {
    return { started: false, error: error.message || "Enter a valid URL." };
  }
  const downloaderCheck = spawnSync("yt-dlp", ["--version"], { encoding: "utf8", windowsHide: true });
  if (downloaderCheck.status !== 0) {
    return { started: false, error: "yt-dlp was not found. Install yt-dlp and add it to Windows PATH, then restart Klipo." };
  }
  const folder = await dialog.showOpenDialog(mainWindow, { title: "Choose download folder", properties: ["openDirectory", "createDirectory"] });
  if (folder.canceled || !folder.filePaths[0]) return { started: false, canceled: true };

  const template = path.join(folder.filePaths[0], "%(title).120B [%(id)s].%(ext)s");
  const args = ["--newline", "--no-playlist", "--merge-output-format", "mp4", "--print", "after_move:filepath", "-o", template, url.toString()];
  logJob("Starting yt-dlp. Download only media you own or are authorized to save.");
  const child = spawn("yt-dlp", args, { windowsHide: true, shell: false, stdio: ["ignore", "pipe", "pipe"] });
  activeJob = { process: child, kind: "download" };
  let lastPath = "";
  send("job:update", { kind: "download", status: "running", percent: 0 });
  let stdoutBuffer = "";
  let stderrBuffer = "";
  const handleDownloadLine = (line, source) => {
    if (!line) return;
    if (line.startsWith("[download]")) {
      const match = line.match(/([\d.]+)%/);
      if (match) send("job:update", { kind: "download", status: "running", percent: Number(match[1]) });
    }
    if (source === "stdout" && path.isAbsolute(line.trim())) lastPath = line.trim();
    logJob(line, "detail");
  };
  const attachDownloadStream = (stream, source) => {
    let buffer = "";
    stream.on("data", (chunk) => {
      buffer += chunk.toString();
      const lines = buffer.split(/\r?\n/);
      buffer = lines.pop() || "";
      for (const line of lines) handleDownloadLine(line, source);
    });
    stream.on("end", () => {
      if (buffer) handleDownloadLine(buffer, source);
    });
  };
  attachDownloadStream(child.stdout, "stdout");
  attachDownloadStream(child.stderr, "stderr");
  child.on("error", (error) => {
    activeJob = null;
    send("job:update", { kind: "download", status: "error", error: error.message });
  });
  child.on("close", (code) => {
    const wasCanceled = Boolean(activeJob && activeJob.process === child && activeJob.canceled);
    if (activeJob && activeJob.process === child) activeJob = null;
    if (wasCanceled) {
      send("job:update", { kind: "download", status: "canceled" });
      return;
    }
    if (code === 0) {
      if (lastPath && fs.existsSync(lastPath)) {
        allowedMediaPaths.add(path.resolve(lastPath));
        completedOutputPaths.add(path.resolve(lastPath));
      }
      logJob("Download finished." + (lastPath ? " Saved: " + lastPath : ""));
      send("job:update", { kind: "download", status: "complete", percent: 100, outputPath: lastPath || "" });
    } else {
      send("job:update", { kind: "download", status: "error", error: "yt-dlp exited with code " + code });
    }
  });
  return { started: true };
}

function registerHandlers() {
  ipcMain.handle("app:info", () => getAppInfo());
  ipcMain.handle("media:import", async () => {
    const result = await dialog.showOpenDialog(mainWindow, {
      title: "Import video or audio",
      properties: ["openFile", "multiSelections"],
      filters: [
        { name: "Media files", extensions: ["mp4", "mov", "mkv", "webm", "avi", "m4v", "mp3", "wav", "m4a", "aac"] },
        { name: "All files", extensions: ["*"] }
      ]
    });
    if (result.canceled) return [];
    const items = [];
    for (const filePath of result.filePaths) {
      try {
        const item = await probeMedia(filePath);
        allowedMediaPaths.add(path.resolve(filePath));
        items.push(item);
      } catch (error) {
        items.push({ path: filePath, name: path.basename(filePath), error: error.message });
      }
    }
    return items;
  });
  ipcMain.handle("media:inspect-downloaded", async (_event, filePath) => {
    const resolved = path.resolve(String(filePath || ""));
    if (!completedOutputPaths.has(resolved) || !fs.existsSync(resolved)) {
      throw new Error("This file was not produced by a completed Klipo download.");
    }
    const item = await probeMedia(resolved);
    allowedMediaPaths.add(resolved);
    return item;
  });
  ipcMain.handle("render:start", (_event, options) => startRender(options));
  ipcMain.handle("job:cancel", () => {
    if (!activeJob) return { canceled: false };
    const job = activeJob;
    job.canceled = true;
    try { job.process.kill("SIGTERM"); } catch (_error) {}
    if (job.captionFilePath) fs.promises.unlink(job.captionFilePath).catch(() => {});
    logJob("Cancellation requested by user.", "warning");
    if (job.kind === "download") {
      return { canceled: true };
    }
    return { canceled: true };
  });
  ipcMain.handle("download:start", (_event, url) => startDownload(url));
  ipcMain.handle("ai:save-settings", (_event, input) => storeSettings(input || {}));
  ipcMain.handle("ai:get-settings", () => publicSettings());
  ipcMain.handle("ai:chat", (_event, messages) => callAiChat(messages));
  ipcMain.handle("ai:transcribe", (_event, filePath) => transcribeMedia(String(filePath || "")));
  ipcMain.handle("ai:highlights", (_event, filePath) => findHighlights(String(filePath || "")));
  ipcMain.handle("app:open-path", async (_event, targetPath) => {
    const value = path.resolve(String(targetPath || ""));
    if (!completedOutputPaths.has(value) || !fs.existsSync(value)) throw new Error("Only a completed Klipo output can be opened here.");
    return shell.openPath(value);
  });
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1500,
    height: 960,
    minWidth: 1080,
    minHeight: 720,
    backgroundColor: "#f5f6f8",
    show: false,
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      webSecurity: true
    }
  });
  mainWindow.loadFile(path.join(__dirname, "..", "src", "index.html"));
  mainWindow.once("ready-to-show", () => mainWindow.show());
  mainWindow.on("closed", () => { mainWindow = null; });
}


const installedSmokeTest = process.env.KLIPO_SMOKE_TEST === "1" || process.argv.includes("--klipo-smoke-test") || app.commandLine.hasSwitch("klipo-smoke-test");
const smokeResultArgument = process.argv.find((argument) => argument.startsWith("--klipo-smoke-result="));
const smokeResultPath = process.env.KLIPO_SMOKE_RESULT_PATH ||
  (smokeResultArgument ? smokeResultArgument.slice("--klipo-smoke-result=".length) : "");
if (smokeResultPath) {
  try {
    fs.writeFileSync(smokeResultPath + ".started", JSON.stringify({
      argv: process.argv,
      smokeEnvironment: process.env.KLIPO_SMOKE_TEST || "",
      commandLineSwitch: app.commandLine.hasSwitch("klipo-smoke-test"),
      smokeRequested: installedSmokeTest
    }, null, 2), "utf8");
  } catch (_error) {}
}
if (installedSmokeTest) app.disableHardwareAcceleration();

async function runInstalledSmokeTest() {
  let smokeWindow = null;
  const directory = path.join(app.getPath("temp"), "klipo-installed-smoke-" + process.pid);
  await fs.promises.mkdir(directory, { recursive: true });
  try {
    const info = getAppInfo();
    if (!info.ffmpegAvailable || !info.ffprobeAvailable) {
      throw new Error("Packaged FFmpeg or FFprobe binary is unavailable.");
    }

    smokeWindow = new BrowserWindow({
      show: false,
      width: 1200,
      height: 800,
      webPreferences: {
        preload: path.join(__dirname, "preload.js"),
        contextIsolation: true,
        nodeIntegration: false,
        sandbox: true,
        webSecurity: true
      }
    });
    await smokeWindow.loadFile(path.join(__dirname, "..", "src", "index.html"));
    const ui = await smokeWindow.webContents.executeJavaScript(`({
      readyState: document.readyState,
      title: document.title,
      highlightButton: Boolean(document.getElementById("findHighlightsButton")),
      highlightResults: Boolean(document.getElementById("highlightResults")),
      secureBridge: Boolean(window.klipo && typeof window.klipo.findHighlights === "function"),
      unrestrictedMediaUrlRemoved: !window.klipo || typeof window.klipo.mediaUrl !== "function"
    })`);
    if (ui.readyState !== "complete" || !ui.highlightButton || !ui.highlightResults || !ui.secureBridge || !ui.unrestrictedMediaUrlRemoved) {
      throw new Error("Installed renderer smoke test failed: " + JSON.stringify(ui));
    }

    const inputPath = path.join(directory, "smoke-input.mp4");
    const outputPath = path.join(directory, "smoke-output.mp4");
    const captionPath = path.join(directory, "smoke-caption.txt");
    await fs.promises.writeFile(captionPath, "KLIPO INSTALLED SMOKE TEST", "utf8");
    await runCapture(ffmpegPath, [
      "-hide_banner", "-y",
      "-f", "lavfi", "-i", "testsrc2=size=320x240:rate=15:duration=1.2",
      "-f", "lavfi", "-i", "sine=frequency=997:sample_rate=44100:duration=1.2",
      "-shortest", "-c:v", "libx264", "-preset", "ultrafast",
      "-pix_fmt", "yuv420p", "-c:a", "aac", "-b:a", "64k", inputPath
    ], 60000);

    const plan = buildRenderArgs({
      inputPath,
      outputPath,
      captionFilePath: captionPath,
      captionText: "KLIPO INSTALLED SMOKE TEST",
      captionStyle: "classic",
      startSeconds: 0,
      durationSeconds: 1,
      width: 320,
      height: 240,
      fps: 15,
      threads: 1,
      mode: "cpu",
      effects: ["cinematic", "vignette"]
    }, { logicalCpus: Math.max(1, os.cpus().length) });
    await runCapture(ffmpegPath, plan.args, 90000);
    const rendered = await probeMedia(outputPath);
    if (rendered.width !== 320 || rendered.height !== 240 || !rendered.hasAudio || rendered.sizeBytes < 1000) {
      throw new Error("Packaged FFmpeg render verification failed: " + JSON.stringify(rendered));
    }

    const smokeResult = {
      status: "passed",
      ui,
      ffmpegAvailable: info.ffmpegAvailable,
      ffprobeAvailable: info.ffprobeAvailable,
      encoder: plan.codec,
      width: rendered.width,
      height: rendered.height,
      hasAudio: rendered.hasAudio,
      outputSizeBytes: rendered.sizeBytes
    };
    if (smokeResultPath) {
      await fs.promises.writeFile(smokeResultPath, JSON.stringify(smokeResult, null, 2), "utf8");
    }
    console.log("KLIPO_INSTALLED_SMOKE_RESULT=" + JSON.stringify(smokeResult));
  } finally {
    if (smokeWindow && !smokeWindow.isDestroyed()) smokeWindow.destroy();
    await fs.promises.rm(directory, { recursive: true, force: true }).catch(() => {});
  }
}

app.whenReady().then(async () => {
  app.setAppUserModelId("com.revosky.klipo");
  registerHandlers();
  if (installedSmokeTest) {
    try {
      await runInstalledSmokeTest();
      app.exit(0);
    } catch (error) {
      const failure = { status: "failed", error: error.stack || error.message };
      console.error("KLIPO_INSTALLED_SMOKE_FAILED=" + failure.error);
      if (smokeResultPath) {
        try {
          await fs.promises.writeFile(smokeResultPath, JSON.stringify(failure, null, 2), "utf8");
        } catch (writeError) {
          console.error("Could not write smoke-test failure report: " + writeError.message);
        }
      }
      app.exit(1);
    }
    return;
  }
  createWindow();
  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on("before-quit", () => {
  if (activeJob) {
    try { activeJob.process.kill("SIGTERM"); } catch (_error) {}
  }
});

app.on("window-all-closed", () => {
  // The smoke-test mode starts with no visible window and creates a hidden
  // verification window after app readiness. Do not auto-quit before it runs.
  if (installedSmokeTest) return;
  if (process.platform !== "darwin") app.quit();
});