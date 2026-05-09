/**
 * groq.js — Groq AI API client
 * Sends structured market data → receives trading signal JSON
 */

const axios = require("axios");
const { config } = require("./config");

const GROQ_URL = "https://api.groq.com/openai/v1/chat/completions";

/**
 * Build the structured prompt sent to Groq
 * @param {string} symbol
 * @param {number} price
 * @param {Object} indicators  { "1m": {...}, "5m": {...}, "15m": {...} }
 * @param {Object} ticker24h
 * @returns {string}
 */
function buildPrompt(symbol, price, indicators, ticker24h) {
  const fmt = (v) => (v !== null && v !== undefined ? String(v) : "N/A");

  const indLines = Object.entries(indicators)
    .map(([tf, ind]) => {
      return (
        `[${tf}]\n` +
        `  RSI: ${fmt(ind.rsi)}\n` +
        `  MACD: ${fmt(ind.macd?.macd)} | Signal: ${fmt(ind.macd?.signal)} | Histogram: ${fmt(ind.macd?.histogram)} | Crossover: ${fmt(ind.macd?.crossover)}\n` +
        `  EMA9: ${fmt(ind.ema?.ema9)} | EMA21: ${fmt(ind.ema?.ema21)} | EMA50: ${fmt(ind.ema?.ema50)}\n` +
        `  Volume Spike: ${ind.volume?.isSpike ? `YES (${ind.volume.spikeRatio}x avg)` : "No"}\n` +
        `  Pump/Dump: ${fmt(ind.pumpDump?.type)} (${fmt(ind.pumpDump?.pct)}%)`
      );
    })
    .join("\n\n");

  return (
    `You are a professional crypto trader and quant analyst.\n` +
    `Analyze the following real-time market data for ${symbol} and return a trading signal.\n\n` +
    `=== MARKET DATA ===\n` +
    `Symbol: ${symbol}\n` +
    `Current Price: ${price}\n` +
    `24h Change: ${ticker24h.priceChangePct}%\n` +
    `24h High: ${ticker24h.highPrice} | Low: ${ticker24h.lowPrice}\n` +
    `24h Volume (quote): ${ticker24h.quoteVolume}\n\n` +
    `=== TECHNICAL INDICATORS ===\n` +
    `${indLines}\n\n` +
    `=== SIGNAL RULES ===\n` +
    `- RSI > 70 → lean SHORT (overbought)\n` +
    `- RSI < 30 → lean LONG (oversold)\n` +
    `- MACD BULLISH crossover → confirms LONG\n` +
    `- MACD BEARISH crossover → confirms SHORT\n` +
    `- Volume spike confirms signal strength\n` +
    `- If signals conflict or are unclear → NO TRADE\n\n` +
    `=== OUTPUT FORMAT ===\n` +
    `Return ONLY a valid JSON object. No markdown, no explanation, no extra text.\n` +
    `{\n` +
    `  "direction": "LONG" | "SHORT" | "NO TRADE",\n` +
    `  "entry": <number>,\n` +
    `  "tp1": <number>,\n` +
    `  "tp2": <number>,\n` +
    `  "tp3": <number>,\n` +
    `  "sl": <number>,\n` +
    `  "rr": "<string e.g. 1:2.5>",\n` +
    `  "confidence": <integer 0-100>,\n` +
    `  "reason": "<2-3 sentence explanation>"\n` +
    `}`
  );
}

/**
 * Call Groq API and return parsed signal object
 * @param {string} symbol
 * @param {number} price
 * @param {Object} indicators
 * @param {Object} ticker24h
 * @returns {Promise<Object>}
 */
async function getGroqSignal(symbol, price, indicators, ticker24h) {
  const prompt = buildPrompt(symbol, price, indicators, ticker24h);

  let res;
  try {
    res = await axios.post(
      GROQ_URL,
      {
        model: config.groq.model,
        max_tokens: config.groq.maxTokens,
        temperature: 0.2, // Low temp for consistent structured output
        messages: [
          {
            role: "system",
            content:
              "You are a professional crypto trader. You ONLY respond with valid JSON trading signals. Never add explanations outside the JSON.",
          },
          {
            role: "user",
            content: prompt,
          },
        ],
      },
      {
        headers: {
          Authorization: `Bearer ${config.groq.apiKey}`,
          "Content-Type": "application/json",
        },
        timeout: 20000,
      }
    );
  } catch (err) {
    const status = err.response?.status;
    const detail = err.response?.data?.error?.message || err.message;
    throw new Error(`Groq API error (${status}): ${detail}`);
  }

  const raw = res.data.choices?.[0]?.message?.content?.trim();
  if (!raw) throw new Error("Empty response from Groq.");

  // Strip markdown code fences if model adds them despite instructions
  const cleaned = raw.replace(/```json|```/g, "").trim();

  let parsed;
  try {
    parsed = JSON.parse(cleaned);
  } catch {
    throw new Error(`Groq returned non-JSON: ${cleaned.slice(0, 200)}`);
  }

  // Validate required fields
  const required = ["direction", "entry", "tp1", "sl", "confidence", "reason"];
  const missing = required.filter((f) => parsed[f] === undefined || parsed[f] === null);
  if (missing.length > 0) {
    throw new Error(`Groq signal missing fields: ${missing.join(", ")}`);
  }

  return parsed;
}

module.exports = { getGroqSignal };