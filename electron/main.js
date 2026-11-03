"use strict";

const { app, BrowserWindow, ipcMain, dialog, safeStorage, shell } = require("electron");
const os = require("node:os");
const fs = require("node:fs");
const path = require("node:path");
const { spawn, spawnSync } = require("node:child_process");
const { buildRenderArgs } = require("../src/core/render-plan");

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

function runCapture(command, args, timeoutMs = 12000) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { windowsHide: true, shell: false });
    let stdout = "";
    let stderr = "";
    const timer = setTimeout(() => child.kill(), timeoutMs);
    let downloaderBuffer = "";
  const handleDownloaderOutput = (chunk) => {
    downloaderBuffer += chunk.toString();
    const lines = downloaderBuffer.split(/\r?\n/);
    downloaderBuffer = lines.pop() || "";
    for (const line of lines) {
      if (!line) continue;
      if (line.startsWith("[download]")) {
        const match = line.match(/([\d.]+)%/);
        if (match) send("job:update", { kind: "download", status: "running", percent: Number(match[1]) });
      }
      if (path.isAbsolute(line.trim())) lastPath = line.trim();
      logJob(line, "detail");
    }
  };
  child.stdout.on("data", handleDownloaderOutput);
  child.stderr.on("data", handleDownloaderOutput);
  child.on("error", (error) => {
      clearTimeout(timer);
      reject(error);
    });
    child.on("close", (code) => {
      clearTimeout(timer);
      if (code === 0) resolve({ stdout, stderr });
      else reject(new Error((stderr || "Command failed with code " + code).trim().slice(-1600)));
    });
  });
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

async function transcribeMedia(filePath) {
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
    const endpoint = safeEndpoint(settings.transcriptionBaseUrl) + "/audio/transcriptions";
    const response = await fetch(endpoint, {
      method: "POST",
      headers: { Authorization: "Bearer " + settings.transcriptionApiKey },
      body: form,
      signal: AbortSignal.timeout(180000)
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error("Transcription failed (" + response.status + "): " + ((payload.error || {}).message || response.statusText));
    return String(payload.text || "");
  } finally {
    if (temporaryAudioPath) await fs.promises.unlink(temporaryAudioPath).catch(() => {});
  }
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
      if (!error && code === 0 && size > 0) {
        completedOutputPaths.add(path.resolve(output.filePath));
        logJob("Export complete: " + (size / 1048576).toFixed(2) + " MB");
        send("job:update", { kind: "render", status: "complete", percent: 100, outputPath: output.filePath, sizeBytes: size });
      } else {
        if (exists && size === 0) fs.promises.unlink(output.filePath).catch(() => {});
        logJob(error ? error.message : "Render did not produce an output file.", "error");
        send("job:update", { kind: "render", status: "error", error: error ? error.message : "Render failed." });
      }
    }
  });
}

async async function startDownload(rawUrl) {
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
  child.stdout.on("data", (chunk) => {
    for (const line of chunk.toString().split(/\r?\n/)) {
      if (!line) continue;
      if (line.startsWith("[download]")) {
        const match = line.match(/([\d.]+)%/);
        if (match) send("job:update", { kind: "download", status: "running", percent: Number(match[1]) });
      }
      if (path.isAbsolute(line.trim())) lastPath = line.trim();
      logJob(line, "detail");
    }
  });
  child.stderr.on("data", (chunk) => {
    for (const line of chunk.toString().split(/\r?\n/).filter(Boolean).slice(-8)) logJob(line, "detail");
  });
  child.on("error", (error) => {
    activeJob = null;
    send("job:update", { kind: "download", status: "error", error: error.message });
  });
  child.on("close", (code) => {
    activeJob = null;
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
    activeJob = null;
    try { job.process.kill("SIGTERM"); } catch (_error) {}
    if (job.captionFilePath) fs.promises.unlink(job.captionFilePath).catch(() => {});
    logJob("Job canceled by user.", "warning");
    send("job:update", { kind: job.kind, status: "canceled" });
    return { canceled: true };
  });
  ipcMain.handle("download:start", (_event, url) => startDownload(url));
  ipcMain.handle("ai:save-settings", (_event, input) => storeSettings(input || {}));
  ipcMain.handle("ai:get-settings", () => publicSettings());
  ipcMain.handle("ai:chat", (_event, messages) => callAiChat(messages));
  ipcMain.handle("ai:transcribe", (_event, filePath) => transcribeMedia(String(filePath || "")));
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

app.whenReady().then(() => {
  app.setAppUserModelId("com.revosky.klipo");
  registerHandlers();
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
  if (process.platform !== "darwin") app.quit();
});