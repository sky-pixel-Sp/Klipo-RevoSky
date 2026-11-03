"use strict";

const messages = {
  en: {
    navHome: "Home", navEditor: "Editor", navDownloads: "Downloads", navAi: "AI Studio",
    navSettings: "Settings", importMedia: "Import media", home: "Home", editor: "Editor",
    downloads: "Downloads", ai: "AI Studio", settings: "Settings", noMedia: "No imported media yet"
  },
  id: {
    navHome: "Beranda", navEditor: "Editor", navDownloads: "Unduhan", navAi: "Studio AI",
    navSettings: "Pengaturan", importMedia: "Impor media", home: "Beranda", editor: "Editor",
    downloads: "Unduhan", ai: "Studio AI", settings: "Pengaturan", noMedia: "Belum ada media yang diimpor"
  }
};

function t(language, key) {
  return (messages[language] && messages[language][key]) || messages.en[key] || key;
}

if (typeof module !== "undefined") module.exports = { messages, t };