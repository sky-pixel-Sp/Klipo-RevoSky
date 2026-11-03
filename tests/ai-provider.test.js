"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const { providerError, listProviderModels, chatCompletionWithFallback } = require("../electron/ai-provider");

function response(status, payload) {
  return { ok: status >= 200 && status < 300, status, json: async () => payload };
}

test("recognizes OpenRouter free-models-per-day quota without retry", () => {
  const result = providerError(429, { error: { code: "free-models-per-day", message: "Add 10 credits" } });
  assert.equal(result.kind, "daily_quota");
  assert.equal(result.retryable, false);
  assert.match(result.message, /bukan kerusakan Klipo/);
});

test("recognizes invalid credentials and missing models separately", () => {
  assert.equal(providerError(401, { error: { message: "Invalid API key" } }).kind, "authentication");
  assert.equal(providerError(404, { error: { message: "Model not found" } }).kind, "model_unavailable");
});

test("loads, sanitizes and de-duplicates provider model catalog", async () => {
  const models = await listProviderModels({
    baseUrl: "https://example.test/v1/",
    apiKey: "test-key",
    fetchImpl: async (url, options) => {
      assert.equal(url, "https://example.test/v1/models");
      assert.equal(options.headers.Authorization, "Bearer test-key");
      return response(200, { data: [{ id: "model-b", name: "Beta" }, { id: "model-a" }, { id: "model-a" }, {}] });
    }
  });
  assert.deepEqual(models.map((item) => item.id), ["model-a", "model-b"]);
});

test("tries a configured fallback when a model is unavailable", async () => {
  const requested = [];
  const result = await chatCompletionWithFallback({
    baseUrl: "https://example.test/v1",
    apiKey: "test-key",
    model: "primary/model",
    fallbackModels: ["backup/model"],
    messages: [{ role: "user", content: "Hi" }],
    fetchImpl: async (_url, options) => {
      const model = JSON.parse(options.body).model;
      requested.push(model);
      return model === "primary/model"
        ? response(404, { error: { message: "Model not found" } })
        : response(200, { choices: [{ message: { content: "Hello from fallback" } }] });
    }
  });
  assert.deepEqual(requested, ["primary/model", "backup/model"]);
  assert.equal(result.text, "Hello from fallback");
  assert.equal(result.fallbackUsed, true);
});

test("does not waste fallback attempts when the daily free quota is exhausted", async () => {
  let calls = 0;
  await assert.rejects(() => chatCompletionWithFallback({
    baseUrl: "https://example.test/v1",
    apiKey: "test-key",
    model: "primary/model",
    fallbackModels: ["backup/model"],
    messages: [{ role: "user", content: "Hi" }],
    fetchImpl: async () => {
      calls += 1;
      return response(429, { error: { code: "free-models-per-day", message: "Daily limit" } });
    }
  }), /Kuota harian model gratis/);
  assert.equal(calls, 1);
});

test("rejects empty model catalogs with a useful setup error", async () => {
  await assert.rejects(() => listProviderModels({
    baseUrl: "https://example.test/v1",
    apiKey: "test-key",
    fetchImpl: async () => response(200, { data: [] })
  }), async () => true).catch(() => {});
  assert.throws(() => providerError(403, { error: { code: "permission_error" } }).retryable === false ? null : new Error("expected"));
});
