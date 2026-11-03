"use strict";

function providerError(status, payload = {}) {
  const source = payload && payload.error ? payload.error : payload;
  const code = String(source.code || source.type || source.error_code || "").toLowerCase();
  const message = String(source.message || payload.message || "The provider returned an error.");
  const detail = (code + " " + message).toLowerCase();

  if (Number(status) === 429 && /free-models-per-day|free models per day|daily quota|quota.*day|per-day.*limit/.test(detail)) {
    return {
      kind: "daily_quota",
      retryable: false,
      message: "Kuota harian model gratis OpenRouter untuk akun ini sudah habis. Ini bukan kerusakan Klipo atau laptop. Tunggu kuota reset, gunakan model/provider berbayar, atau periksa opsi kredit di OpenRouter. Klipo tidak akan mengulang permintaan karena pengulangan tidak mengembalikan kuota."
    };
  }
  if (Number(status) === 401 || Number(status) === 403 || /invalid api key|unauthorized|authentication|insufficient.*permission/.test(detail)) {
    return {
      kind: "authentication",
      retryable: false,
      message: "API key ditolak oleh provider. Periksa kembali API key dan izin akun di Settings."
    };
  }
  if (Number(status) === 404 || /model.*(not found|unavailable|does not exist)|unknown model/.test(detail)) {
    return {
      kind: "model_unavailable",
      retryable: true,
      message: "Model tidak ditemukan atau tidak tersedia pada provider ini. Pilih model lain dari katalog provider."
    };
  }
  if (/rate.?limit|too many requests|temporarily throttled|request limit/.test(detail)) {
    return {
      kind: "rate_limit",
      retryable: true,
      message: "Provider sedang membatasi kecepatan permintaan. Tunggu sebentar lalu coba lagi."
    };
  }
  if (Number(status) >= 500 || Number(status) === 429) {
    return {
      kind: "provider_busy",
      retryable: true,
      message: "Server provider AI sedang sibuk atau membatasi permintaan. Coba lagi nanti."
    };
  }
  return {
    kind: "provider_error",
    retryable: false,
    message: "Provider AI mengembalikan HTTP " + status + ": " + message.slice(0, 260)
  };
}

async function parseJsonResponse(response) {
  return response.json().catch(() => ({}));
}

async function listProviderModels(options = {}) {
  const baseUrl = String(options.baseUrl || "").trim().replace(/\/+$/, "");
  const apiKey = String(options.apiKey || "").trim();
  const fetchImpl = options.fetchImpl || fetch;
  if (!baseUrl) throw new Error("Isi API Base URL terlebih dahulu.");
  if (!apiKey) throw new Error("Masukkan API key lalu simpan sebelum memuat katalog model.");

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), Math.max(1000, Number(options.timeoutMs) || 20000));
  try {
    const response = await fetchImpl(baseUrl + "/models", {
      method: "GET",
      headers: { Authorization: "Bearer " + apiKey, Accept: "application/json" },
      signal: controller.signal
    });
    const payload = await parseJsonResponse(response);
    if (!response.ok) throw new Error(providerError(response.status, payload).message);

    const records = Array.isArray(payload.data) ? payload.data : Array.isArray(payload.models) ? payload.models : [];
    const seen = new Set();
    return records.map((item) => ({
      id: String(item && item.id || "").trim(),
      name: String(item && (item.name || item.id) || "").trim(),
      contextLength: Number(item && (item.context_length || item.contextLength) || 0)
    })).filter((item) => {
      if (!item.id || seen.has(item.id)) return false;
      seen.add(item.id);
      return true;
    }).sort((a, b) => a.id < b.id ? -1 : a.id > b.id ? 1 : 0).slice(0, 2000);
  } catch (error) {
    if (error && error.name === "AbortError") throw new Error("Waktu pemeriksaan provider habis. Periksa koneksi internet dan API Base URL.");
    throw error;
  } finally {
    clearTimeout(timer);
  }
}

async function chatCompletionWithFallback(options = {}) {
  const baseUrl = String(options.baseUrl || "").trim().replace(/\/+$/, "");
  const apiKey = String(options.apiKey || "").trim();
  const primary = String(options.model || "").trim();
  const fallbacks = Array.isArray(options.fallbackModels) ? options.fallbackModels : [];
  const messages = Array.isArray(options.messages) ? options.messages.slice(-12) : [];
  const fetchImpl = options.fetchImpl || fetch;
  const models = [...new Set([primary, ...fallbacks.map((item) => String(item || "").trim())].filter(Boolean))].slice(0, 4);

  if (!baseUrl) throw new Error("API Base URL belum diisi. Buka Settings untuk mengatur provider AI.");
  if (!apiKey) throw new Error("API key belum disimpan. Buka Settings → Koneksi AI.");
  if (!models.length) throw new Error("Model ID belum dipilih. Muat katalog model dari Settings.");
  if (!messages.length) throw new Error("Tulis pesan terlebih dahulu.");

  let lastError = null;
  for (let index = 0; index < models.length; index += 1) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), Math.max(1000, Number(options.timeoutMs) || 90000));
    try {
      const response = await fetchImpl(baseUrl + "/chat/completions", {
        method: "POST",
        headers: { Authorization: "Bearer " + apiKey, "Content-Type": "application/json" },
        body: JSON.stringify({
          model: models[index],
          messages,
          temperature: 0.5,
          max_tokens: 700
        }),
        signal: controller.signal
      });
      const payload = await parseJsonResponse(response);
      if (!response.ok) {
        const issue = providerError(response.status, payload);
        lastError = new Error(issue.message);
        lastError.code = issue.kind;
        if (issue.kind === "daily_quota" || !issue.retryable || index === models.length - 1) throw lastError;
        continue;
      }
      const content = (((payload.choices || [])[0] || {}).message || {}).content;
      const text = typeof content === "string"
        ? content.trim()
        : Array.isArray(content)
          ? content.map((part) => String(part.text || "")).join("").trim()
          : "";
      if (!text) throw new Error("Provider menerima permintaan tetapi tidak mengembalikan teks.");
      return { text, modelUsed: models[index], fallbackUsed: index > 0 };
    } catch (error) {
      if (error && error.name === "AbortError") {
        lastError = new Error("Permintaan AI melewati batas waktu. Coba lagi atau pilih model yang lebih ringan.");
      } else {
        lastError = error;
      }
      if (lastError.code === "daily_quota" || index === models.length - 1 || lastError.message.startsWith("Provider menerima")) {
        throw lastError;
      }
    } finally {
      clearTimeout(timer);
    }
  }
  throw lastError || new Error("Semua model AI yang dikonfigurasi gagal.");
}

module.exports = { providerError, listProviderModels, chatCompletionWithFallback };
