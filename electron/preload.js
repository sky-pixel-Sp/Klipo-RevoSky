"use strict";

const { contextBridge, ipcRenderer } = require("electron");

const subscriptions = new Map();

function subscribe(channel, callback) {
  if (typeof callback !== "function") return () => {};
  const listener = (_event, payload) => callback(payload);
  ipcRenderer.on(channel, listener);
  const dispose = () => ipcRenderer.removeListener(channel, listener);
  subscriptions.set(callback, dispose);
  return dispose;
}

contextBridge.exposeInMainWorld("klipo", Object.freeze({
  getAppInfo: () => ipcRenderer.invoke("app:info"),
  importMedia: () => ipcRenderer.invoke("media:import"),
  inspectDownloaded: (filePath) => ipcRenderer.invoke("media:inspect-downloaded", filePath),
  startRender: (options) => ipcRenderer.invoke("render:start", options),
  cancelJob: () => ipcRenderer.invoke("job:cancel"),
  startDownload: (url) => ipcRenderer.invoke("download:start", url),
  saveAiSettings: (settings) => ipcRenderer.invoke("ai:save-settings", settings),
  getAiSettings: () => ipcRenderer.invoke("ai:get-settings"),
  listAiModels: (input) => ipcRenderer.invoke("ai:list-models", input || {}),
  askAi: (messages) => ipcRenderer.invoke("ai:chat", messages),
  transcribeMedia: (filePath) => ipcRenderer.invoke("ai:transcribe", filePath),
  findHighlights: (filePath) => ipcRenderer.invoke("ai:highlights", filePath),
  openPath: (targetPath) => ipcRenderer.invoke("app:open-path", targetPath),
  onJobUpdate: (callback) => subscribe("job:update", callback),
  onJobLog: (callback) => subscribe("job:log", callback)
}));